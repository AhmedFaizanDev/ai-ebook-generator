#!/usr/bin/env tsx
/**
 * One-off CLI: repair corrupted Bibliography sections in already-generated ebooks.
 *
 * Usage:
 *   npm run repair -- path/to/affected.csv
 *
 * CSV columns: title, domain (required), author (optional)
 *
 * For each row:
 *   1. Download original PDF + DOCX from source Drive root (by domain).
 *   2. Generate a clean bibliography via LLM (validate → repair → fallback).
 *   3. Patch DOCX: replace Bibliography section XML.
 *   4. Patch PDF: remove old bibliography pages, append new rendered pages.
 *   5. Upload corrected files to destination Drive root (mirrored domain structure).
 *   6. Record result to progress file (resumable).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PDFDocument } from 'pdf-lib';
import {
  resolveSourceFolders,
  resolveOrCreateDestFolders,
  findFileInFolder,
  downloadFile,
  uploadFile,
} from './drive';
import { generateBibliography, bibliographyToHtml } from './bibliography';
import { patchDocx } from './patch-docx';
import { findBibliographyStartPage, renderBibliographyPdf, patchPdf } from './patch-pdf';
import {
  loadProgress,
  isAlreadyProcessed,
  recordResult,
  writeReport,
  type BookResult,
  type ProgressData,
} from './progress';

const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? '2', 10);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeFileName(title: string): string {
  return title.replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

interface CsvRow {
  title: string;
  domain: string;
  author?: string;
}

function readCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, relax_quotes: true }) as Record<string, string>[];

  const rows: CsvRow[] = [];
  for (const rec of records) {
    const title = (rec.title || rec.Title || rec.topic || rec.Book || '').trim();
    const domain = (rec.domain || rec.Domain || rec.folder || '').trim();
    if (!title || !domain) continue;
    const author = (rec.author || rec.Author || '').trim() || undefined;
    rows.push({ title, domain, author });
  }
  return rows;
}

async function processOneBook(
  row: CsvRow,
  idx: number,
  total: number,
  progress: ProgressData,
): Promise<void> {
  const tag = `(${idx + 1}/${total})`;
  const safeName = sanitizeFileName(row.title);
  console.log(`\n${tag} Processing: "${row.title}" [${row.domain}]`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 1. Resolve source folders and find files
      const src = await resolveSourceFolders(row.domain);
      const pdfFileId = await findFileInFolder(`${safeName}.pdf`, src.pdfFolderId);
      const docxFileId = await findFileInFolder(`${safeName}.docx`, src.docFolderId);

      if (!pdfFileId && !docxFileId) {
        throw new Error(`Neither PDF nor DOCX found in source Drive for "${safeName}"`);
      }

      // 2. Generate clean bibliography
      console.log(`${tag} Generating bibliography for "${row.title}"...`);
      const bibMd = await generateBibliography(row.title);
      const bibHtml = bibliographyToHtml(bibMd);

      let pdfDriveId: string | undefined;
      let docxDriveId: string | undefined;

      // 3. Patch DOCX
      if (docxFileId) {
        console.log(`${tag} Downloading DOCX...`);
        const docxBuf = await downloadFile(docxFileId);
        console.log(`${tag} Patching DOCX bibliography...`);
        const patchedDocx = await patchDocx(docxBuf, bibMd);

        const dest = await resolveOrCreateDestFolders(row.domain);
        console.log(`${tag} Uploading patched DOCX...`);
        docxDriveId = await uploadFile(
          patchedDocx,
          `${safeName}.docx`,
          dest.docFolderId,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
      } else {
        console.warn(`${tag} DOCX not found — skipping DOCX patch`);
      }

      // 4. Patch PDF
      if (pdfFileId) {
        console.log(`${tag} Downloading PDF...`);
        const pdfBuf = await downloadFile(pdfFileId);
        console.log(`${tag} Detecting bibliography start page...`);
        const bibPage = await findBibliographyStartPage(pdfBuf);

        if (bibPage < 0) {
          console.warn(`${tag} Could not detect bibliography page — appending new bibliography at end`);
        }

        console.log(`${tag} Rendering new bibliography PDF pages...`);
        const newBibPdf = await renderBibliographyPdf(bibHtml);

        console.log(`${tag} Merging PDF...`);
        const startPage = bibPage >= 0 ? bibPage : (await getPageCount(pdfBuf));
        const patchedPdf = await patchPdf(pdfBuf, newBibPdf, startPage);

        const dest = await resolveOrCreateDestFolders(row.domain);
        console.log(`${tag} Uploading patched PDF...`);
        pdfDriveId = await uploadFile(
          patchedPdf,
          `${safeName}.pdf`,
          dest.pdfFolderId,
          'application/pdf',
        );
      } else {
        console.warn(`${tag} PDF not found — skipping PDF patch`);
      }

      recordResult(progress, {
        title: row.title,
        domain: row.domain,
        status: 'completed',
        pdfDriveId,
        docxDriveId,
      });
      console.log(`${tag} DONE: "${row.title}"`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} Attempt ${attempt + 1} failed: ${msg}`);
      if (attempt < MAX_RETRIES) {
        console.log(`${tag} Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        recordResult(progress, { title: row.title, domain: row.domain, status: 'failed', reason: msg });
      }
    }
  }
}

async function getPageCount(pdfBuf: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdfBuf);
  return doc.getPageCount();
}

/** Process books with bounded concurrency. */
async function runWithConcurrency(
  rows: CsvRow[],
  concurrency: number,
  progress: ProgressData,
): Promise<void> {
  let nextIdx = 0;
  const total = rows.length;

  async function worker(): Promise<void> {
    while (nextIdx < total) {
      const idx = nextIdx++;
      const row = rows[idx];
      if (isAlreadyProcessed(progress, row.title)) {
        console.log(`(${idx + 1}/${total}) Skipping already-completed: "${row.title}"`);
        continue;
      }
      await processOneBook(row, idx, total, progress);
      await sleep(2_000);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
}

async function main(): Promise<void> {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npm run repair -- path/to/affected.csv');
    process.exit(1);
  }

  const resolved = path.resolve(csvPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const rows = readCsv(resolved);
  if (rows.length === 0) {
    console.error('No valid rows found in CSV');
    process.exit(1);
  }

  console.log(`[repair] Found ${rows.length} book(s) to repair`);
  console.log(`[repair] Concurrency: ${CONCURRENCY}`);
  console.log(`[repair] Source root: ${process.env.GDRIVE_SOURCE_ROOT_ID}`);
  console.log(`[repair] Dest root:   ${process.env.GDRIVE_DEST_ROOT_ID}`);

  const progress = loadProgress();

  const alreadyDone = rows.filter((r) => isAlreadyProcessed(progress, r.title)).length;
  if (alreadyDone > 0) {
    console.log(`[repair] ${alreadyDone} already completed — will skip`);
  }

  await runWithConcurrency(rows, CONCURRENCY, progress);

  writeReport(progress);
}

main().catch((err) => {
  console.error('[repair] Fatal error:', err);
  process.exit(1);
});
