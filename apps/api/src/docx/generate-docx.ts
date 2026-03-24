import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer, { Browser, Page } from 'puppeteer';
import { SessionState } from '@/lib/types';
import { markdownToHtml, getHighlightCss, getMathCss } from '@/pdf/markdown-to-html';
import { PRINT_CSS } from '@/pdf/html-template';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const HTMLtoDOCX = require('html-to-docx');

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_BREAK = '<div class="page-break" style="page-break-after: always;"></div>';
const RASTER_ATTR = 'data-docx-rasterized';
const DOCX_ID_ATTR = 'data-docx-id';

/** A4 logical width @ 96 dpi. Physical pixels = W × VIEWPORT_SCALE. */
const VIEWPORT_W = 794;
const VIEWPORT_SCALE = 2;

/**
 * Maximum element dimension in logical CSS pixels before the screenshot is
 * clipped. At 2× scale a 1200 px element produces a 2400 px PNG — large
 * enough for any textbook diagram but small enough to avoid multi-MB files.
 */
const MAX_CSS_DIM = 1200;

/** Restart the DOCX browser every N books to reclaim V8 heap and OS handles. */
const BROWSER_RESTART_EVERY = 50;

// Block-level visual containers — processed first so children are skipped.
const BLOCK_SELECTORS = [
  '.mermaid-container',
  'pre.mermaid',
  'div.mermaid',
  '.rendered-html-output',
  '.diagram-canvas',
  '.math-display',
  '.katex-display',
].join(', ');

// Inline math — processed second; adjacent siblings are grouped before capture.
const INLINE_SELECTORS = ['.math-inline', '.katex'].join(', ');

const ALL_SELECTORS = `${BLOCK_SELECTORS}, ${INLINE_SELECTORS}`;

// ── DOCX-dedicated browser (isolated from the PDF browser pool) ───────────────

let _docxBrowser: Browser | null = null;
let _docxJobCount = 0;

const BROWSER_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--disable-translate',
  '--mute-audio',
  '--hide-scrollbars',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',
  '--font-render-hinting=none',
  '--disable-backgrounding-occluded-windows',
];

async function launchDocxBrowser(): Promise<Browser> {
  const args = [...BROWSER_LAUNCH_ARGS];
  if (process.env.PUPPETEER_DOCKER === 'true') args.push('--no-zygote');
  if (process.env.PUPPETEER_SINGLE_PROCESS === 'true') args.push('--single-process');

  console.log('[DOCX] Launching browser...');
  _docxBrowser = await puppeteer.launch({
    headless: 'shell',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args,
    protocolTimeout: 300_000,
  });
  console.log('[DOCX] Browser launched');
  return _docxBrowser;
}

async function getDocxBrowser(): Promise<Browser> {
  if (_docxBrowser?.connected) return _docxBrowser;
  return launchDocxBrowser();
}

async function closeDocxBrowser(): Promise<void> {
  if (_docxBrowser) {
    await _docxBrowser.close().catch(() => {});
    _docxBrowser = null;
    console.log('[DOCX] Browser closed');
  }
}

/**
 * Called once per book after export completes.
 * Closes and relaunches the browser every BROWSER_RESTART_EVERY books so
 * accumulated V8 heap, cached resources, and OS handles are fully released.
 */
async function tickDocxBrowser(): Promise<void> {
  _docxJobCount++;
  if (_docxJobCount >= BROWSER_RESTART_EVERY) {
    console.log(`[DOCX] Browser restart after ${_docxJobCount} book(s) — reclaiming resources...`);
    await closeDocxBrowser();
    _docxJobCount = 0;
  }
}

// Shut down cleanly on process exit.
process.on('SIGTERM', () => closeDocxBrowser().finally(() => {}));
process.on('SIGINT',  () => closeDocxBrowser().finally(() => {}));

// ── Temp directory helpers ────────────────────────────────────────────────────

function createBookTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-raster-'));
  console.log(`[DOCX] Temp dir: ${dir}`);
  return dir;
}

function removeTmpDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[DOCX] Temp dir removed: ${dir}`);
  } catch (err) {
    console.warn(`[DOCX] Temp dir removal failed (${dir}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * html-to-docx embeds images via fs on local paths or via data URIs (see their example).
 * `file:///` URLs are not valid Node fs paths, so rasterized screenshots were ignored and
 * Word/Google Docs showed raw Mermaid/KaTeX. Read each PNG and inline as base64.
 */
function inlineFileImagesAsDataUri(html: string): { html: string; inlined: number } {
  const re = /src=(["'])(file:\/\/[^"']+)\1/gi;
  let inlined = 0;
  const out = html.replace(re, (_m, quote: string, fileUrl: string) => {
    try {
      const filePath = fileURLToPath(fileUrl);
      if (!fs.existsSync(filePath)) {
        console.warn(`[DOCX] Inline skip — file missing: ${filePath}`);
        return `src=${quote}${fileUrl}${quote}`;
      }
      const buf = fs.readFileSync(filePath);
      inlined++;
      return `src=${quote}data:image/png;base64,${buf.toString('base64')}${quote}`;
    } catch (err) {
      console.warn(
        `[DOCX] Inline image failed (${fileUrl}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return `src=${quote}${fileUrl}${quote}`;
    }
  });
  if (inlined > 0) {
    console.log(`[DOCX] Inlined ${inlined} raster image(s) as data URIs for html-to-docx`);
  }
  return { html: out, inlined };
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function injectDocxPageBreaks(html: string): string {
  let result = html
    .replace(/<div style="page-break-before:always;"><\/div>/g, PAGE_BREAK)
    .replace(/(<\/div>)\s*(<div class="copyright-page")/g, `$1${PAGE_BREAK}$2`)
    .replace(/(<\/div>)\s*(<div class="toc")/g, `$1${PAGE_BREAK}$2`);

  let firstH1Found = false;
  result = result.replace(/<h1\b/g, (match) => {
    if (!firstH1Found) { firstH1Found = true; return match; }
    return PAGE_BREAK + match;
  });
  return result;
}

function buildFullHtml(bodyHtml: string, highlightCss: string, mathCss: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${PRINT_CSS}
${highlightCss}
${mathCss}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TargetMeta = {
  id: string;
  label: string;
  isBlock: boolean;
  computedMargin: string;
};

type ReplaceSpec = {
  id: string;
  src: string;        // file:// URL of the PNG
  cssW: number;       // logical CSS pixels
  cssH: number;
  isBlock: boolean;
  computedMargin: string;
};

// ── DOM passes (run inside page.evaluate) ────────────────────────────────────

async function collectTargets(page: Page): Promise<TargetMeta[]> {
  return page.evaluate(
    (rAttr: string, iAttr: string, blkSel: string, inlSel: string, aSel: string): TargetMeta[] => {
      const results: TargetMeta[] = [];
      const claimed = new Set<Element>();

      // Arrow functions — esbuild does NOT inject __name for arrow functions,
      // so these serialize correctly when Puppeteer sends them to the browser.
      const isDescendantOfClaimed = (el: Element): boolean => {
        let cur: Element | null = el.parentElement;
        while (cur) {
          if (claimed.has(cur) || cur.hasAttribute(rAttr)) return true;
          cur = cur.parentElement;
        }
        return false;
      };

      const labelFor = (el: Element): string => {
        if (el.hasAttribute('data-docx-group')) return 'Inline math group';
        const tag = el.tagName.toUpperCase();
        const cls = el.classList;
        if (cls.contains('mermaid-container')) return 'Mermaid container';
        if (tag === 'PRE' && cls.contains('mermaid')) return 'Mermaid pre';
        if (tag === 'DIV' && cls.contains('mermaid')) return 'Mermaid div';
        if (cls.contains('rendered-html-output')) return 'HTML diagram';
        if (cls.contains('diagram-canvas')) return 'Diagram canvas';
        if (cls.contains('math-display')) return 'Math display';
        if (cls.contains('katex-display')) return 'KaTeX display';
        if (cls.contains('math-inline')) return 'Math inline';
        if (cls.contains('katex')) return 'KaTeX inline';
        return 'Visual element';
      };

      const claim = (el: Element, isBlock: boolean, margin: string): void => {
        const id = `dt-${results.length}-${Math.random().toString(36).slice(2, 7)}`;
        el.setAttribute(iAttr, id);
        claimed.add(el);
        results.push({ id, label: labelFor(el), isBlock, computedMargin: margin });
      };

      // Pass A — block-level (DOM order guarantees parents before children)
      for (const el of Array.from(document.querySelectorAll(blkSel))) {
        if (isDescendantOfClaimed(el)) continue;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        claim(el, true, cs.margin);
      }

      // Pass B — group adjacent inline math, then claim
      const inlineEls = Array.from(document.querySelectorAll(inlSel))
        .filter((el) => !isDescendantOfClaimed(el));

      const runs: Array<{ parent: Element; els: Element[] }> = [];
      for (const el of inlineEls) {
        const parent = el.parentElement;
        if (!parent) continue;
        const last = runs[runs.length - 1];
        if (last && last.parent === parent) {
          let node: Node | null = last.els[last.els.length - 1].nextSibling;
          let onlyWs = true;
          while (node && node !== el) {
            if (node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '') {
              onlyWs = false; break;
            }
            node = node.nextSibling;
          }
          if (onlyWs) { last.els.push(el); continue; }
        }
        runs.push({ parent, els: [el] });
      }

      for (const run of runs) {
        if (run.els.length === 1) {
          const el = run.els[0];
          (el as HTMLElement).style.display = 'inline-block';
          claim(el, false, window.getComputedStyle(el).margin);
        } else {
          const wrap = document.createElement('span');
          wrap.setAttribute('data-docx-group', String(run.els.length));
          wrap.style.display = 'inline-block';
          wrap.style.whiteSpace = 'nowrap';
          run.parent.insertBefore(wrap, run.els[0]);
          for (const el of run.els) wrap.appendChild(el);
          claim(wrap, false, window.getComputedStyle(wrap).margin);
        }
      }

      // Pass C — defensive catch-all for any remaining unmatched visuals
      for (const el of Array.from(document.querySelectorAll(aSel))) {
        if (isDescendantOfClaimed(el)) continue;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const isBlk = ['block', 'flex', 'grid', 'table', 'list-item'].includes(cs.display);
        claim(el, isBlk, cs.margin);
      }

      return results;
    },
    RASTER_ATTR, DOCX_ID_ATTR, BLOCK_SELECTORS, INLINE_SELECTORS, ALL_SELECTORS,
  );
}

async function applyReplacements(page: Page, specs: ReplaceSpec[]): Promise<{ replaced: number; missing: number }> {
  return page.evaluate(
    (list: ReplaceSpec[], rAttr: string, iAttr: string) => {
      let replaced = 0; let missing = 0;
      for (const spec of list) {
        const el = document.querySelector(`[${iAttr}="${spec.id}"]`);
        if (!el) { missing++; continue; }
        const img = document.createElement('img');
        img.src = spec.src;
        img.setAttribute('width',  String(spec.cssW));
        img.setAttribute('height', String(spec.cssH));
        img.style.maxWidth = '100%';
        if (spec.isBlock) {
          img.style.display = 'block';
          img.style.margin  = spec.computedMargin || '0.8em auto';
        } else {
          img.style.display      = 'inline';
          img.style.verticalAlign = 'middle';
        }
        img.setAttribute(rAttr, '1');
        el.replaceWith(img);
        replaced++;
      }
      return { replaced, missing };
    },
    specs, RASTER_ATTR, DOCX_ID_ATTR,
  );
}

// ── Main rasterization pipeline ───────────────────────────────────────────────

async function rasterizeForDocx(
  fullHtml: string,
  bookTmpDir: string,
): Promise<{ html: string; imageCount: number }> {
  const browser = await getDocxBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: VIEWPORT_W, height: 1123, deviceScaleFactor: VIEWPORT_SCALE });
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 120_000 });
    await new Promise((r) => setTimeout(r, 1500)); // settle fonts + KaTeX

    // esbuild (used by tsx) injects __name() calls into compiled function bodies.
    // When Puppeteer serialises those functions via .toString() and runs them in
    // the browser context, __name is not defined there.  Polyfill it as a no-op
    // so every subsequent page.evaluate() callback works without modification.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (window as any).__name === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__name = (fn: any) => fn;
      }
    });

    // ── Mermaid ───────────────────────────────────────────────────────────────
    const preMermaid = await page.evaluate(() =>
      document.querySelectorAll('pre.mermaid, div.mermaid, .mermaid-container').length
    );

    if (preMermaid > 0) {
      console.log(`[DOCX] Mermaid: ${preMermaid} element(s) found — loading renderer...`);
      try {
        await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js' });
        await page.waitForFunction(() => typeof (window as any).mermaid !== 'undefined', { timeout: 15_000 });

        const mr: { ok: boolean; rendered?: number; error?: string } = await page.evaluate(async () => {
          try {
            const m = (window as any).mermaid;
            m.initialize({
              startOnLoad: false, theme: 'default', securityLevel: 'loose',
              flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
              sequence: { useMaxWidth: true },
            });
            await m.run({ querySelector: 'pre.mermaid' });
            // Suppress error banners so they don't produce blank screenshots
            document.querySelectorAll('.mermaid-container').forEach((c) => {
              const svg = c.querySelector('svg');
              const txt = (svg?.textContent || c.textContent || '').toLowerCase();
              if (!svg || txt.includes('syntax error') || txt.includes('parse error')) {
                (c as HTMLElement).style.display = 'none';
              }
            });
            return { ok: true, rendered: document.querySelectorAll('pre.mermaid svg, div.mermaid svg').length };
          } catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
        });

        if (mr.ok) {
          console.log(`[DOCX] Mermaid: ${mr.rendered ?? 0} SVG(s) rendered`);
          await new Promise((r) => setTimeout(r, 600));
        } else {
          console.warn(`[DOCX] Mermaid.run() error: ${mr.error}`);
        }
      } catch (err) {
        console.warn(`[DOCX] Mermaid init failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Collect targets ───────────────────────────────────────────────────────
    const targets = await collectTargets(page);
    console.log(`[DOCX] ${targets.length} visual element(s) to rasterize`);

    const replaceSpecs: ReplaceSpec[] = [];
    let captured = 0; let skipped = 0; let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const { id, label, isBlock, computedMargin } = targets[i];
      const pfx = `[DOCX]   [${i + 1}/${targets.length}]`;

      const el = await page.$(`[${DOCX_ID_ATTR}="${id}"]`);
      if (!el) {
        skipped++;
        console.log(`${pfx} skip (detached): ${label}`);
        continue;
      }

      let box: { x: number; y: number; width: number; height: number } | null = null;
      try { box = await el.boundingBox(); } catch { /* element detached mid-pass */ }

      const minSize = isBlock ? 5 : 3;
      if (!box || box.width < minSize || box.height < minSize) {
        skipped++;
        const dim = box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'null';
        console.log(`${pfx} skip (no box ${dim}): ${label}`);
        await el.evaluate((n: Element) => (n as HTMLElement).style.display = 'none').catch(() => {});
        continue;
      }

      // Cap dimensions to prevent very large PNGs
      const rawW = box.width;
      const rawH = box.height;
      const capW = Math.min(rawW, MAX_CSS_DIM);
      const capH = Math.min(rawH, MAX_CSS_DIM);
      const clipped = capW < rawW || capH < rawH;

      const tmpFile = path.join(bookTmpDir, `img-${i}.png`);
      try {
        if (clipped) {
          // Use page.screenshot with a clip rect for oversized elements
          await page.screenshot({
            path: tmpFile,
            type: 'png',
            clip: { x: box.x, y: box.y, width: capW, height: capH },
          });
        } else {
          await el.screenshot({ path: tmpFile, type: 'png' });
        }
      } catch (err) {
        failed++;
        console.warn(`${pfx} screenshot failed (${label}): ${err instanceof Error ? err.message : String(err)}`);
        await el.evaluate((n: Element) => (n as HTMLElement).style.display = 'none').catch(() => {});
        continue;
      }

      const cssW = Math.round(capW);
      const cssH = Math.round(capH);
      replaceSpecs.push({
        id,
        src: `file:///${tmpFile.replace(/\\/g, '/')}`,
        cssW,
        cssH,
        isBlock,
        computedMargin,
      });
      captured++;

      const physW = cssW * VIEWPORT_SCALE;
      const physH = cssH * VIEWPORT_SCALE;
      const clipNote = clipped ? ' [clipped]' : '';
      console.log(`${pfx} captured ${cssW}×${cssH} CSS px → ${physW}×${physH} physical${clipNote}: ${label}`);
    }

    // ── Batch DOM replacement (single round-trip) ─────────────────────────────
    if (replaceSpecs.length > 0) {
      const { replaced, missing } = await applyReplacements(page, replaceSpecs);
      console.log(`[DOCX] Replacements: ${replaced} applied, ${missing} not found in DOM`);
    }

    console.log(`[DOCX] Rasterization done — captured: ${captured}, skipped: ${skipped}, failed: ${failed}`);

    // ── Remove empty placeholder containers ───────────────────────────────────
    await page.evaluate(() => {
      document.querySelectorAll('.mermaid-container, .rendered-html-output, .diagram-canvas').forEach((el) => {
        if (!el.querySelector('img') && (el.textContent ?? '').trim() === '') {
          (el as HTMLElement).style.display = 'none';
        }
      });
    });

    const serialized = await page.evaluate(() => document.documentElement.outerHTML);
    return { html: `<!DOCTYPE html>\n${serialized}`, imageCount: captured };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Public export ─────────────────────────────────────────────────────────────

export async function exportDOCX(session: SessionState): Promise<Buffer> {
  if (!session.finalMarkdown) {
    throw new Error('No finalMarkdown to render for DOCX');
  }

  let bodyHtml = markdownToHtml(session.finalMarkdown);
  bodyHtml = injectDocxPageBreaks(bodyHtml);
  const highlightCss = getHighlightCss();
  const mathCss = getMathCss();
  const staticHtml = buildFullHtml(bodyHtml, highlightCss, mathCss);

  // Each book gets its own isolated temp directory — deleted unconditionally in finally.
  const bookTmpDir = createBookTmpDir();

  console.log('[DOCX] Starting rasterization pass...');
  let finalHtml: string;
  let imageCount = 0;

  try {
    ({ html: finalHtml, imageCount } = await rasterizeForDocx(staticHtml, bookTmpDir));
  } catch (err) {
    console.warn(`[DOCX] Rasterization failed — falling back to static HTML: ${err instanceof Error ? err.message : String(err)}`);
    finalHtml = staticHtml;
  }

  // Must run while PNGs still exist on disk; html-to-docx does not resolve file:// URLs.
  const { html: inlinedHtml } = inlineFileImagesAsDataUri(finalHtml);
  finalHtml = inlinedHtml;

  let docxBuffer: Buffer;
  try {
    docxBuffer = await HTMLtoDOCX(finalHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      font: 'Georgia',
      fontSize: 22,
      title: session.structure?.title ?? session.topic,
    });
  } finally {
    // Always clean up the per-book temp directory, even if html-to-docx throws.
    removeTmpDir(bookTmpDir);
    // Tick the restart counter — triggers browser recycle every N books.
    await tickDocxBrowser();
  }

  console.log(`[DOCX] Export complete — ${Math.round(docxBuffer.length / 1024)}KB (${imageCount} image(s) embedded)`);
  return docxBuffer;
}
