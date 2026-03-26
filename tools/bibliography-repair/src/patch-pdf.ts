import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import puppeteer from 'puppeteer';

/**
 * Extract per-page text from a PDF in a single parse pass using the pagerender
 * callback.  This is far faster and more reliable than calling pdfParse N times.
 */
async function extractPerPageText(pdfBuf: Buffer): Promise<string[]> {
  const pages: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pdfParse(pdfBuf, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pagerender(pageData: any): Promise<string> {
      return pageData.getTextContent().then((tc: any) => {
        const str: string = (tc.items as any[])
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ');
        pages.push(str);
        return str;
      });
    },
  });

  return pages;
}

/**
 * Find the 0-based page index where the Bibliography section starts.
 *
 * Scans from the back: looks for a page whose text begins with "Bibliography"
 * (first ~200 chars) and is not a TOC page.
 *
 * Returns 0-based page index, or -1 if not found.
 */
export async function findBibliographyStartPage(pdfBuf: Buffer): Promise<number> {
  const pageTexts = await extractPerPageText(pdfBuf);

  for (let i = pageTexts.length - 1; i >= 0; i--) {
    const text = pageTexts[i];
    if (!text) continue;

    const upperChunk = text.slice(0, 300);
    if (!/bibliography/i.test(upperChunk)) continue;

    // Skip TOC pages
    if (/table\s+of\s+contents/i.test(text)) continue;

    // Skip pages that are mostly bare numbers (TOC-like)
    const lines = text.split(/\s+/);
    const numericRatio = lines.filter((l) => /^\d{1,3}$/.test(l.trim())).length
      / Math.max(lines.length, 1);
    if (numericRatio > 0.3) continue;

    console.log(`[pdf] Detected bibliography start at page ${i + 1} (0-based: ${i})`);
    return i;
  }

  console.warn('[pdf] Could not detect bibliography start page from text');
  return -1;
}

/**
 * Render bibliography HTML to a PDF buffer using Puppeteer (headless Chrome).
 */
export async function renderBibliographyPdf(html: string): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const pdfUint8 = await page.pdf({
      format: 'A4',
      margin: { top: '2cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
      printBackground: true,
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Build a repaired PDF: original pages up to (but not including) bibliography start,
 * plus new bibliography pages rendered from HTML.  Re-numbers all pages.
 */
export async function patchPdf(
  originalPdfBuf: Buffer,
  newBibPdfBuf: Buffer,
  bibStartPage: number,
): Promise<Buffer> {
  const origDoc = await PDFDocument.load(originalPdfBuf);
  const bibDoc = await PDFDocument.load(newBibPdfBuf);
  const merged = await PDFDocument.create();

  // Copy pages before bibliography from original
  const keepIndices = Array.from({ length: bibStartPage }, (_, i) => i);
  const keptPages = await merged.copyPages(origDoc, keepIndices);
  for (const p of keptPages) merged.addPage(p);

  // Append new bibliography pages
  const bibPages = await merged.copyPages(bibDoc, bibDoc.getPageIndices());
  for (const p of bibPages) merged.addPage(p);

  // Re-number all pages (centered footer, same style as main pipeline)
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const allPages = merged.getPages();
  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i];
    const { width } = page.getSize();
    const text = `${i + 1}`;
    const tw = font.widthOfTextAtSize(text, 9);
    page.drawText(text, { x: width / 2 - tw / 2, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  }

  return Buffer.from(await merged.save());
}
