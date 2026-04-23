#!/usr/bin/env tsx
/**
 * Production: DOCX/PDF → SourceBrief + slots → orchestrate() → PDF/DOCX (ingestMode off).
 *
 * Usage:
 *   npx tsx src/cli/generate-from-source.ts <file.docx|file.pdf> [--out dir] [--title "Book title"] [--pdf-only] [--ocr]
 *   --verbose          Log orchestrator phases (default is quiet milestone output only).
 *   --write-seed       Write <basename>-seed.json next to outputs (debug / audit only).
 *
 * Page budget (optional): ORCH_TARGET_PAGES or INGEST_TARGET_PAGES, ORCH_WORDS_PER_PAGE or INGEST_WORDS_PER_PAGE.
 * Optional assembly trim: ORCH_FINAL_TRIM_MAX_WORDS.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createSessionForIngest, deleteSession, saveSession } from '@/lib/session-store';
import { buildSourceSeedFromFile, writeSourceSeedJson, visualsHintForSourceSeed } from '@/ingest/source-seed';
import { orchestrate } from '@/orchestrator/index';
import { exportPDF } from '@/pdf/generate-pdf';
import { exportDOCX } from '@/docx/generate-docx';
import { closeBrowser } from '@/pdf/browser-pool';

function parseArgs(argv: string[]) {
  const rest = argv.slice(2).filter((a) => a !== '--');
  let outDir: string | null = null;
  let title: string | null = null;
  let pdfOnly = false;
  let ocr = false;
  let verbose = false;
  let writeSeed = false;
  const pos: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === '--out' || a === '-o') {
      outDir = rest[++i] ?? null;
      continue;
    }
    if (a === '--title' || a === '-t') {
      title = rest[++i] ?? null;
      continue;
    }
    if (a === '--pdf-only') {
      pdfOnly = true;
      continue;
    }
    if (a === '--ocr') {
      ocr = true;
      continue;
    }
    if (a === '--verbose' || a === '-v') {
      verbose = true;
      continue;
    }
    if (a === '--write-seed') {
      writeSeed = true;
      continue;
    }
    if (a.startsWith('-')) {
      console.warn(`[generate-from-source] Unknown flag: ${a}`);
      continue;
    }
    pos.push(a);
  }
  const file = pos[0] ?? '';
  const resolvedOut = outDir ?? (pos.length >= 2 ? pos[1]! : null);
  return { file, outDir: resolvedOut, title, pdfOnly, ocr, verbose, writeSeed };
}

function sanitizeBase(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '').trim().slice(0, 180) || 'from-source';
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[generate-from-source] OPENAI_API_KEY is required.');
    process.exit(1);
  }

  if (process.env.DEBUG_MODE === 'true') {
    console.error(
      '[generate-from-source] DEBUG_MODE=true is for development only (2×2 grid). Unset DEBUG_MODE for a full 10×6 book.',
    );
    process.exit(1);
  }

  const { file, outDir, title: titleOpt, pdfOnly, ocr, verbose, writeSeed } = parseArgs(process.argv);
  if (!file) {
    console.error(
      'Usage: npx tsx src/cli/generate-from-source.ts <file.docx|file.pdf> [--out dir] [--title "Name"] [--pdf-only] [--ocr] [--verbose] [--write-seed]',
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
    console.error('Only .pdf and .docx are supported.');
    process.exit(1);
  }

  const destDir = outDir ? path.resolve(outDir) : path.dirname(resolved);
  fs.mkdirSync(destDir, { recursive: true });

  if (verbose) {
    delete process.env.ORCH_QUIET;
  } else {
    process.env.ORCH_QUIET = '1';
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseName = sanitizeBase(path.basename(resolved, ext));
  const session = createSessionForIngest(baseName, model);

  try {
    console.log(`[generate-from-source] Input: ${resolved}`);
    const { seed, imageAssets, warnings } = await buildSourceSeedFromFile(resolved, session.id, {
      ocr,
      displayTitle: titleOpt?.trim() || undefined,
    });
    if (verbose) {
      for (const w of warnings) console.warn(w);
    }

    const bookTitle = titleOpt?.trim() || seed.brief.displayTitle;
    session.topic = bookTitle;
    session.sourcePath = resolved;
    session.sourceSeed = seed;
    session.ingestImageAssets = imageAssets;
    session.ingestMode = false;
    session.ingestSections = undefined;
    session.structure = null;

    const hint = visualsHintForSourceSeed(bookTitle, resolved, ext);
    session.visuals = {
      ...session.visuals,
      equations: { enabled: hint.equations },
      mermaid: { enabled: true },
      strictMode: session.visuals.strictMode,
    };

    if (writeSeed) {
      const seedPath = path.join(destDir, `${baseName}-seed.json`);
      writeSourceSeedJson(seedPath, seed);
      console.log(`[generate-from-source] Wrote seed artifact: ${seedPath}`);
    }

    saveSession(session);
    console.log(
      '[generate-from-source] Running full orchestrator (structure → units → assembly). This can take a long time.',
    );
    await orchestrate(session);
    saveSession(session);

    if (session.status === 'failed') {
      throw new Error(session.error || 'orchestrate failed');
    }
    console.log('[generate-from-source] Exporting PDF…');
    await exportPDF(session);
    if (!session.pdfBuffer?.length) {
      throw new Error('PDF export produced empty buffer');
    }
    const pdfPath = path.join(destDir, `${sanitizeBase(bookTitle)}.pdf`);
    fs.writeFileSync(pdfPath, session.pdfBuffer);
    console.log(`[generate-from-source] Done: ${pdfPath}`);

    await closeBrowser().catch(() => {});

    if (!pdfOnly) {
      console.log('[generate-from-source] Exporting DOCX…');
      const docxBuf = await exportDOCX(session);
      const docxPath = path.join(destDir, `${sanitizeBase(bookTitle)}.docx`);
      fs.writeFileSync(docxPath, docxBuf);
      console.log(`[generate-from-source] Done: ${docxPath}`);
    }
  } finally {
    await closeBrowser().catch(() => {});
    deleteSession(session.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
