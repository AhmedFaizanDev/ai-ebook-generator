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
  const isbnLine = isbnFormatted ? escapeHtml(isbnFormatted) : '';
  const catalogBlock =
    rawIsbn
      ? `
<div class="copyright-catalog-box">
<p class="copyright-catalog-title"><strong>Cataloging in Publication Data</strong></p>
<p class="copyright-catalog">${safeTitle} / Authored by: ${safeAuthor}</p>
<p class="copyright-catalog">pages cm</p>
<p class="copyright-catalog">Contributed articles.</p>
<p class="copyright-catalog">Includes citation and index.</p>
<p class="copyright-catalog">ISBN ${escapeHtml(isbnFormatted)}</p>
</div>`
      : '';

  // Page 2: Copyright — static text exactly as reference PDF; only variables: year, title, author, ISBN
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
${isbnLine ? `<p class="copyright-isbn">ISBN: ${isbnLine}</p>` : ''}
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
    parts.push(session.prefaceMarkdown);
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
      parts.push(intro);
    }

    // 4b. Subtopics
    for (let s = 0; s < unit.subtopics.length; s++) {
      const md = getSubtopic(u, s);
      if (md) parts.push(md);
    }

    // 4c. Unit End Summary
    const endSummary = session.unitEndSummaries[u];
    if (endSummary) {
      parts.push(endSummary);
    }

    // 4d. Unit Exercises (ensure Option A is on its own line)
    const exercises = session.unitExercises[u];
    if (exercises) {
      parts.push(ensureNewlineBeforeOptionA(exercises));
    }
  }

  // 5. Capstone Projects
  if (session.capstonesMarkdown) {
    parts.push(session.capstonesMarkdown);
  }

  // 6. Case Studies
  if (session.caseStudiesMarkdown) {
    parts.push(session.caseStudiesMarkdown);
  }

  // 7. Glossary
  if (session.glossaryMarkdown) {
    parts.push(session.glossaryMarkdown);
  }

  // 8. Bibliography (sanitize to remove junk/artifact characters common in LLM output)
  if (session.bibliographyMarkdown) {
    parts.push(sanitizeMarkdown(session.bibliographyMarkdown));
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
