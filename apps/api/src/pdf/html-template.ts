export const PRINT_CSS = `
@page {
  size: A4;
  margin: 2cm 2cm 2.5cm 2cm;
}
body {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 11pt;
  line-height: 1.65;
  color: #1a1a1a;
  max-width: 100%;
  margin: 0;
  padding: 0;
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
  page-break-inside: avoid;
}
th {
  background: #f0f0f0;
  font-weight: bold;
}
th, td {
  border: 1px solid #ccc;
  padding: 6px 10px;
  text-align: left;
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

/* --- Title / Copyright page --- */
.cover-page {
  page-break-after: always;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 85vh;
  text-align: center;
}
.cover-page h1 {
  page-break-before: avoid;
  border-bottom: none;
  font-size: 32pt;
  margin-bottom: 1cm;
  line-height: 1.2;
}
.cover-page .publisher {
  font-size: 14pt;
  font-weight: bold;
  margin-bottom: 0.5cm;
}
.cover-page .year {
  font-size: 12pt;
  color: #555;
}
.cover-page .author-line {
  font-size: 12pt;
  margin-top: 1.5cm;
  margin-bottom: 0.3cm;
}
.cover-page .edition-line {
  font-size: 12pt;
  color: #555;
}

/* --- Copyright page (follows cover) --- */
.copyright-page {
  page-break-after: always;
  font-size: 9.5pt;
  line-height: 1.5;
  padding-top: 4cm;
}
.copyright-page p {
  text-align: left;
  margin: 0.6em 0;
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
`;

export function wrapInHtmlTemplate(bodyHtml: string, highlightCss: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${PRINT_CSS}
${highlightCss}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
