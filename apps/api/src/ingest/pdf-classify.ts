import type { PdfClassification } from '@/ingest/types';
import { clonePdfBytes, loadPdfJsModule } from '@/ingest/pdf-worker';

const SCANNED_CHARS_PER_PAGE_THRESHOLD = 120;

/**
 * Inspect extractable text density per page to guess scanned vs digital PDFs.
 */
export async function classifyPdf(bytes: Uint8Array): Promise<PdfClassification> {
  const data = clonePdfBytes(bytes);
  const pdfjs = await loadPdfJsModule();
  const loading = pdfjs.getDocument({
    data: data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const doc = await loading.promise;
  const pageCount = doc.numPages;
  const charsPerPage: number[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let n = 0;
    for (const item of tc.items) {
      if ('str' in item && typeof item.str === 'string') {
        n += item.str.length;
      }
    }
    charsPerPage.push(n);
  }

  const totalChars = charsPerPage.reduce((a, b) => a + b, 0);
  const avg = pageCount > 0 ? totalChars / pageCount : 0;
  const likelyScanned = avg < SCANNED_CHARS_PER_PAGE_THRESHOLD;

  let recommendation =
    'Text extraction via pdf.js is sufficient for export. Consider Poppler pdfimages for embedded raster figures.';
  if (likelyScanned) {
    recommendation =
      'Very little selectable text — this PDF may be scanned or image-heavy. Use --ocr if Tesseract + Poppler are installed, or provide a DOCX source.';
  }

  return {
    pageCount,
    charsPerPage,
    totalChars,
    likelyScanned,
    recommendation,
  };
}
