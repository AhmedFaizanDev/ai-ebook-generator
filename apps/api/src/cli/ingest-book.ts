#!/usr/bin/env tsx
/**
 * Ingest a legacy .pdf or .docx into Markdown and export PDF + DOCX via the normal HTML pipeline.
 *
 * Usage:
 *   npx tsx src/cli/ingest-book.ts path/to/book.pdf [--out dir] [--ocr] [--polish] [--premium] [--classify-only]
 *   Second positional argument is treated as output directory if --out is omitted (npm-friendly).
 *   npm run ingest-book -- path/to/book.docx
 *
 * Requires OPENAI_API_KEY when using --polish.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createSessionForIngest, deleteSession, saveSession } from '@/lib/session-store';
import { ingestFileToSession, classifyPdf } from '@/ingest/index';
import { exportPDF } from '@/pdf/generate-pdf';
import { exportDOCX } from '@/docx/generate-docx';
import { closeBrowser } from '@/pdf/browser-pool';

function parseArgs(argv: string[]): {
  file: string;
  outDir: string | null;
  ocr: boolean;
  polish: boolean;
  premium: boolean;
  classifyOnly: boolean;
  writeMarkdown: boolean;
} {
  const rest = argv.slice(2).filter((a) => a !== '--');
  let outDir: string | null = null;
  let ocr = false;
  let polish = false;
  let premium = false;
  let classifyOnly = false;
  let writeMarkdown = false;
  const pos: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === '--out' || a === '-o') {
      outDir = rest[++i] ?? null;
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
  if (!resolvedOut && pos.length >= 2) {
    resolvedOut = pos[1] ?? null;
  }
  return { file, outDir: resolvedOut, ocr, polish, premium, classifyOnly, writeMarkdown };
}

function sanitizeBase(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '').trim().slice(0, 180) || 'ingested-book';
}

async function main(): Promise<void> {
  const { file, outDir, ocr, polish, premium, classifyOnly, writeMarkdown } = parseArgs(process.argv);
  if (!file) {
    console.error('Usage: npx tsx src/cli/ingest-book.ts <file.pdf|file.docx> [--out dir] [--ocr] [--polish] [--premium] [--classify-only] [--md]');
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

  if (polish && !process.env.OPENAI_API_KEY) {
    console.error('--polish requires OPENAI_API_KEY');
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseName = sanitizeBase(path.basename(resolved, ext));
  const destDir = outDir ? path.resolve(outDir) : path.dirname(resolved);
  fs.mkdirSync(destDir, { recursive: true });

  const session = createSessionForIngest(baseName, model);

  try {
    const result = await ingestFileToSession(session, resolved, { ocr, polish, premium });
    for (const w of result.warnings) {
      console.warn(w);
    }
    saveSession(session);

    await exportPDF(session);
    if (!session.pdfBuffer?.length) {
      throw new Error('PDF export produced empty buffer');
    }
    const pdfPath = path.join(destDir, `${baseName}-ingest.pdf`);
    fs.writeFileSync(pdfPath, session.pdfBuffer);
    console.log(`[ingest-book] Wrote ${pdfPath}`);

    const docxBuf = await exportDOCX(session);
    const docxPath = path.join(destDir, `${baseName}-ingest.docx`);
    fs.writeFileSync(docxPath, docxBuf);
    console.log(`[ingest-book] Wrote ${docxPath}`);

    const mdPath = path.join(destDir, `${baseName}-ingest.md`);
    if (writeMarkdown && session.finalMarkdown) {
      fs.writeFileSync(mdPath, session.finalMarkdown, 'utf-8');
      console.log(`[ingest-book] Wrote ${mdPath}`);
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
