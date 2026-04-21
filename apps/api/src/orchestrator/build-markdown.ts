import fs from 'fs';
import path from 'path';
import { SessionState } from '@/lib/types';

/** Ensure Option A is never on the same line as the question (MCQ formatting). */
function ensureNewlineBeforeOptionA(md: string): string {
  if (!md || typeof md !== 'string') return md;
  return md.replace(/([.?])\s*A\)/g, '$1\n\nA)');
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

function sanitizeBibliographyGibberish(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const lines = md.split('\n');
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const plain = line.replace(/^[-*]\s+/, '').trim();

    const hasInitialSpam = /(?:\b[A-Z]\.\s*,?\s*){12,}/.test(plain);
    const tooLong = plain.length > 320;

    let lowDiversity = false;
    const words = plain.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    if (words.length >= 20) {
      const uniqueRatio = new Set(words).size / words.length;
      lowDiversity = uniqueRatio < 0.35;
    }

    if (hasInitialSpam || tooLong || lowDiversity) {
      continue;
    }
    cleaned.push(rawLine);
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
  let t = s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  // Book-style title: lowercase conjunctions after commas / in compound subtitles (e.g. "Training, and Optimization")
  t = t.replace(/([,:;])\s*(And|Or|Nor|But|Of|In|On|At|To|For|As|By)\b/g, (_, punct, w) => `${punct} ${w.toLowerCase()}`);
  t = t.replace(/:\s*(And|Or|Nor|But)\b/g, (_, w) => `: ${w.toLowerCase()}`);
  // Medial conjunctions: "Transformers And Attention" -> "Transformers and Attention"
  t = t.replace(/\b(\w+)\s+(And|Or|Nor|But)\s+(\w+)\b/g, (_, a, w, b) => `${a} ${w.toLowerCase()} ${b}`);
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
    const colon = t.indexOf(':');
    if (colon !== -1 && colon + 2 < t.length) {
      const after = t.slice(colon + 1).trimStart();
      if (after.length > 0) {
        t = t.slice(0, colon + 1) + ' ' + after.charAt(0).toUpperCase() + after.slice(1);
      }
    }
  }
  return t;
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
  const isbnFormatted = rawIsbn && /\d/.test(rawIsbn) ? formatIsbnWithHyphens(rawIsbn) : '';
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

// ── Fence-aware helpers ──

/** Languages whose fenced blocks should be removed entirely */
const BANNED_FENCE_LANGS = /^(html?|xml|svg|xhtml|output)$/i;

/** Languages whose fenced blocks are kept for rendering */
const KEPT_FENCE_RE = /^(python|javascript|typescript|java|c|cpp|csharp|go|rust|ruby|php|swift|kotlin|sql|bash|sh|shell|json|yaml|css|r|scala|perl|lua|powershell|text)$/i;

interface FencedBlock {
  lang: string;
  body: string[];
  startIdx: number;
}

/**
 * Parse markdown line-by-line into fenced blocks and prose regions.
 * Returns an array of segments: { fenced: true, lang, lines } or { fenced: false, lines }.
 * This NEVER uses greedy regex across fence boundaries.
 */
function parseFences(md: string): Array<{ fenced: boolean; lang: string; lines: string[] }> {
  const result: Array<{ fenced: boolean; lang: string; lines: string[] }> = [];
  const lines = md.split('\n');
  let proseBuf: string[] = [];
  let currentFence: FencedBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!currentFence) {
      const fenceMatch = trimmed.match(/^```(\S*)/);
      if (fenceMatch) {
        if (proseBuf.length > 0) {
          result.push({ fenced: false, lang: '', lines: proseBuf });
          proseBuf = [];
        }
        currentFence = { lang: fenceMatch[1] || '', body: [], startIdx: i };
      } else {
        proseBuf.push(line);
      }
    } else {
      if (trimmed === '```') {
        result.push({ fenced: true, lang: currentFence.lang, lines: currentFence.body });
        currentFence = null;
      } else {
        currentFence.body.push(line);
      }
    }
  }

  // Unclosed fence: flush body back as prose (the fence was broken)
  if (currentFence) {
    proseBuf.push('```' + currentFence.lang);
    proseBuf.push(...currentFence.body);
  }
  if (proseBuf.length > 0) {
    result.push({ fenced: false, lang: '', lines: proseBuf });
  }

  return result;
}

function htmlToPlainText(html: string): string {
  let t = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/(p|div|h[1-6]|li|tr)\s*>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return t.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

function stripRawHtmlFromProse(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<div\s+class="rendered-html-output"[^>]*>[\s\S]*?<\/div>/gi, '');
  const blockPair = /<(svg|canvas|iframe|section|article)\b[^>]*>[\s\S]*?<\/\1>/gi;
  for (let i = 0; i < 25; i++) { const next = cleaned.replace(blockPair, ''); if (next === cleaned) break; cleaned = next; }
  for (let i = 0; i < 35; i++) { const next = cleaned.replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi, ''); if (next === cleaned) break; cleaned = next; }
  for (let i = 0; i < 25; i++) { const next = cleaned.replace(/<span\b[^>]*>[\s\S]*?<\/span>/gi, ''); if (next === cleaned) break; cleaned = next; }
  cleaned = cleaned.replace(/<\/?(?:img|br|hr|input|embed|object|wbr|source|track|col|meta|link|base|area)\b[^>]*\/?>/gi, '');
  cleaned = cleaned.replace(/<div\b[^>]*page-break[^>]*>\s*<\/div>/gi, '');
  cleaned = cleaned.replace(/^<\/(?:div|span|section|article)>\s*$/gim, '');
  return cleaned;
}

function stripDiagramHeadings(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(
    /^#{1,3}\s+(?:Example of .+(?:Implementation|Layout|Output|Rendering)|(?:Rendered|HTML|Expected)\s+Output|(?:Visual|Diagram)\s+(?:Representation|Illustration|Example)).*$\n*/gim,
    '',
  );
  cleaned = cleaned.replace(
    /^(?:The (?:following|expected|above) (?:code snippet|layout|output|HTML|example|diagram)[\s\S]*?\.)\s*$/gm,
    '',
  );
  return cleaned;
}

/**
 * Fence-aware stripping of LLM artifacts. Processes code fences one at a time
 * so we NEVER accidentally eat the closing ``` of a legitimate code block.
 */
function stripLlmHtmlArtifacts(md: string): string {
  if (!md || typeof md !== 'string') return md;

  const segments = parseFences(md);
  const outputParts: string[] = [];

  for (const seg of segments) {
    if (!seg.fenced) {
      let prose = seg.lines.join('\n');
      prose = stripRawHtmlFromProse(prose);
      prose = stripDiagramHeadings(prose);
      outputParts.push(prose);
    } else {
      const langLower = seg.lang.toLowerCase();

      // Banned fences: html, xml, svg, output — remove entirely (extract text from html)
      if (BANNED_FENCE_LANGS.test(langLower)) {
        if (/^html?$/i.test(langLower)) {
          const plain = htmlToPlainText(seg.lines.join('\n'));
          if (plain) outputParts.push('\n\n' + plain + '\n\n');
        }
        continue;
      }

      // Kept fences: real programming languages — preserve with proper fence markers
      outputParts.push('```' + seg.lang + '\n' + seg.lines.join('\n') + '\n```');
    }
  }

  let result = outputParts.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

/**
 * Ensure fenced code blocks and GFM pipe tables have blank lines before/after them
 * so `marked` recognises them as block-level elements instead of inline text.
 */
function ensureBlockBoundaries(md: string): string {
  if (!md || typeof md !== 'string') return md;
  let out = md;
  // Blank line before ``` fences that aren't already preceded by one
  out = out.replace(/([^\n])\n(```)/g, '$1\n\n$2');
  // Blank line after closing ``` fences
  out = out.replace(/(```)\n([^\n])/g, '$1\n\n$2');
  // Blank line before GFM pipe-table rows (first row starting with |) when preceded by text
  out = out.replace(/([^\n|])\n(\|[^\n]+\|)/g, '$1\n\n$2');
  // Blank line after last pipe-table row before non-table text
  out = out.replace(/(\|[^\n]+\|)\n([^\n|])/g, '$1\n\n$2');
  // Blank line before headings (##, ###) when preceded by non-blank line
  out = out.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  // Blank line after closing </div> before markdown content
  out = out.replace(/(<\/div>)\n(?!\n)/g, '$1\n\n');
  // Blank line before bullet/numbered lists when preceded by text (not another list item)
  out = out.replace(/([^\n-*\d])\n([-*]\s)/g, '$1\n\n$2');
  out = out.replace(/([^\n\d])\n(\d+\.\s)/g, '$1\n\n$2');
  return out;
}

// ── Segment types: raw HTML (pass-through) vs Markdown (needs parsing) ──

export interface ContentSegment {
  type: 'html' | 'md';
  content: string;
}

function htmlSeg(content: string): ContentSegment { return { type: 'html', content }; }
function mdSeg(content: string): ContentSegment { return { type: 'md', content }; }

function cleanMd(raw: string): string {
  return ensureBlockBoundaries(stripLlmHtmlArtifacts(raw));
}

/**
 * Build the book as an ordered list of segments. Raw HTML (cover, copyright,
 * page-break divs, TOC) is kept separate from Markdown content so the renderer
 * can parse each markdown segment independently — preventing CommonMark HTML
 * block rules from swallowing subsequent markdown.
 */
function assembleSegments(session: SessionState, getSubtopic: (u: number, s: number) => string | null): ContentSegment[] {
  const structure = session.structure;
  if (!structure) return [];
  const segments: ContentSegment[] = [];

  // 1. Cover + Copyright (raw HTML)
  segments.push(htmlSeg(buildFrontMatterHtml(structure.title, session.author, session.isbn)));

  // 2. Preface (Markdown, with page-break before)
  if (session.prefaceMarkdown) {
    segments.push(htmlSeg('<div style="page-break-before: always;"></div>'));
    segments.push(mdSeg(cleanMd(session.prefaceMarkdown)));
  }

  // 3. Table of Contents (raw HTML)
  const ingest = !!session.ingestMode;
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
    if (!ingest) {
      tocParts.push(`<p style="margin:0.15em 0;padding-left:1.5em;font-size:10pt;"><a href="#${slugify(`summary-${unitNum}`)}">Summary</a></p>`);
      tocParts.push(`<p style="margin:0.15em 0;padding-left:1.5em;font-size:10pt;"><a href="#${slugify(`exercises-${unitNum}`)}">Exercises</a></p>`);
    }
  }
  if (!ingest) {
    tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#capstone-projects">${escapeTocText('Capstone Projects')}</a></p>`);
    tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#case-studies">${escapeTocText('Case Studies')}</a></p>`);
    tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#glossary">${escapeTocText('Glossary')}</a></p>`);
    tocParts.push(`<p style="margin:0.35em 0;font-weight:bold;"><a href="#bibliography">${escapeTocText('Bibliography')}</a></p>`);
  }
  tocParts.push('</div></div>');
  segments.push(htmlSeg(tocParts.join('\n')));

  // 4. Unit content
  for (let u = 0; u < structure.units.length; u++) {
    const unit = structure.units[u];

    if (ingest) {
      segments.push(htmlSeg('<div style="page-break-before: always;"></div>'));
      const intro = session.unitIntroductions[u];
      const introMd = intro ? cleanMd(intro) : '';
      const lead = `# Unit ${u + 1}: ${unit.unitTitle}${introMd ? `\n\n${introMd}` : ''}`;
      segments.push(mdSeg(lead));

      for (let s = 0; s < unit.subtopics.length; s++) {
        const md = getSubtopic(u, s);
        if (!md) continue;
        if (session.ingestPremium) {
          segments.push(htmlSeg('<div style="page-break-before: always;"></div>'));
        }
        segments.push(mdSeg(cleanMd(md)));
      }

      const endSummary = session.unitEndSummaries[u];
      if (endSummary) segments.push(mdSeg(cleanMd(endSummary)));

      const exercises = session.unitExercises[u];
      if (exercises) segments.push(mdSeg(cleanMd(ensureNewlineBeforeOptionA(exercises))));
    } else {
      const unitParts: string[] = [`# Unit ${u + 1}: ${unit.unitTitle}\n`];

      const intro = session.unitIntroductions[u];
      if (intro) unitParts.push(cleanMd(intro));

      for (let s = 0; s < unit.subtopics.length; s++) {
        const md = getSubtopic(u, s);
        if (md) unitParts.push(cleanMd(md));
      }

      const endSummary = session.unitEndSummaries[u];
      if (endSummary) unitParts.push(cleanMd(endSummary));

      const exercises = session.unitExercises[u];
      if (exercises) unitParts.push(cleanMd(ensureNewlineBeforeOptionA(exercises)));

      segments.push(mdSeg(unitParts.join('\n\n')));
    }
  }

  // 5. Capstone Projects
  if (!ingest && session.capstonesMarkdown) segments.push(mdSeg(cleanMd(session.capstonesMarkdown)));

  // 6. Case Studies
  if (!ingest && session.caseStudiesMarkdown) segments.push(mdSeg(cleanMd(session.caseStudiesMarkdown)));

  // 7. Glossary
  if (!ingest && session.glossaryMarkdown) segments.push(mdSeg(cleanMd(session.glossaryMarkdown)));

  // 8. Bibliography
  if (!ingest && session.bibliographyMarkdown) {
    segments.push(mdSeg(
      sanitizeBibliographyGibberish(sanitizeMarkdown(stripLlmHtmlArtifacts(session.bibliographyMarkdown))),
    ));
  }

  return segments;
}

// ── Legacy: flat markdown string (for session.finalMarkdown) ──

function segmentsToFlatMarkdown(segments: ContentSegment[]): string {
  return ensureBlockBoundaries(
    segments.map((s) => s.content).join('\n\n'),
  );
}

export function buildSegments(session: SessionState): ContentSegment[] {
  if (!session.structure && session.ingestSections && session.ingestSections.length > 0) {
    return session.ingestSections.map((sec) => mdSeg(cleanMd(sec.markdown)));
  }
  return assembleSegments(session, (u, s) => {
    return session.subtopicMarkdowns.get(`u${u}-s${s}`) ?? null;
  });
}

export function buildFinalMarkdown(session: SessionState): string {
  return sanitizeMarkdown(segmentsToFlatMarkdown(buildSegments(session)));
}

export function rebuildFinalMarkdown(session: SessionState): string {
  return sanitizeMarkdown(segmentsToFlatMarkdown(buildSegments(session)));
}
