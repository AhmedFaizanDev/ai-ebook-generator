import { SessionState } from '@/lib/types';
import { segmentsToHtml, markdownToHtml, getHighlightCss } from '@/pdf/markdown-to-html';
import { buildSegments } from '@/orchestrator/build-markdown';
import { PRINT_CSS } from '@/pdf/html-template';

// html-to-docx ships a default export (CJS)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HTMLtoDOCX = require('html-to-docx');

const PAGE_BREAK =
  '<div class="page-break" style="page-break-after: always;"></div>';

/** Extra CSS: html-to-docx / Word often ignore class-based rules from PRINT_CSS for tables and code. */
const DOCX_COMPAT_CSS = `
table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 10pt; }
table th, table td { border: 1px solid #ccc; padding: 6px 10px; vertical-align: top; }
table th { background: #f0f0f0; font-weight: bold; }
pre { font-family: Consolas, "Courier New", monospace !important; font-size: 9pt !important;
  white-space: pre-wrap !important; word-wrap: break-word !important; line-height: 1.4 !important;
  background: #f6f8fa !important; padding: 10px 14px !important; border-left: 3px solid #ccc !important; }
pre code { background: transparent !important; font-size: inherit !important; }
strong, b { font-weight: bold; }
`;

/**
 * Inline structure hints for Word/html-to-docx: external stylesheets are applied inconsistently,
 * so duplicate critical presentation on elements where possible.
 */
function enhanceHtmlForDocx(html: string): string {
  return html.replace(/<table(\s[^>]*)?>/gi, (full, attrs: string | undefined) => {
    const rest = (attrs ?? '').trim();
    if (/\bborder\s*=/i.test(rest)) return full;
    const after = rest ? ` ${rest}` : '';
    return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0.8em 0;font-size:10pt"${after}>`;
  }).replace(/<pre>/g, '<pre style="font-family:Consolas,\'Courier New\',monospace;font-size:9pt;background:#f6f8fa;padding:10px 14px;border-left:3px solid #ccc;white-space:pre-wrap;word-wrap:break-word;line-height:1.4">');
}

/**
 * html-to-docx only recognises <div class="page-break" style="page-break-after: always;"></div>.
 * Inject these at every major section boundary (cover, copyright, TOC, each unit).
 */
function injectDocxPageBreaks(html: string): string {
  let result = html
    // Replace inline page-break divs from build-markdown (PDF) with docx-compatible ones
    .replace(/<div style="page-break-before:always;"><\/div>/g, PAGE_BREAK)
    // After cover page: before copyright
    .replace(/(<\/div>)\s*(<div class="copyright-page")/g, `$1${PAGE_BREAK}$2`)
    // Before TOC (after copyright or preface)
    .replace(/(<\/div>)\s*(<div class="toc")/g, `$1${PAGE_BREAK}$2`);

  // Before every <h1> except the very first one (cover title)
  let firstH1Found = false;
  result = result.replace(/<h1\b/g, (match) => {
    if (!firstH1Found) {
      firstH1Found = true;
      return match;
    }
    return PAGE_BREAK + match;
  });

  return result;
}

export async function exportDOCX(session: SessionState): Promise<Buffer> {
  if (!session.finalMarkdown) {
    throw new Error('No finalMarkdown to render for DOCX');
  }

  const segments = buildSegments(session);
  const rawHtml = segments.length > 0
    ? segmentsToHtml(segments)
    : markdownToHtml(session.finalMarkdown);
  let bodyHtml = enhanceHtmlForDocx(rawHtml);
  bodyHtml = injectDocxPageBreaks(bodyHtml);
  const highlightCss = getHighlightCss();

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${PRINT_CSS}
${highlightCss}
${DOCX_COMPAT_CSS}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const docxBuffer: Buffer = await HTMLtoDOCX(fullHtml, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    font: 'Georgia',
    fontSize: 22,      // half-points: 22 = 11pt
    title: session.structure?.title ?? session.topic,
  });

  console.log(
    `[DOCX] Export complete — ${Math.round(docxBuffer.length / 1024)}KB`,
  );

  return docxBuffer;
}
