import { SessionState } from '@/lib/types';
import { segmentsToHtml, markdownToHtml, getHighlightCss } from '@/pdf/markdown-to-html';
import { buildSegments } from '@/orchestrator/build-markdown';
import { PRINT_CSS, getMathCss, PRINT_MATH_OVERRIDES } from '@/pdf/html-template';
import { auditExportHtml } from '@/pdf/export-preflight';
import { getBrowser } from '@/pdf/browser-pool';

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

  const visuals = session.visuals;
  const segments = buildSegments(session);
  const rawHtml = segments.length > 0
    ? segmentsToHtml(segments, visuals)
    : markdownToHtml(session.finalMarkdown, visuals);
  // Preflight audit before DOCX conversion
  if (session.visuals?.strictMode) {
    const preflightErrors = auditExportHtml(rawHtml);
    if (preflightErrors.length > 0) {
      const summary = preflightErrors.map((e) => `[${e.type}] ${e.message}`).join('; ');
      console.error(`[DOCX] Export preflight failed (${preflightErrors.length} errors): ${summary}`);
      throw new Error(`DOCX export preflight failed: ${summary}`);
    }
  }

  let bodyHtml = enhanceHtmlForDocx(rawHtml);
  bodyHtml = injectDocxPageBreaks(bodyHtml);
  const highlightCss = getHighlightCss();

  const mathCss = visuals?.equations?.enabled ? getMathCss() : '';
  const mathOverrides = visuals?.equations?.enabled ? PRINT_MATH_OVERRIDES : '';
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${PRINT_CSS}
${highlightCss}
${DOCX_COMPAT_CSS}
${mathCss}
${mathOverrides}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  // Rasterize math and mermaid blocks to images for Word compatibility
  const needsRasterize = (visuals?.equations?.enabled || visuals?.mermaid?.enabled);
  const docxHtml = needsRasterize
    ? await rasterizeVisualsForDocx(fullHtml, visuals?.mermaid?.enabled ?? false)
    : fullHtml;

  const docxBuffer: Buffer = await HTMLtoDOCX(docxHtml, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    font: 'Georgia',
    fontSize: 22,
    title: session.structure?.title ?? session.topic,
  });

  console.log(
    `[DOCX] Export complete — ${Math.round(docxBuffer.length / 1024)}KB`,
  );

  return docxBuffer;
}

/**
 * Use Puppeteer to render the full HTML, then screenshot math and mermaid
 * elements and replace them with inline <img> tags (base64 PNGs).
 * This ensures Word displays rendered visuals instead of raw TeX or SVG.
 */
async function rasterizeVisualsForDocx(html: string, mermaidEnabled: boolean): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });

    if (mermaidEnabled) {
      const hasMermaid = await page.evaluate(() => document.querySelectorAll('pre.mermaid').length > 0);
      if (hasMermaid) {
        await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js' });
        await page.evaluate(() => {
          (window as any).mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
          return (window as any).mermaid.run({ querySelector: 'pre.mermaid' });
        });
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const selectors = [
      '.math-inline', '.math-display', '.katex', '.katex-display',
      '.mermaid-container',
    ];

    const rasterized = await page.evaluate(async (sels: string[]) => {
      const results: { selector: string; index: number; dataUrl: string; width: number; height: number }[] = [];
      for (const sel of sels) {
        const elements = document.querySelectorAll(sel);
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i] as HTMLElement;
          if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
          // Mark for replacement
          el.setAttribute('data-raster-id', `${sel}-${i}`);
          results.push({
            selector: sel,
            index: i,
            dataUrl: '',
            width: el.offsetWidth,
            height: el.offsetHeight,
          });
        }
      }
      return results;
    }, selectors);

    for (const item of rasterized) {
      const el = await page.$(`[data-raster-id="${item.selector}-${item.index}"]`);
      if (!el) continue;
      try {
        const screenshot = await el.screenshot({ type: 'png', encoding: 'base64' }) as string;
        item.dataUrl = `data:image/png;base64,${screenshot}`;
      } catch {
        console.warn(`[DOCX] Failed to screenshot ${item.selector}[${item.index}]`);
      }
    }

    // Replace elements in the HTML with <img> tags
    let resultHtml = await page.evaluate((items: typeof rasterized) => {
      for (const item of items) {
        if (!item.dataUrl) continue;
        const el = document.querySelector(`[data-raster-id="${item.selector}-${item.index}"]`);
        if (!el) continue;
        const img = document.createElement('img');
        img.src = item.dataUrl;
        img.style.width = `${item.width}px`;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.alt = item.selector.includes('math') ? 'equation' : 'diagram';
        el.replaceWith(img);
      }
      return document.documentElement.outerHTML;
    }, rasterized);

    return `<!DOCTYPE html>\n${resultHtml}`;
  } finally {
    await page.close().catch(() => {});
  }
}
