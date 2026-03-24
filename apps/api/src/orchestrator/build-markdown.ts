import fs from 'fs';
import path from 'path';
import { SessionState } from '@/lib/types';

/**
 * Convert run-on MCQ text into raw HTML so the PDF renderer cannot collapse it.
 * Markdown newlines get eaten by `marked`; raw block-level HTML passes through untouched.
 */
function formatMcqAsHtml(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const text = raw.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/\u00A0/g, ' ');
  const inline = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  if (!/\d{1,2}\.\s/.test(inline) || !/[A-D]\)\s/.test(inline) || !/Answer:\s*[A-D]/i.test(inline)) {
    return raw;
  }

  const body = inline.replace(/^#{1,3}\s+\S[\s\S]*?\s+(?=\d{1,2}\.\s)/, '').trim();
  const qChunks = body.split(/\s+(?=\d{1,2}\.\s)/).filter((s) => /^\d{1,2}\.\s/.test(s));
  if (qChunks.length < 2) return raw;

  const items: string[] = [];
  for (const chunk of qChunks) {
    const numMatch = chunk.match(/^(\d{1,2})\.\s*/);
    if (!numMatch) continue;
    const qNum = numMatch[1];
    let rest = chunk.slice(numMatch[0].length).trim();

    const ansMatch = rest.match(/\s*Answer:\s*([A-D])\b/i);
    const answer = ansMatch ? ansMatch[1].toUpperCase() : null;
    if (ansMatch && ansMatch.index != null) rest = rest.slice(0, ansMatch.index).trim();

    const optIdx = rest.search(/\s[A-D]\)\s/);
    if (optIdx === -1) continue;

    const question = rest.slice(0, optIdx).trim();
    const optText = rest.slice(optIdx).trim();
    const opts = optText.split(/\s+(?=[A-D]\)\s)/).filter(Boolean);

    let html = '<div style="margin-bottom:1em;">\n';
    html += `<p style="margin:0 0 0.3em 0;"><strong>${esc(qNum)}.</strong> ${esc(question)}</p>\n`;
    for (const opt of opts) {
      html += `<p style="margin:0 0 0.15em 1.5em;">${esc(opt.trim())}</p>\n`;
    }
    if (answer) {
      html += `<p style="margin:0.3em 0 0 1.5em;"><strong>Answer: ${esc(answer)}</strong></p>\n`;
    }
    html += '</div>\n';
    items.push(html);
  }

  if (items.length < 2) return raw;
  return `\n\n<div class="mcq-exercises">\n${items.join('')}</div>\n\n`;
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isLikelyMalformedTable(tableLines: string[]): boolean {
  if (tableLines.length < 3) return false;
  const body = tableLines.slice(2);
  let longCellCount = 0;
  let proseCellCount = 0;
  let badKeywordRows = 0;

  for (const row of body) {
    const cells = splitMarkdownTableRow(row);
    const joined = cells.join(' ').toLowerCase();
    if (/(step\s*\d+|first normal form|second normal form|third normal form|exercise|answer:)/i.test(joined)) {
      badKeywordRows++;
    }
    for (const cell of cells) {
      if (cell.length >= 90) longCellCount++;
      const wordCount = cell.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 12 && /[.!?]/.test(cell)) proseCellCount++;
    }
  }

  // If table cells look like paragraphs/instructions, treat as malformed.
  return longCellCount >= 2 || proseCellCount >= 2 || badKeywordRows >= 2;
}

function flattenMalformedTables(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';
    const isTableStart =
      /^\|.*\|$/.test(line.trim()) &&
      /^\|[\s:\-|]+\|$/.test(next.trim());

    if (!isTableStart) {
      out.push(line);
      i++;
      continue;
    }

    const tableLines: string[] = [line, next];
    i += 2;
    while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
      tableLines.push(lines[i]);
      i++;
    }

    if (!isLikelyMalformedTable(tableLines)) {
      out.push(...tableLines);
      continue;
    }

    const plainRows = tableLines
      .filter((_, idx) => idx !== 1)
      .map((r) => splitMarkdownTableRow(r).filter(Boolean).join(' | '))
      .filter(Boolean);

    out.push('**Normalized Content (from malformed table):**');
    for (const r of plainRows) out.push(`- ${r}`);
    out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Remove common junk/artifact characters from LLM output (e.g. replacement chars, zero-width, encoding errors in bibliographies). */
function sanitizeMarkdown(md: string): string {
  if (!md || typeof md !== 'string') return md;
  return md
    .replace(/\uFFFD/g, '') // Unicode replacement character
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '') // Zero-width space, ZWJ, BOM, word joiner
    .replace(/\u00A0/g, ' ') // Non-breaking space -> normal space
    .replace(/[\u2010-\u2015]/g, '-') // Unicode dashes -> hyphen
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters (common in bibliographies)
    .trim();
}

function transformOutsideCodeFences(
  markdown: string,
  transform: (text: string) => string,
): string {
  const fenceRegex = /```[\s\S]*?```/g;
  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(markdown)) !== null) {
    const nonCode = markdown.slice(cursor, match.index);
    result += transform(nonCode);
    result += match[0];
    cursor = fenceRegex.lastIndex;
  }
  result += transform(markdown.slice(cursor));
  return result;
}

function normalizeMathHtmlArtifacts(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;

  return transformOutsideCodeFences(markdown, (segment) => {
    let out = segment;

    // Recover TeX from leaked KaTeX/MathML annotations.
    out = out.replace(
      /<annotation[^>]*application\/x-tex[^>]*>([\s\S]*?)<\/annotation>/gi,
      (_m, tex: string) => ` \\(${tex.trim()}\\) `,
    );

    // Remove common leaked KaTeX/MathML wrappers that should never appear as prose.
    out = out
      .replace(/<\/?(?:math|semantics|mrow|mi|mo|mn|mfrac|msup|msub|msubsup|annotation-xml)[^>]*>/gi, ' ')
      .replace(/<\/?span[^>]*class=["'][^"']*(?:katex|math-inline|math-display)[^"']*["'][^>]*>/gi, ' ')
      .replace(/<\/?div[^>]*class=["'][^"']*(?:katex|math-inline|math-display)[^"']*["'][^>]*>/gi, ' ');

    return out
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  });
}

function ensureBalancedCodeFences(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;
  const fenceCount = (markdown.match(/^```/gm) ?? []).length;
  if (fenceCount % 2 === 0) return markdown;
  return `${markdown.trimEnd()}\n\`\`\``;
}

function dedupeAdjacentBlocks(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;
  const blocks = markdown.split(/\n{2,}/);
  const kept: string[] = [];
  let prevNorm = '';
  for (const block of blocks) {
    const norm = block.replace(/[ \t]+/g, ' ').trim().toLowerCase();
    if (!norm) continue;
    if (norm === prevNorm) continue;
    kept.push(block.trim());
    prevNorm = norm;
  }
  return kept.join('\n\n');
}

function stripEmbeddedExercisesSection(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((line) => /^\s{0,3}#{0,3}\s*Exercises\s*$/i.test(line.trim()));
  if (idx === -1) return md;
  // Keep only summary content before an embedded Exercises section.
  return lines.slice(0, idx).join('\n').trim();
}

function formatRunOnGlossary(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const text = md.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  if (!/Glossary/i.test(text) || /(?:^\s*[-*]\s)|(?:^\s*\d+\.\s)/m.test(text)) return text.trim();

  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    if (/^Glossary$/i.test(trimmed)) {
      out.push(trimmed);
      continue;
    }
    const splitTerms = trimmed
      .replace(/\s+(?=[A-Z][A-Za-z0-9 ()\/,&'-]{2,50}\s-\s)/g, '\n')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (splitTerms.length >= 2) {
      for (const term of splitTerms) out.push(`- ${term}`);
    } else {
      out.push(line);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function formatRunOnBibliography(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const text = md.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  if (!/Bibliography/i.test(text) || /(?:^\s*[-*]\s)|(?:^\s*\d+\.\s)/m.test(text)) return text.trim();

  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    if (/^Bibliography$/i.test(trimmed) || /^(Books|Research Papers & Standards|Online Resources)$/i.test(trimmed)) {
      out.push(trimmed);
      continue;
    }
    const splitRefs = trimmed
      .replace(/"\s+(?=[A-Z][a-z]+,\s*[A-Z])/g, '"\n')
      .replace(/\.\s+(?=[A-Z][a-z]+,\s*[A-Z])/g, '.\n')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (splitRefs.length >= 2) {
      for (const ref of splitRefs) out.push(`- ${ref}`);
    } else {
      out.push(line);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Final pass for LLM-authored sections before assembly into the book stream. */
function sanitizeLlmSection(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const cleaned = sanitizeMarkdown(md);
  const noBadTables = flattenMalformedTables(cleaned);
  const mathNormalized = normalizeMathHtmlArtifacts(noBadTables);
  const balanced = ensureBalancedCodeFences(mathNormalized);
  return dedupeAdjacentBlocks(balanced);
}

const AUTHORS = [
  'Dr. M.S. Sadiq Sait, Ph.D',
  'Andrea Sait, M.Sc. (IT), M.Sc. (AI), M.Sc. (Psy), MBA',
  'Dr. Suriya Narayana Moorthy, Ph.D',
  'Dr. Srinath, Ph.D',
  'Dr. P. Prasanth, MCA, Ph.D',
  'Dr. M. Ilayaraja, Ph.D',
];

function pickAuthor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return AUTHORS[Math.abs(hash) % AUTHORS.length];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeTocText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCloud9LogoDataUrl(): string {
  const candidates = [
    path.join(__dirname, '..', 'cloud9_logo.jpeg'),
    path.join(process.cwd(), 'src', 'cloud9_logo.jpeg'),
    path.join(process.cwd(), 'cloud9_logo.jpeg'),
  ];
  for (const logoPath of candidates) {
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath);
        return 'data:image/jpeg;base64,' + buf.toString('base64');
      }
    } catch {
      // try next
    }
  }
  return '';
}

function toTitleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format ISBN-13 with hyphens per standard (3-1-3-5-1): prefix-group-registrant-publication-check. e.g. 9798893371000 → 979-8-893-37100-0 */
function formatIsbnWithHyphens(isbn: string): string {
  const digits = isbn.replace(/[\s-]/g, '');
  if (digits.length === 13 && /^\d+$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 12)}-${digits.slice(12)}`;
  }
  return isbn.trim();
}

function buildFrontMatterHtml(title: string, authorOverride?: string, isbn?: string): string {
  const author = authorOverride?.trim() ? authorOverride : pickAuthor(title);
  const year = new Date().getFullYear();
  const logoDataUrl = getCloud9LogoDataUrl();
  const displayTitle = toTitleCase(title);
  const safeTitle = escapeHtml(displayTitle);
  const safeAuthor = escapeHtml(author);

  const logoImg = logoDataUrl
    ? `<div class="cover-logo-wrap"><img src="${logoDataUrl}" alt="Cloud Nine Publishing House" class="cover-logo" /></div>`
    : '';

  // Page 1: Cover — title at top, author in vertical middle, logo at bottom (per reference)
  const cover = `<div class="cover-page">
<div class="cover-top"><h1>${safeTitle}</h1></div>
<div class="cover-spacer"></div>
<p class="author-line">${safeAuthor}</p>
<div class="cover-spacer"></div>
${logoImg}
</div>`;

  const rawIsbn = isbn?.trim() ?? '';
  const isbnFormatted = rawIsbn ? formatIsbnWithHyphens(rawIsbn) : '';
  const isbnDisplay = isbnFormatted ? escapeHtml(isbnFormatted) : '&nbsp;';

  // Catalog block always shown; ISBN line shows number or blank space when missing
  const catalogBlock = `
<div class="copyright-catalog-box">
<p class="copyright-catalog-title"><strong>Cataloging in Publication Data</strong></p>
<p class="copyright-catalog">${safeTitle} / Authored by: ${safeAuthor}</p>
<p class="copyright-catalog">pages cm</p>
<p class="copyright-catalog">Contributed articles.</p>
<p class="copyright-catalog">Includes citation and index.</p>
<p class="copyright-catalog">ISBN ${isbnDisplay}</p>
</div>`;

  // Page 2: Copyright — static text; ISBN line always shown (blank space when not provided)
  const copyright = `<div class="copyright-page">
<p class="publisher-intro">Published by:</p>
<p class="publisher-name"><strong>Cloud Nine Publishing House</strong></p>
<p class="publisher-address">34 Minebrook Road, Edison</p>
<p class="publisher-address">08820, New jersey usa</p>

<p class="copyright-year">©${year}</p>
<p class="copyright-all-rights"><strong>All rights reserved.</strong></p>

<p class="copyright-para">No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.</p>

<p class="copyright-heading"><strong>Limits of Liability / Disclaimer of Warranty:</strong></p>
<p class="copyright-para">The publisher and the author have used their best efforts in preparing this book. The publisher and author make no representations or warranties with respect to the accuracy or completeness of the contents of this book and specifically disclaim any implied warranties of merchantability or fitness for a particular purpose. The advice and strategies contained herein may not be suitable for every situation. Neither the publisher nor the author shall be liable for any loss of profit or any other commercial damages, including but not limited to special, incidental, consequential, or other damages.</p>

<p class="copyright-heading"><strong>Trademarks:</strong></p>
<p class="copyright-para">All brand names and product names used in this book are trademarks, registered trademarks, or trade names of their respective holders.</p>

<p class="copyright-book-title">${safeTitle}</p>
<p class="copyright-author">${safeAuthor}</p>
<p class="copyright-isbn">ISBN: ${isbnDisplay}</p>
${catalogBlock}
</div>`;

  return cover + '\n' + copyright;
}

/**
 * The front matter (cover + copyright) is raw HTML that gets injected directly
 * into the Markdown stream. Marked will pass it through as-is because it
 * recognises block-level HTML.
 */
function assembleParts(session: SessionState, getSubtopic: (u: number, s: number) => string | null): string {
  const structure = session.structure;
  if (!structure) return '';
  const parts: string[] = [];

  // 1. Cover + Copyright (raw HTML block)
  parts.push(buildFrontMatterHtml(structure.title, session.author, session.isbn));

  // 2. Preface (LLM-generated Markdown — starts on a new page, before TOC)
  if (session.prefaceMarkdown) {
    parts.push('\n\n<div style="page-break-before: always;"></div>\n\n');
    parts.push(sanitizeLlmSection(session.prefaceMarkdown));
  }

  // 3. Table of Contents (new page, clean numbered entries — raw HTML)
  const tocParts: string[] = [
    '<div style="page-break-before:always;"></div>',
    '<div class="toc">',
    '<h2 id="table-of-contents">Table of Contents</h2>',
    '<div class="toc-list">',
  ];
  for (let u = 0; u < structure.units.length; u++) {
    const unitNum = u + 1;
    const unit = structure.units[u];
    const unitSlug = slugify(`unit-${unitNum}-${unit.unitTitle}`);
    tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#${unitSlug}">${escapeTocText(`Unit ${unitNum}: ${unit.unitTitle}`)}</a></p>`);
    for (let s = 0; s < unit.subtopics.length; s++) {
      const sub = unit.subtopics[s];
      const subSlug = slugify(`${unitNum}-${s + 1}-${sub}`);
      tocParts.push(`<p style="margin:0.15em 0;padding-left:1.5em;font-size:10pt;"><a href="#${subSlug}">${escapeTocText(`${unitNum}.${s + 1} ${sub}`)}</a></p>`);
    }
    tocParts.push(`<p style="margin:0.15em 0;padding-left:1.5em;font-size:10pt;"><a href="#${slugify(`summary-${unitNum}`)}">Summary</a></p>`);
    tocParts.push(`<p style="margin:0.15em 0;padding-left:1.5em;font-size:10pt;"><a href="#${slugify(`exercises-${unitNum}`)}">Exercises</a></p>`);
  }
  tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#capstone-projects">${escapeTocText('Capstone Projects')}</a></p>`);
  tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#case-studies">${escapeTocText('Case Studies')}</a></p>`);
  tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#glossary">${escapeTocText('Glossary')}</a></p>`);
  tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#bibliography">${escapeTocText('Bibliography')}</a></p>`);
  tocParts.push('</div></div>');
  parts.push(tocParts.join('\n') + '\n');

  // 4. Unit content
  for (let u = 0; u < structure.units.length; u++) {
    const unit = structure.units[u];
    parts.push(`# Unit ${u + 1}: ${unit.unitTitle}\n`);

    // 4a. Unit Introduction
    const intro = session.unitIntroductions[u];
    if (intro) {
      parts.push(sanitizeLlmSection(intro));
    }

    // 4b. Subtopics
    for (let s = 0; s < unit.subtopics.length; s++) {
      const md = getSubtopic(u, s);
      if (md) parts.push(sanitizeLlmSection(md));
    }

    // 4c. Unit End Summary
    const endSummary = session.unitEndSummaries[u];
    if (endSummary) {
      parts.push(sanitizeLlmSection(stripEmbeddedExercisesSection(endSummary)));
    }

    // 4d. Unit Exercises (raw HTML so the PDF renderer cannot collapse them)
    const exercises = session.unitExercises[u];
    if (exercises) {
      parts.push(formatMcqAsHtml(exercises));
    }
  }

  // 5. Capstone Projects
  if (session.capstonesMarkdown) {
    parts.push(sanitizeLlmSection(session.capstonesMarkdown));
  }

  // 6. Case Studies
  if (session.caseStudiesMarkdown) {
    parts.push(sanitizeLlmSection(session.caseStudiesMarkdown));
  }

  // 7. Glossary
  if (session.glossaryMarkdown) {
    parts.push(sanitizeLlmSection(formatRunOnGlossary(session.glossaryMarkdown)));
  }

  // 8. Bibliography (sanitize to remove junk/artifact characters common in LLM output)
  if (session.bibliographyMarkdown) {
    parts.push(sanitizeLlmSection(formatRunOnBibliography(session.bibliographyMarkdown)));
  }

  return parts.join('\n\n');
}

export function buildFinalMarkdown(session: SessionState): string {
  const raw = assembleParts(session, (u, s) => {
    return session.subtopicMarkdowns.get(`u${u}-s${s}`) ?? null;
  });
  return sanitizeMarkdown(raw);
}

export function rebuildFinalMarkdown(session: SessionState): string {
  const raw = assembleParts(session, (u, s) => {
    return session.subtopicMarkdowns.get(`u${u}-s${s}`) ?? null;
  });
  return sanitizeMarkdown(raw);
}
