import { SessionState } from '@/lib/types';
import { markdownToHtml, getHighlightCss } from '@/pdf/markdown-to-html';
import { PRINT_CSS } from '@/pdf/html-template';

// html-to-docx ships a default export (CJS)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HTMLtoDOCX = require('html-to-docx');

export async function exportDOCX(session: SessionState): Promise<Buffer> {
  if (!session.finalMarkdown) {
    throw new Error('No finalMarkdown to render for DOCX');
  }

  const bodyHtml = markdownToHtml(session.finalMarkdown);
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
