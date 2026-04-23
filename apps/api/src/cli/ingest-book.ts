#!/usr/bin/env tsx
/**
 * Legacy ingest-mode export (HTML pipeline) and baseline tooling.
 *
 * Supported:
 *   Phase 1 (no AI): --phase normalize <file.docx|pdf> [--out dir] [--export-pdf] [--md]
 *   Phase 2: --phase enhance --from-md <baseline.md> --manifest <manifest.json> [--out dir] [--premium] ...
 *   Legacy ingest export: --phase legacy <file> [--out dir] [--premium] ...
 *
 * Default (file without --phase): exits with instructions to use `generate-from-source` for
 * orchestrator-seeded generation from DOCX/PDF.
 *
 * Baseline strip (Phase 1): INGEST_BASELINE_STRIP_MODE=strict|off
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createSessionForIngest, deleteSession, saveSession } from '@/lib/session-store';
import {
  ingestFileToSession,
  classifyPdf,
  readBaselineManifest,
  hydrateSessionFromBaselineMarkdown,
  runIngestEnhancePhase,
  writeBaselineManifest,
  snapshotIngestImageAssetsForBaseline,
} from '@/ingest/index';
import { exportPDF } from '@/pdf/generate-pdf';
import { exportDOCX } from '@/docx/generate-docx';
import { closeBrowser } from '@/pdf/browser-pool';

async function resetBrowserPool(): Promise<void> {
  await closeBrowser().catch(() => {});
}

type IngestPhase = 'legacy' | 'normalize' | 'enhance' | 'none';

/**
 * npm on Windows (via cmd.exe) sometimes drops `--phase` / `--out` and forwards:
 *   tsx ingest-book.ts normalize <file.docx|pdf> [<outDir>]
 * Treat that as Phase 1 when the second token clearly looks like a source file.
 */
function tryConsumeMangledNormalizePhasePrefix(tokens: string[]): { rest: string[] } | null {
  if (tokens.length < 2) return null;
  if (tokens[0]!.toLowerCase() !== 'normalize') return null;
  const candidate = tokens[1]!;
  if (!/\.(docx|pdf)$/i.test(candidate)) return null;
  return { rest: tokens.slice(1) };
}

function parseArgs(argv: string[]): {
  phase: IngestPhase;
  file: string;
  fromMd: string | null;
  manifest: string | null;
  outDir: string | null;
  ocr: boolean;
  polish: boolean;
  premium: boolean;
  premiumFull: boolean;
  strictFidelity: boolean;
  rewriteQualityGate: boolean;
  pageFit: boolean;
  exportPdf: boolean;
  pdfOnly: boolean;
  classifyOnly: boolean;
  writeMarkdown: boolean;
} {
  let rest = argv.slice(2).filter((a) => a !== '--');
  let phase: IngestPhase = 'none';
  if (!rest.includes('--phase')) {
    const mangled = tryConsumeMangledNormalizePhasePrefix(rest);
    if (mangled) {
      phase = 'normalize';
      rest = mangled.rest;
    }
  }
  let outDir: string | null = null;
  let fromMd: string | null = null;
  let manifest: string | null = null;
  let ocr = false;
  let polish = false;
  let premium = false;
  let premiumFull = false;
  let strictFidelity = false;
  let rewriteQualityGate = false;
  let pageFit = false;
  let exportPdf = false;
  let pdfOnly = false;
  let classifyOnly = false;
  let writeMarkdown = false;
  const pos: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === '--out' || a === '-o') {
      outDir = rest[++i] ?? null;
      continue;
    }
    if (a === '--phase') {
      const p = (rest[++i] ?? '').toLowerCase();
      if (p === 'normalize') phase = 'normalize';
      else if (p === 'enhance') phase = 'enhance';
      else if (p === 'legacy') phase = 'legacy';
      else if (p === '') phase = 'none';
      else console.warn(`[ingest-book] Unknown --phase ${p}; treating as none`);
      continue;
    }
    if (a === '--from-md') {
      fromMd = rest[++i] ?? null;
      continue;
    }
    if (a === '--manifest') {
      manifest = rest[++i] ?? null;
      continue;
    }
    if (a === '--export-pdf') {
      exportPdf = true;
      continue;
    }
    if (a === '--ocr') {
      ocr = true;
      continue;
    }
    if (a === '--polish') {
      polish = true;
      continue;
    }
    if (a === '--premium') {
      premium = true;
      continue;
    }
    if (a === '--premium-full') {
      premiumFull = true;
      continue;
    }
    if (a === '--strict-fidelity') {
      strictFidelity = true;
      continue;
    }
    if (a === '--rewrite-quality-gate') {
      rewriteQualityGate = true;
      continue;
    }
    if (a === '--page-fit') {
      pageFit = true;
      continue;
    }
    if (a === '--pdf-only') {
      pdfOnly = true;
      continue;
    }
    if (a === '--classify-only') {
      classifyOnly = true;
      continue;
    }
    if (a === '--md' || a === '--write-md') {
      writeMarkdown = true;
      continue;
    }
    if (a.startsWith('-')) {
      console.warn(`[ingest-book] Unknown flag: ${a}`);
      continue;
    }
    pos.push(a);
  }
  let file = pos[0] ?? '';
  let resolvedOut = outDir;
  if (!resolvedOut && pos.length >= 2 && phase !== 'enhance') {
    resolvedOut = pos[1] ?? null;
  }
  return {
    phase,
    file,
    fromMd,
    manifest,
    outDir: resolvedOut,
    ocr,
    polish,
    premium,
    premiumFull,
    strictFidelity,
    rewriteQualityGate,
    pageFit,
    exportPdf,
    pdfOnly,
    classifyOnly,
    writeMarkdown,
  };
}

function sanitizeBase(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '').trim().slice(0, 180) || 'ingested-book';
}

async function exportIngestOutputs(
  session: ReturnType<typeof createSessionForIngest>,
  destDir: string,
  baseName: string,
  opts: { pdfOnly: boolean; writeMarkdown: boolean },
): Promise<void> {
  console.log('[ingest-book] Starting PDF export (Puppeteer; large books = many chunks, several minutes is normal).');
  await exportPDF(session);
  if (!session.pdfBuffer?.length) {
    throw new Error('PDF export produced empty buffer');
  }

  const pdfPath = path.join(destDir, `${baseName}-ingest.pdf`);
  fs.writeFileSync(pdfPath, session.pdfBuffer);
  console.log(`[ingest-book] PDF done: ${pdfPath} (${session.lastExportPageCount ?? '?'} pages)`);

  await resetBrowserPool();

  if (opts.pdfOnly) {
    console.log('[ingest-book] --pdf-only: skipping DOCX.');
  } else {
    try {
      const docxBuf = await exportDOCX(session);
      const docxPath = path.join(destDir, `${baseName}-ingest.docx`);
      fs.writeFileSync(docxPath, docxBuf);
      console.log(`[ingest-book] DOCX done: ${docxPath}`);
    } catch (docxErr) {
      const msg = docxErr instanceof Error ? docxErr.message : String(docxErr);
      console.error(
        `[ingest-book] DOCX failed (${msg}). PDF is already saved above. Retry with --pdf-only or increase DOCX_EXPORT_TIMEOUT_MS.`,
      );
      process.exitCode = 2;
    }
  }

  const mdPath = path.join(destDir, `${baseName}-ingest.md`);
  if (opts.writeMarkdown && session.finalMarkdown) {
    fs.writeFileSync(mdPath, session.finalMarkdown, 'utf-8');
    console.log(`[ingest-book] Wrote ${mdPath}`);
  }
}

function warnRemovedIngestFlags(polish: boolean, pageFit: boolean): void {
  if (polish) {
    console.warn(
      '[ingest-book] --polish is no longer applied on ingest paths. Use src/cli/generate-from-source.ts for source-grounded orchestration.',
    );
  }
  if (pageFit) {
    console.warn(
      '[ingest-book] --page-fit was removed. Use ORCH_TARGET_PAGES / INGEST_TARGET_PAGES with generate-from-source for length guidance.',
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const {
    phase,
    file,
    fromMd,
    manifest,
    outDir,
    ocr,
    polish,
    premium,
    premiumFull,
    strictFidelity,
    rewriteQualityGate,
    pageFit,
    exportPdf,
    pdfOnly,
    classifyOnly,
    writeMarkdown,
  } = args;

  if (phase === 'enhance') {
    if (!fromMd || !manifest) {
      console.error(
        'Usage: npx tsx src/cli/ingest-book.ts --phase enhance --from-md <baseline.md> --manifest <manifest.json> [--out dir] [--premium] [--md] ...',
      );
      process.exit(1);
    }
    warnRemovedIngestFlags(polish, pageFit);
    const mdPath = path.resolve(fromMd);
    const manPath = path.resolve(manifest);
    if (!fs.existsSync(mdPath) || !fs.existsSync(manPath)) {
      console.error('Baseline markdown or manifest not found.');
      process.exit(1);
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const baseName = sanitizeBase(path.basename(mdPath, '.md'));
    const destDir = outDir ? path.resolve(outDir) : path.dirname(mdPath);
    fs.mkdirSync(destDir, { recursive: true });

    const session = createSessionForIngest(baseName, model);
    if (premiumFull) process.env.INGEST_PREMIUM_FULL = '1';
    if (strictFidelity) process.env.INGEST_STRICT_SOURCE_FIDELITY = '1';
    if (rewriteQualityGate) process.env.INGEST_REWRITE_QUALITY_GATE = '1';

    try {
      const md = fs.readFileSync(mdPath, 'utf-8');
      const man = readBaselineManifest(manPath);
      hydrateSessionFromBaselineMarkdown(session, md, man);
      await runIngestEnhancePhase(session, { premium });
      saveSession(session);
      await exportIngestOutputs(session, destDir, baseName, { pdfOnly, writeMarkdown });
    } finally {
      await closeBrowser().catch(() => {});
      deleteSession(session.id);
    }
    return;
  }

  if (!file) {
    console.error(
      'Usage:\n  Source → orchestrated book: npx tsx src/cli/generate-from-source.ts <file.pdf|docx> [--out dir]\n  Baseline Phase 1: npx tsx src/cli/ingest-book.ts --phase normalize <file> [--out dir] [--export-pdf] [--md]\n  Legacy ingest export: npx tsx src/cli/ingest-book.ts --phase legacy <file> [--out dir] [--premium] ...',
    );
    process.exit(1);
  }

  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.pdf' && ext !== '.docx') {
    console.error('Only .pdf and .docx are supported for file ingest.');
    process.exit(1);
  }

  if (classifyOnly) {
    if (ext !== '.pdf') {
      console.log('[classify] Only PDF classification is implemented.');
      process.exit(0);
    }
    const bytes = new Uint8Array(fs.readFileSync(resolved));
    const c = await classifyPdf(bytes);
    console.log(JSON.stringify(c, null, 2));
    process.exit(0);
  }

  if (phase === 'none') {
    console.error(
      [
        'Direct DOCX/PDF → export without --phase is no longer supported.',
        '',
        'For orchestrator-seeded books from a source file, run:',
        '  npx tsx src/cli/generate-from-source.ts <file.docx|file.pdf> [--out dir] [--title "…"]',
        '',
        'For legacy ingest-mode HTML export (mirrors imported sections), run:',
        '  npx tsx src/cli/ingest-book.ts --phase legacy <file.docx|file.pdf> [--out dir] [--premium]',
      ].join('\n'),
    );
    process.exit(1);
  }

  if (phase === 'legacy') {
    warnRemovedIngestFlags(polish, pageFit);
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseName = sanitizeBase(path.basename(resolved, ext));
  const destDir = outDir ? path.resolve(outDir) : path.dirname(resolved);
  fs.mkdirSync(destDir, { recursive: true });

  const session = createSessionForIngest(baseName, model);
  if (premiumFull) process.env.INGEST_PREMIUM_FULL = '1';
  if (strictFidelity) process.env.INGEST_STRICT_SOURCE_FIDELITY = '1';
  if (rewriteQualityGate) process.env.INGEST_REWRITE_QUALITY_GATE = '1';

  try {
    if (phase === 'normalize') {
      const result = await ingestFileToSession(session, resolved, {
        ocr,
        deterministicOnly: true,
        premium: false,
      });
      for (const w of result.warnings) {
        console.warn(w);
      }
      saveSession(session);

      const baselineMd = path.join(destDir, `${baseName}-baseline.md`);
      const baselineMan = path.join(destDir, `${baseName}-baseline.manifest.json`);
      if (session.finalMarkdown) {
        fs.writeFileSync(baselineMd, session.finalMarkdown, 'utf-8');
        console.log(`[ingest-book] Wrote ${baselineMd}`);
      }
      session.ingestImageAssets = snapshotIngestImageAssetsForBaseline(
        destDir,
        baseName,
        session.ingestImageAssets ?? [],
      );
      writeBaselineManifest(baselineMan, session, result.estimatedSourcePages);
      console.log(`[ingest-book] Wrote ${baselineMan}`);

      if (exportPdf) {
        await exportIngestOutputs(session, destDir, `${baseName}-baseline`, {
          pdfOnly,
          writeMarkdown,
        });
      } else if (writeMarkdown && session.finalMarkdown) {
        const mdPath = path.join(destDir, `${baseName}-baseline-ingest.md`);
        fs.writeFileSync(mdPath, session.finalMarkdown, 'utf-8');
        console.log(`[ingest-book] Wrote ${mdPath}`);
      }
      return;
    }

    const result = await ingestFileToSession(session, resolved, {
      ocr,
      premium,
    });
    for (const w of result.warnings) {
      console.warn(w);
    }
    saveSession(session);

    await exportIngestOutputs(session, destDir, baseName, { pdfOnly, writeMarkdown });
  } finally {
    await closeBrowser().catch(() => {});
    deleteSession(session.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
