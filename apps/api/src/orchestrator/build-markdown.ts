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
 * Strip ALL fenced ```html / ```htm blocks unconditionally.
 * These never render correctly in PDF/DOCX — they produce empty bordered boxes.
 * Any readable text inside is extracted as plain prose so meaning is preserved.
 */
function stripAllHtmlFences(md: string): string {
  if (!md || typeof md !== 'string') return md;
  return md.replace(/```\s*html?\s*\n([\s\S]*?)\n```/gi, (_match, inner: string) => {
    let t = inner
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    t = t.replace(/<br\s*\/?>/gi, '\n');
    t = t.replace(/<\/(p|div|h[1-6]|li|tr)\s*>/gi, '\n');
    t = t.replace(/<[^>]+>/g, '');
    t = t
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    const plain = t
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');
    return plain ? `\n\n${plain}\n\n` : '\n\n';
  });
}

/**
 * Apply a string transform only outside fenced code blocks (``` ... ```),
 * so we do not strip tags that are part of ```html / ```svg source.
 */
function mapOutsideCodeFences(md: string, mapFn: (s: string) => string): string {
  const fenceRe = /^```[^\n]*\n[\s\S]*?\n```\s*(?=\n|$)/gm;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  fenceRe.lastIndex = 0;
  while ((m = fenceRe.exec(md)) !== null) {
    out += mapFn(md.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += mapFn(md.slice(last));
  return out;
}

function stripRawHtmlTagsOutsideFences(md: string): string {
  return mapOutsideCodeFences(md, (segment) => {
    let cleaned = segment;
    const blockPair = /<(svg|canvas|iframe|section|article)\b[^>]*>[\s\S]*?<\/\1>/gi;
    for (let i = 0; i < 25; i++) {
      const next = cleaned.replace(blockPair, '');
      if (next === cleaned) break;
      cleaned = next;
    }
    for (let i = 0; i < 35; i++) {
      const next = cleaned.replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi, '');
      if (next === cleaned) break;
      cleaned = next;
    }
    for (let i = 0; i < 25; i++) {
      const next = cleaned.replace(/<span\b[^>]*>[\s\S]*?<\/span>/gi, '');
      if (next === cleaned) break;
      cleaned = next;
    }
    cleaned = cleaned.replace(
      /<\/?(?:img|br|hr|input|embed|object|wbr|source|track|col|meta|link|base|area)\b[^>]*\/?>/gi,
      '',
    );
    return cleaned;
  });
}

/**
 * Strip HTML/markup from LLM-generated markdown chunks only (not cover/TOC).
 * Removes fenced html/xml/svg blocks, raw tags (div, svg, etc.), and diagram-ish headings.
 * Preserves GFM pipe tables and fenced code blocks that `marked` needs.
 */
function stripLlmHtmlArtifacts(md: string): string {
  if (!md || typeof md !== 'string') return md;
  let cleaned = md;

  // Strip ALL ```html fences and their paired ```output blocks — they never render correctly in PDF/DOCX
  cleaned = cleaned.replace(
    /```html?\s*\n[\s\S]*?\n```\s*\n```\s*output\s*\n[\s\S]*?\n```/gi,
    '',
  );
  cleaned = stripAllHtmlFences(cleaned);

  cleaned = cleaned.replace(/```(?:xml|svg|xhtml)\s*\n[\s\S]*?\n```/gi, '');
  cleaned = cleaned.replace(/```\s*output\s*\n[\s\S]*?\n```/gi, '');

  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  cleaned = cleaned.replace(/<div\s+class="rendered-html-output"[^>]*>[\s\S]*?<\/div>/gi, '');

  cleaned = stripRawHtmlTagsOutsideFences(cleaned);

  cleaned = cleaned.replace(/<div\b[^>]*page-break[^>]*>\s*<\/div>/gi, '');
  cleaned = cleaned.replace(/^<\/(?:div|span|section|article)>\s*$/gim, '');

  cleaned = cleaned.replace(
    /^#{1,3}\s+(?:Example of .+(?:Implementation|Layout|Output|Rendering)|(?:Rendered|HTML|Expected)\s+Output|(?:Visual|Diagram)\s+(?:Representation|Illustration|Example)).*$\n*/gim,
    '',
  );
  cleaned = cleaned.replace(
    /^(?:The (?:following|expected|above) (?:code snippet|layout|output|HTML|example|diagram)[\s\S]*?\.)\s*$/gm,
    '',
  );

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned;
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
  segments.push(htmlSeg(tocParts.join('\n')));

  // 4. Unit content
  for (let u = 0; u < structure.units.length; u++) {
    const unit = structure.units[u];
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

  // 5. Capstone Projects
  if (session.capstonesMarkdown) segments.push(mdSeg(cleanMd(session.capstonesMarkdown)));

  // 6. Case Studies
  if (session.caseStudiesMarkdown) segments.push(mdSeg(cleanMd(session.caseStudiesMarkdown)));

  // 7. Glossary
  if (session.glossaryMarkdown) segments.push(mdSeg(cleanMd(session.glossaryMarkdown)));

  // 8. Bibliography
  if (session.bibliographyMarkdown) {
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
