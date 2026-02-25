import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SessionState } from '@/lib/types';
import { markdownToHtml, getHighlightCss } from './markdown-to-html';
import { wrapInHtmlTemplate } from './html-template';
import { getBrowser, closeBrowser } from './browser-pool';

const MAX_CHUNK_CHARS = 350_000;

function splitHtmlByH1(html: string): string[] {
  const copyrightEndMarker = '</div>\n';
  const copyrightIdx = html.lastIndexOf('class="copyright-page"');

  let frontMatter = '';
  let body = html;

  if (copyrightIdx !== -1) {
    const afterCopyright = html.indexOf(copyrightEndMarker, copyrightIdx);
    if (afterCopyright !== -1) {
      const splitAt = afterCopyright + copyrightEndMarker.length;
      frontMatter = html.slice(0, splitAt).trim();
      body = html.slice(splitAt).trim();
    }
  }

  const contentParts = body.split(/(?=<h1[\s>])/i).filter((p) => p.trim().length > 0);

  if (frontMatter) {
    return [frontMatter, ...contentParts];
  }
  return contentParts;
}

function splitLargeChunk(html: string): string[] {
  if (html.length <= MAX_CHUNK_CHARS) return [html];
  const byH2 = html.split(/(?=<h2[\s>])/i);
  const out: string[] = [];
  let acc = '';
  for (const part of byH2) {
    if (acc.length + part.length > MAX_CHUNK_CHARS && acc.length > 0) {
      out.push(acc.trim());
      acc = part;
    } else {
      acc += part;
    }
  }
  if (acc.trim()) out.push(acc.trim());
  return out.length > 0 ? out : [html];
}

function flattenChunks(chunks: string[]): string[] {
  const result: string[] = [];
  for (const c of chunks) {
    result.push(...splitLargeChunk(c));
  }
  return result;
}

export async function exportPDF(session: SessionState): Promise<void> {
  if (!session.finalMarkdown) {
    throw new Error('No finalMarkdown to render');
  }

  const fullHtml = markdownToHtml(session.finalMarkdown);
  const highlightCss = getHighlightCss();

  if (!fullHtml || fullHtml.trim().length === 0) {
    throw new Error('Converted HTML is empty — cannot generate PDF');
  }

  const byH1 = splitHtmlByH1(fullHtml);
  const rawChunks = byH1.length > 0 ? byH1 : [fullHtml];
  const htmlChunks = flattenChunks(rawChunks);

  if (htmlChunks.length === 0) {
    throw new Error('No HTML chunks produced after splitting — cannot generate PDF');
  }

  const pdfBuffers: Buffer[] = [];
  const pdfOptions = {
    format: 'A4' as const,
    margin: { top: '2cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
    printBackground: true,
    displayHeaderFooter: false,
    timeout: 180_000,
  };

  const isRetriablePuppeteerError = (msg: string) =>
    msg.includes('Target closed') ||
    msg.includes('Protocol error') ||
    msg.includes('Connection closed') ||
    msg.includes('Navigation timeout') ||
    msg.includes('Session closed');

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const MAX_ATTEMPTS = 3;

  console.log(`[PDF] Rendering ${htmlChunks.length} chunks...`);

  for (let i = 0; i < htmlChunks.length; i++) {
    const wrappedHtml = wrapInHtmlTemplate(htmlChunks[i], highlightCss);
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      console.log(`[PDF] Chunk ${i + 1}/${htmlChunks.length} attempt ${attempt + 1}/${MAX_ATTEMPTS} (${Math.round(htmlChunks[i].length / 1024)}KB HTML)`);

      let browser;
      try {
        browser = await getBrowser();
      } catch (launchErr) {
        console.error('[PDF] Browser launch failed, retrying in 2s...', launchErr);
        await closeBrowser();
        await sleep(2000);
        if (attempt < MAX_ATTEMPTS - 1) continue;
        throw launchErr;
      }

      let page;
      try {
        page = await browser.newPage();
      } catch (pageErr) {
        console.error('[PDF] newPage() failed — browser may be dead. Relaunching...');
        await closeBrowser();
        await sleep(1000);
        if (attempt < MAX_ATTEMPTS - 1) continue;
        throw pageErr;
      }

      try {
        await page.setContent(wrappedHtml, { waitUntil: 'domcontentloaded', timeout: 180_000 });
        const pdfUint8 = await page.pdf(pdfOptions);
        pdfBuffers.push(Buffer.from(pdfUint8));
        await page.close().catch(() => {});
        lastErr = null;
        console.log(`[PDF] Chunk ${i + 1}/${htmlChunks.length} done (${Math.round(pdfUint8.length / 1024)}KB PDF)`);
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        await page.close().catch(() => {});
        const msg = lastErr.message;
        console.error(`[PDF] Chunk ${i + 1} attempt ${attempt + 1} failed: ${msg}`);
        if (attempt < MAX_ATTEMPTS - 1 && isRetriablePuppeteerError(msg)) {
          console.log('[PDF] Closing dead browser, launching fresh one...');
          await closeBrowser();
          await sleep(1500);
          continue;
        }
        throw lastErr;
      }
    }
    if (lastErr) throw lastErr;
    if (i < htmlChunks.length - 1) await sleep(600);
  }
  console.log(`[PDF] All chunks rendered, merging ${pdfBuffers.length} PDFs...`);

  if (pdfBuffers.length === 0) {
    throw new Error('No PDF chunks were rendered successfully');
  }

  const merged = await PDFDocument.create();

  for (const buf of pdfBuffers) {
    const src = await PDFDocument.load(buf);
    const copiedPages = await merged.copyPages(src, src.getPageIndices());
    copiedPages.forEach((p) => merged.addPage(p));
  }

  const font = await merged.embedFont(StandardFonts.Helvetica);
  const pages = merged.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const text = `${i + 1}`;
    const textWidth = font.widthOfTextAtSize(text, 9);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: 30,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  session.pdfBuffer = Buffer.from(await merged.save());

  session.finalMarkdown = null;

  console.log(`[PDF] Export complete — ${pages.length} pages, ${Math.round(session.pdfBuffer.length / 1024)}KB`);
}
