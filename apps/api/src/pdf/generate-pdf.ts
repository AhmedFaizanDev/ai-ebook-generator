import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SessionState } from '@/lib/types';
import { segmentsToHtml, markdownToHtml, getHighlightCss } from './markdown-to-html';
import { buildSegments } from '@/orchestrator/build-markdown';
import { wrapInHtmlTemplate } from './html-template';
import { getBrowser, closeBrowser } from './browser-pool';
import { auditExportHtml } from './export-preflight';
import { buildExportQualityReport } from '@/orchestrator/content-validator';
import { describeThrowable } from '@/lib/describe-throwable';

const MAX_CHUNK_CHARS = 350_000;

/**
 * In-browser scripts passed as strings so tsx/esbuild never inject `__name` into serialized
 * `page.evaluate(fn)` bodies (would cause ReferenceError in Chromium).
 */
const MERMAID_RUN_SCRIPT = `
(async () => {
  function stringifyInPage(e) {
    if (e instanceof Error) return e.message || e.name || 'Error';
    if (typeof e === 'string') return e;
    try {
      var j = JSON.stringify(e);
      if (j && j !== '{}') return j.slice(0, 800);
    } catch (x) {}
    return String(e);
  }
  try {
    var w = window;
    if (!w.mermaid) {
      return { ok: false, reason: 'mermaid global missing after loading script (network blocked?)' };
    }
    w.mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      themeVariables: {
        fontFamily: '"Times New Roman","Cambria Math","Segoe UI Symbol","Arial Unicode MS",sans-serif',
      },
    });
    await w.mermaid.run({ querySelector: 'pre.mermaid' });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: stringifyInPage(e) };
  }
})()
`;

const MERMAID_VERIFY_SCRIPT = `
(() => {
  var containers = document.querySelectorAll('.mermaid-container');
  var failed = 0;
  var failedTexts = [];
  for (var i = 0; i < containers.length; i++) {
    var c = containers[i];
    var svg = c.querySelector('svg');
    var hasSyntaxError = (c.textContent || '').toLowerCase().indexOf('syntax error') !== -1;
    if (!svg || hasSyntaxError) {
      failed++;
      failedTexts.push((c.textContent || '').slice(0, 120));
      c.style.display = 'none';
    } else {
      svg.setAttribute('style', 'max-width:100%;max-height:500px;height:auto;');
      if (!svg.getAttribute('viewBox') && svg.getBBox) {
        try {
          var bb = svg.getBBox();
          svg.setAttribute('viewBox', '0 0 ' + bb.width + ' ' + bb.height);
        } catch (e) {}
      }
    }
  }
  return { total: containers.length, failed: failed, failedTexts: failedTexts };
})()
`;

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

  const topicLabel = (session.topic || 'book').slice(0, 80);
  const wall0 = Date.now();
  console.log(`[PDF] Starting export for "${topicLabel}"…`);
  console.log('[PDF] Stage 1/3: markdown → HTML (segments + KaTeX can take several minutes on large books; no log spam until done)…');

  const visuals = session.visuals;
  // Prefer structured segments (each md segment parsed independently by marked)
  // over flat finalMarkdown to prevent CommonMark HTML-block poisoning.
  const segments = buildSegments(session);
  console.log(`[PDF] Stage 1a: ${segments.length} segment(s) assembled (${Math.round((Date.now() - wall0) / 1000)}s)`);

  const fullHtml = segments.length > 0
    ? segmentsToHtml(segments, visuals)
    : markdownToHtml(session.finalMarkdown, visuals);
  console.log(
    `[PDF] Stage 1b: HTML ${Math.round(fullHtml.length / 1024)}KB (${Math.round((Date.now() - wall0) / 1000)}s) — starting preflight / chunking`,
  );
  const highlightCss = getHighlightCss();

  if (!fullHtml || fullHtml.trim().length === 0) {
    throw new Error('Converted HTML is empty — cannot generate PDF');
  }

  // Preflight audit: detect leaked markdown/math/mermaid
  if (session.visuals?.strictMode) {
    const preflightErrors = auditExportHtml(fullHtml);
    if (preflightErrors.length > 0) {
      const summary = preflightErrors.map((e) => `[${e.type}] ${e.message}`).join('; ');
      console.error(`[PDF] Export preflight failed (${preflightErrors.length} errors): ${summary}`);
      throw new Error(`Export preflight failed: ${summary}`);
    }
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
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
    timeout: 180_000,
  };

  const isRetriablePuppeteerError = (msg: string) =>
    msg.includes('Target closed') ||
    msg.includes('Protocol error') ||
    msg.includes('Protocol error (IO.read)') ||
    msg.includes('Protocol error (Runtime.callFunctionOn)') ||
    msg.includes('Protocol error (Page.printToPDF)') ||
    msg.includes('Connection closed') ||
    msg.includes('Navigation timeout') ||
    msg.includes('Session closed');

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const MAX_ATTEMPTS = 3;

  console.log(`[PDF] Stage 2/3: Chromium — ${htmlChunks.length} PDF chunk(s) (first browser launch on Windows often 30–90s)…`);

  for (let i = 0; i < htmlChunks.length; i++) {
    const wrappedHtml = wrapInHtmlTemplate(htmlChunks[i], highlightCss, { mathEnabled: visuals?.equations?.enabled });
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
        await page.setViewport({ width: 794, height: 1123 });
        await page.setContent(wrappedHtml, { waitUntil: 'load', timeout: 120_000 });

        if (visuals?.equations?.enabled) {
          await page
            .evaluate(
              '(function(){ var r = document.fonts && document.fonts.ready; return r ? r : Promise.resolve(); })()',
            )
            .catch(() => {});
        }

        // Render Mermaid diagrams if any <pre class="mermaid"> exist
        if (visuals?.mermaid?.enabled) {
          const hasMermaid = await page.evaluate("document.querySelectorAll('pre.mermaid').length > 0");
          if (hasMermaid) {
            await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js' });
            // Mermaid often throws non-Error values; raw CDP errors show as "Object". Catch in-page and return text.
            const runOutcome = (await page.evaluate(MERMAID_RUN_SCRIPT)) as { ok: true } | { ok: false; reason: string };
            if (!runOutcome.ok) {
              const detail = `Mermaid run failed in PDF chunk ${i + 1}: ${runOutcome.reason}`;
              if (visuals.strictMode) {
                throw new Error(detail);
              }
              console.warn(`[PDF] ${detail.slice(0, 1200)}${detail.length > 1200 ? '…' : ''}`);
              console.warn(
                '[PDF] strictMode=false: continuing PDF without diagrams for this chunk (invalid Mermaid, e.g. empty node labels like A[""]).',
              );
              await page.evaluate(
                "document.querySelectorAll('pre.mermaid').forEach(function (p) { p.style.display = 'none'; })",
              );
            } else {
              await new Promise((r) => setTimeout(r, 1000));

              // Verify each mermaid container rendered to SVG
              const mermaidResults = (await page.evaluate(MERMAID_VERIFY_SCRIPT)) as {
                total: number;
                failed: number;
                failedTexts: string[];
              };

              if (mermaidResults.failed > 0) {
                console.warn(`[PDF] ${mermaidResults.failed}/${mermaidResults.total} mermaid diagram(s) failed to render in chunk ${i + 1}`);
                if (visuals.strictMode) {
                  const failedDetail = mermaidResults.failedTexts.join(' | ');
                  throw new Error(`Mermaid render failed for ${mermaidResults.failed} diagram(s): ${failedDetail}`);
                }
              }
            }
          }
        }

        await new Promise((r) => setTimeout(r, 1500));
        const pdfUint8 = await page.pdf(pdfOptions);
        pdfBuffers.push(Buffer.from(pdfUint8));
        await page.close().catch(() => {});
        lastErr = null;
        console.log(`[PDF] Chunk ${i + 1}/${htmlChunks.length} done (${Math.round(pdfUint8.length / 1024)}KB PDF)`);
        break;
      } catch (err) {
        const msg = describeThrowable(err);
        lastErr = new Error(msg, err instanceof Error ? { cause: err } : undefined);
        await page.close().catch(() => {});
        console.error(`[PDF] Chunk ${i + 1} attempt ${attempt + 1} failed: ${msg}`);
        if (attempt < MAX_ATTEMPTS - 1 && isRetriablePuppeteerError(msg)) {
          console.log('[PDF] Retriable (Target/Protocol closed) — closing browser, launching fresh one...');
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
  console.log(`[PDF] Stage 3/3: merging ${pdfBuffers.length} chunk PDF(s) (${Math.round((Date.now() - wall0) / 1000)}s total so far)…`);

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

  // Emit quality report
  if (session.finalMarkdown) {
    const report = buildExportQualityReport(session.finalMarkdown, visuals);
    if (report.qualityWarnings.length > 0) {
      console.warn(`[PDF] Quality warnings (${report.qualityWarnings.length}): ${report.qualityWarnings.map((w) => w.message).join('; ')}`);
    }
    console.log(`[PDF] Quality report: ${report.validBlocks}/${report.totalBlocks} blocks valid, ${report.leakErrors} leak errors, ${report.qualityWarnings.length} style warnings`);
  }

  session.finalMarkdown = null;

  console.log(
    `[PDF] Export complete — ${pages.length} pages, ${Math.round(session.pdfBuffer.length / 1024)}KB (${Math.round((Date.now() - wall0) / 1000)}s wall time)`,
  );
}
