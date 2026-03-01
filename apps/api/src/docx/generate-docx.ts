import { SessionState } from '@/lib/types';
import { markdownToHtml, getHighlightCss } from '@/pdf/markdown-to-html';
import { PRINT_CSS } from '@/pdf/html-template';

// html-to-docx ships a default export (CJS)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HTMLtoDOCX = require('html-to-docx');

const PAGE_BREAK =
  '<div class="page-break" style="page-break-after: always;"></div>';

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

  let bodyHtml = markdownToHtml(session.finalMarkdown);
  bodyHtml = injectDocxPageBreaks(bodyHtml);
  const highlightCss = getHighlightCss();

  const fullHtml = `<!DOCTYPE html>
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
