export const PRINT_CSS = `
@page {
  size: 210mm 297mm;
  margin: 2cm 2cm 2.5cm 2cm;
}
* {
  box-sizing: border-box;
}
html, body {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
}
body {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 11pt;
  line-height: 1.65;
  color: #1a1a1a;
}
h1 {
  page-break-before: always;
  font-size: 22pt;
  margin-top: 1cm;
  margin-bottom: 0.5cm;
  padding-bottom: 0.4cm;
  border-bottom: 2px solid #333;
  page-break-after: avoid;
}
h1:first-child {
  page-break-before: avoid;
}
h2 {
  font-size: 16pt;
  margin-top: 1.2cm;
  margin-bottom: 0.4cm;
  page-break-after: avoid;
}
h3 {
  font-size: 13pt;
  margin-top: 0.8cm;
  margin-bottom: 0.3cm;
  page-break-after: avoid;
}
h4 {
  font-size: 11pt;
  margin-top: 0.6cm;
  page-break-after: avoid;
}
p {
  margin: 0.4em 0;
  text-align: justify;
  orphans: 3;
  widows: 3;
}
strong {
  font-weight: bold;
}
pre {
  background: #f6f6f6;
  padding: 10px 14px;
  border-radius: 4px;
  border-left: 3px solid #ccc;
  font-size: 8.5pt;
  line-height: 1.4;
  overflow-x: visible;
  white-space: pre-wrap;
  word-wrap: break-word;
  page-break-inside: avoid;
}
pre.ascii-diagram {
  background: #fff;
  border: 1px solid #ddd;
  border-left: 3px solid #999;
  font-family: 'Consolas', 'Courier New', monospace;
  page-break-inside: avoid;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 10pt;
  page-break-inside: auto;
}
thead {
  display: table-header-group;
}
tbody tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
th {
  background: #f0f0f0;
  font-weight: bold;
}
th, td {
  border: 1px solid #ccc;
  padding: 6px 10px;
  text-align: left;
  vertical-align: top;
  word-break: break-word;
  hyphens: auto;
}
code {
  font-family: 'Consolas', monospace;
  font-size: 9pt;
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
}
pre code {
  background: none;
  padding: 0;
  font-size: inherit;
}
blockquote {
  border-left: 3px solid #ccc;
  margin: 0.8em 0;
  padding: 0.5em 1em;
  color: #555;
}
ul, ol {
  margin: 0.4em 0;
  padding-left: 2em;
}
ol {
  list-style-type: decimal;
}
ol ol {
  list-style-type: lower-alpha;
}
li {
  margin: 0.2em 0;
}
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1.5em 0;
}
a {
  color: #1a1a1a;
  text-decoration: none;
}

/* --- Title / Copyright page (A4 content area: 170mm x 252mm), match reference PDF --- */
.cover-page {
  page-break-after: always;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 24.2cm;
  width: 100%;
  padding-top: 0.8cm;
}
.cover-page .cover-top {
  flex-shrink: 0;
}
.cover-page h1 {
  page-break-before: avoid;
  border-bottom: none;
  font-size: 28pt;
  margin-bottom: 0;
  line-height: 1.25;
  font-weight: bold;
  text-wrap: balance;
  max-width: 100%;
  hyphens: manual;
  text-align: center;
}
.cover-page .cover-spacer {
  flex: 1;
  min-height: 0.5cm;
}
.cover-page .author-line {
  flex-shrink: 0;
  font-size: 13pt;
  margin: 0;
  font-weight: bold;
  text-align: center;
  width: 100%;
}
.cover-page .cover-logo-wrap {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 1.5cm;
}
.cover-page .cover-logo {
  max-width: 5.5cm;
  max-height: 3cm;
  width: auto;
  height: auto;
  object-fit: contain;
}

/* --- Copyright page — full-page layout: content at top, catalog box at bottom, centered --- */
/* Reference: (1) Headers largest: Published by, ©year, All rights, Limits..., Trademarks, Cataloging title
   (2) Medium: publisher name/address, book title, author, ISBN  (3) Smallest: legal paras, catalog content */
.copyright-page {
  page-break-after: always;
  page-break-inside: avoid;
  font-size: 10pt;
  line-height: 1.4;
  padding-top: 0.6cm;
  padding-bottom: 0.8cm;
  padding-left: 0;
  padding-right: 0;
  text-align: left;
  display: flex;
  flex-direction: column;
  min-height: 24.2cm;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.copyright-page p {
  text-align: left;
  margin: 0.2em 0;
}
/* Tier 1 — Section headers: slightly larger */
.copyright-page .publisher-intro {
  font-size: 11.5pt;
  font-weight: normal;
  margin: 0 0 0.5em 0;
}
/* Tier 2 — Publisher name and address: medium size; noticeable gap after "Published by:" */
.copyright-page .publisher-name {
  font-size: 10.5pt;
  font-weight: normal;
  margin: 0.15em 0 0.08em 0;
  padding-left: 0.5em;
}
.copyright-page .publisher-name strong {
  font-weight: normal;
}
.copyright-page .publisher-address {
  font-size: 10.5pt;
  font-weight: normal;
  font-style: normal;
  margin: 0.06em 0;
  padding-left: 0.5em;
  color: #1a1a1a;
}
/* © year — Tier 1; more space above to spread content */
.copyright-page .copyright-year {
  font-size: 11.5pt;
  font-weight: normal;
  margin: 1.8em 0 0.2em 0;
}
/* All rights reserved. — Tier 1 */
.copyright-page .copyright-all-rights {
  font-size: 11.5pt;
  font-weight: normal;
  margin: 0 0 0.5em 0;
}
.copyright-page .copyright-all-rights strong {
  font-weight: normal;
}
/* Tier 3 — Disclaimer paragraphs: smallest, justified; more vertical spacing */
.copyright-page .copyright-para {
  text-align: justify;
  margin: 0.65em 0;
  font-size: 9pt;
  line-height: 1.35;
}
/* Section headings — Tier 1, bold; more space above to utilize page */
.copyright-page .copyright-heading {
  margin: 1.6em 0 0.25em 0;
  font-size: 11.5pt;
  font-weight: bold;
}
.copyright-page .copyright-heading + .copyright-para {
  margin-top: 0.2em;
}
/* Book title, author, ISBN — Tier 2 (medium); more space above block */
.copyright-page .copyright-book-title {
  font-size: 10.5pt;
  font-weight: normal;
  margin: 1.8em 0 0.08em 0;
}
.copyright-page .copyright-author,
.copyright-page .copyright-isbn {
  font-size: 10.5pt;
  font-weight: normal;
  margin: 0.06em 0;
}
/* Cataloging box — pushed to bottom of page, full width edge-to-edge (left to right margin) */
.copyright-page .copyright-catalog-box {
  border: 1px solid #000;
  padding: 0.5em 0.7em;
  padding-left: 0.75em;
  margin-top: auto;
  margin-left: 0 !important;
  margin-right: 0 !important;
  margin-bottom: 0;
  width: 100% !important;
  max-width: none !important;
  min-width: 100%;
  font-size: 9pt;
  box-sizing: border-box;
  display: block;
}
.copyright-page .copyright-catalog-title {
  margin: 0 0 0.2em 0;
  font-size: 11.5pt;
  font-weight: bold;
}
.copyright-page .copyright-catalog {
  font-size: 9pt;
  margin: 0.12em 0;
  color: #1a1a1a;
}
.copyright-page .copyright-footer {
  margin-top: 3cm;
  text-align: center;
  font-style: italic;
  color: #777;
  font-size: 9pt;
}

/* --- Table of Contents (starts on new page, no bullets) --- */
.toc-page-break {
  page-break-before: always;
}
.toc {
  page-break-after: always;
}
.toc .toc-list,
.toc ul,
.toc ol {
  list-style: none !important;
  list-style-type: none !important;
  padding-left: 0;
  margin-left: 0;
}
.toc li {
  margin: 0.3em 0;
  list-style: none !important;
  list-style-type: none !important;
}
.toc li li {
  padding-left: 1.5em;
  font-size: 10pt;
  list-style: none !important;
  list-style-type: none !important;
}

/* --- Math (KaTeX) --- */
.math-display {
  text-align: center;
  margin: 0.8em 0;
  overflow-x: auto;
  page-break-inside: avoid;
}
.math-inline {
  display: inline;
}
.katex { font-size: 1.05em; }
.katex-display { margin: 0.6em 0; overflow-x: auto; }
table .katex { font-size: 0.88em; }
table .math-display { margin: 0.35em 0; }

/* --- Mermaid diagrams --- */
.mermaid-container {
  text-align: center;
  margin: 1em 0;
  page-break-inside: avoid;
}
.mermaid-container pre.mermaid {
  background: none;
  border: none;
  border-left: none;
  padding: 0;
  text-align: center;
}
.mermaid-container svg {
  max-width: 100%;
  max-height: 500px;
  height: auto;
}
`;

import fs from 'fs';
import path from 'path';

/**
 * Loaded after katex.min.css so PDF print rules win. Justified body text
 * stretches gaps between KaTeX spans and fragments derivatives (e.g. f′).
 */
export const PRINT_MATH_OVERRIDES = `
p:has(.katex),
p:has(.math-inline),
li:has(.katex) {
  text-align: left !important;
  hyphens: none !important;
  word-spacing: normal !important;
}
p:has(.math-display),
p:has(.katex-display) {
  text-align: left !important;
}
td .katex, th .katex {
  text-align: left !important;
}
td:has(.katex), th:has(.katex) {
  hyphens: none !important;
  -webkit-hyphens: none !important;
}
.math-display,
.katex-display {
  text-align: center !important;
  word-spacing: normal !important;
  letter-spacing: normal !important;
}
.math-display .katex,
.katex-display > .katex {
  word-spacing: normal !important;
  letter-spacing: normal !important;
}
.math-display,
.katex-display {
  display: block !important;
  max-width: 100% !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@media print {
  .math-display .katex,
  .katex-display > .katex {
    font-size: 0.88em !important;
  }
}
`;

let katexCssCache: string | null = null;

/**
 * Ingest books inject layout page-break divs before units; global `h1 { page-break-before: always }`
 * stacks with those divs and creates thin/blank pages. Apply only on `<body class="ingest-book">`.
 */
export const PRINT_CSS_INGEST_BOOK = `
body.ingest-book h1 {
  page-break-before: auto !important;
  break-before: auto !important;
}
body.ingest-book .cover-page h1 {
  page-break-before: avoid !important;
}
`;

/** Optional production layout: list rhythm, chapter lede, section counters, figure numbers, index stub. */
export const PRINT_CSS_LAYOUT_EXTENSIONS = `
/* --- Baseline layout polish (always with body.print-book--layout) --- */
body.print-book--layout ul,
body.print-book--layout ol {
  margin: 0.55em 0;
  padding-left: 1.75em;
}
body.print-book--layout ul ul,
body.print-book--layout ol ol {
  margin: 0.25em 0;
  padding-left: 1.35em;
}
body.print-book--layout li {
  margin: 0.28em 0;
  line-height: 1.55;
}
body.print-book--layout li > p {
  margin: 0.2em 0;
}
/* Chapter entry: first paragraph after a major heading */
body.print-book--layout h1 + p {
  margin-top: 0.35em;
  margin-bottom: 1.05em;
  line-height: 1.58;
  text-indent: 0;
}
body.print-book--dropcap h1 + p::first-letter {
  float: left;
  font-size: 2.55em;
  line-height: 0.92;
  padding-right: 0.06em;
  margin-top: 0.06em;
  font-weight: bold;
  font-family: 'Georgia', 'Times New Roman', serif;
}
/* Semantic figures (from markdown pipeline) */
figure.book-figure {
  margin: 1.05em auto;
  max-width: 100%;
  text-align: center;
  page-break-inside: avoid;
}
figure.book-figure img {
  max-width: 100%;
  height: auto;
  display: inline-block;
}
figure.book-figure figcaption {
  margin-top: 0.5em;
  font-size: 9.5pt;
  font-style: italic;
  text-align: center;
  color: #333;
  line-height: 1.35;
}
.print-index-stub {
  page-break-before: always;
  margin-top: 1cm;
}
.print-index-stub .print-index-note {
  font-size: 9.5pt;
  color: #555;
  font-style: italic;
}
.xref-unresolved {
  font-size: 9pt;
  color: #a63;
  border-bottom: 1px dashed #c96;
}
/* Optional: numbered sections (non-ingest books; enable PDF_SECTION_COUNTERS=1) */
body.print-book--section-numbers {
  counter-reset: chapnum 0;
}
body.print-book--section-numbers h1 {
  counter-increment: chapnum;
  counter-reset: secnum 0;
}
body.print-book--section-numbers h2::before {
  counter-increment: secnum;
  counter-reset: subsecnum 0;
  content: counter(chapnum) "." counter(secnum) "\\00a0";
  font-weight: bold;
}
body.print-book--section-numbers h3::before {
  counter-increment: subsecnum;
  content: counter(chapnum) "." counter(secnum) "." counter(subsecnum) "\\00a0";
  font-weight: bold;
  color: #333;
}
/* Optional: figure auto-numbering per chapter (PDF_FIGURE_NUMBERS=1) */
body.print-book--fig-numbers h1 {
  counter-reset: bookfig 0;
}
body.print-book--fig-numbers figure.book-figure {
  counter-increment: bookfig;
}
body.print-book--fig-numbers figure.book-figure figcaption::before {
  content: "Figure " counter(bookfig) ". ";
  font-style: normal;
  font-weight: bold;
  margin-right: 0.35em;
}
/* GFM tables: academic-style grid for thesis / report imports */
body.print-book--layout table,
body.ingest-book table {
  border-collapse: collapse;
  width: 100%;
  font-size: 9.75pt;
  margin: 0.85em 0;
}
body.print-book--layout th,
body.print-book--layout td,
body.ingest-book th,
body.ingest-book td {
  border: 0.5pt solid #222;
  padding: 0.35em 0.55em;
  vertical-align: top;
  text-align: left;
}
body.print-book--layout th,
body.ingest-book th {
  font-weight: 600;
  background: #f4f4f4;
}
`;

export interface PrintLayoutSessionFlags {
  ingestMode?: boolean;
}

/** Body classes for PDF/DOCX print layout extensions (driven by env + ingest mode). */
export function buildPrintBodyClasses(flags: PrintLayoutSessionFlags): string {
  const parts = ['print-book--layout'];
  if (flags.ingestMode) parts.push('ingest-book');
  if (!flags.ingestMode && process.env.PDF_SECTION_COUNTERS === '1') {
    parts.push('print-book--section-numbers');
  }
  if (process.env.PDF_FIGURE_NUMBERS === '1') {
    parts.push('print-book--fig-numbers');
  }
  if (process.env.PDF_CHAPTER_DROPCAP === '1') {
    parts.push('print-book--dropcap');
  }
  return parts.join(' ');
}

export function getMathCss(): string {
  if (!katexCssCache) {
    try {
      const katexCssPath = require.resolve('katex/dist/katex.min.css');
      katexCssCache = fs.readFileSync(katexCssPath, 'utf-8');
    } catch {
      console.warn('[html-template] Could not load katex.min.css — math may render without styles');
      katexCssCache = '';
    }
  }
  return katexCssCache;
}

export function wrapInHtmlTemplate(
  bodyHtml: string,
  highlightCss: string,
  options?: { mathEnabled?: boolean; ingestBook?: boolean; bodyClass?: string },
): string {
  const mathCss = options?.mathEnabled ? getMathCss() : '';
  const mathOverrides = options?.mathEnabled ? PRINT_MATH_OVERRIDES : '';
  const ingestCss = options?.ingestBook ? PRINT_CSS_INGEST_BOOK : '';
  const bodyClass = options?.bodyClass?.trim() || (options?.ingestBook ? 'ingest-book' : '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${PRINT_CSS}
${PRINT_CSS_LAYOUT_EXTENSIONS}
${ingestCss}
${highlightCss}
${mathCss}
${mathOverrides}
</style>
</head>
<body${bodyClass ? ` class="${bodyClass.replace(/"/g, '')}"` : ''}>
${bodyHtml}
</body>
</html>`;
}
