import { SessionState } from '@/lib/types';

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

function buildFrontMatterHtml(title: string, authorOverride?: string): string {
  const author = authorOverride?.trim() ? authorOverride : pickAuthor(title);
  const year = new Date().getFullYear();

  const cover = `<div class="cover-page">
<h1>${title}</h1>
<p class="author-line">Authored by: ${author}</p>
<p class="edition-line">Edition: ${year}</p>
</div>`;

  const copyright = `<div class="copyright-page">

<p><strong>All rights reserved.</strong></p>

<p>No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.</p>

<p><strong>Limits of Liability / Disclaimer of Warranty:</strong> The publisher and the author have used their best efforts in preparing this book. The publisher and author make no representations or warranties with respect to the accuracy or completeness of the contents of this book and specifically disclaim any implied warranties of merchantability or fitness for a particular purpose. The advice and strategies contained herein may not be suitable for every situation. Neither the publisher nor the author shall be liable for any loss of profit or any other commercial damages, including but not limited to special, incidental, consequential, or other damages.</p>

<p><strong>Trademarks:</strong> All brand names and product names used in this book are trademarks, registered trademarks, or trade names of their respective holders.</p>

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
  parts.push(buildFrontMatterHtml(structure.title, session.author));

  // 2. Preface (LLM-generated Markdown — placed before TOC, not listed in TOC)
  if (session.prefaceMarkdown) {
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

    // 4d. Unit Exercises
    const exercises = session.unitExercises[u];
    if (exercises) {
      parts.push(exercises);
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

  // 8. Bibliography
  if (session.bibliographyMarkdown) {
    parts.push(session.bibliographyMarkdown);
  }

  return parts.join('\n\n');
}

export function buildFinalMarkdown(session: SessionState): string {
  const result = assembleParts(session, (u, s) => {
    return session.subtopicMarkdowns.get(`u${u}-s${s}`) ?? null;
  });

  session.unitMarkdowns = [];
  session.microSummaries = [];
  session.unitSummaries = [];

  return result;
}

export function rebuildFinalMarkdown(session: SessionState): string {
  return assembleParts(session, (u, s) => {
    return session.subtopicMarkdowns.get(`u${u}-s${s}`) ?? null;
  });
}
