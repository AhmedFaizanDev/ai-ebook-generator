#!/usr/bin/env tsx
/**
 * CLI batch generator — run directly via `npx tsx src/cli/batch.ts <file>`
 *
 * Reads book titles from a CSV or XLSX file. Column A = title, column B = optional author (used on cover).
 * If author is missing, a random author from a fixed list is used. Then for each row:
 *   orchestrate → PDF → DOCX → upload to Google Drive
 *
 * Features:
 *   - Resume support: skips titles already in progress file
 *   - Cooldown between books to avoid rate limits
 *   - Memory cleanup after each book
 *
 * Usage:
 *   npx tsx src/cli/batch.ts path/to/books.csv
 *   npm run batch -- path/to/books.csv
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { orchestrate } from '@/orchestrator/index';
import { rebuildFinalMarkdown } from '@/orchestrator/build-markdown';
import { exportPDF } from '@/pdf/generate-pdf';
import { exportDOCX } from '@/docx/generate-docx';
import { uploadPdfToDrive, uploadDocxToDrive } from '@/drive/upload';
import { closeBrowser } from '@/pdf/browser-pool';
import type { SessionState } from '@/lib/types';

const SESSIONS_DIR = path.resolve(process.cwd(), '.sessions');
const PROGRESS_FILE = process.env.BATCH_PROGRESS_FILE
  ? path.resolve(process.env.BATCH_PROGRESS_FILE)
  : path.resolve(process.cwd(), '.batch-progress.json');
const COOLDOWN_BETWEEN_BOOKS_MS = 5_000;

// ---------------------------------------------------------------------------
// Progress tracking (enables resume after crash)
// ---------------------------------------------------------------------------

interface BatchProgress {
  completed: string[];
  failed: string[];
  startedAt: string;
  lastUpdatedAt: string;
}

function loadProgress(): BatchProgress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    console.warn('[BATCH] Could not read progress file, starting fresh');
  }
  return {
    completed: [],
    failed: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

function saveProgress(progress: BatchProgress): void {
  progress.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileName(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

interface BatchRow {
  title: string;
  author?: string;
}

function createBatchSession(topic: string, author?: string): SessionState {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return {
    id: crypto.randomUUID(),
    status: 'queued',
    topic,
    author: author?.trim() || undefined,
    model,
    phase: 'init',
    progress: 0,
    currentUnit: 0,
    currentSubtopic: 0,
    structure: null,
    unitMarkdowns: [],
    microSummaries: [],
    unitSummaries: [],
    prefaceMarkdown: null,
    unitIntroductions: [],
    unitEndSummaries: [],
    unitExercises: [],
    capstonesMarkdown: null,
    caseStudiesMarkdown: null,
    glossaryMarkdown: null,
    bibliographyMarkdown: null,
    finalMarkdown: null,
    pdfBuffer: null,
    error: null,
    callCount: 0,
    tokenCount: 0,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    subtopicMarkdowns: new Map(),
    subtopicVersions: new Map(),
    editCount: 0,
  };
}

function freeSession(session: SessionState): void {
  session.pdfBuffer = null;
  session.finalMarkdown = null;
  session.unitMarkdowns = [];
  session.microSummaries = [];
  session.unitSummaries = [];
  session.prefaceMarkdown = null;
  session.unitIntroductions = [];
  session.unitEndSummaries = [];
  session.unitExercises = [];
  session.capstonesMarkdown = null;
  session.caseStudiesMarkdown = null;
  session.glossaryMarkdown = null;
  session.bibliographyMarkdown = null;
  session.structure = null;
  session.subtopicMarkdowns.clear();
  session.subtopicVersions.clear();

  try {
    const fp = path.join(SESSIONS_DIR, `${session.id}.json`);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    // ignore cleanup errors
  }
}

// ---------------------------------------------------------------------------
// File readers
// ---------------------------------------------------------------------------

/** Strip surrounding double quotes if present (e.g. "faizan" -> faizan). */
function unquote(value: string): string {
  const s = value.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).trim();
  }
  return s;
}

async function readRowsFromExcel(filePath: string): Promise<BatchRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no worksheets');

  const rows: BatchRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const titleVal = row.getCell(1).value;
    const authorVal = row.getCell(2).value;
    if (titleVal !== null && titleVal !== undefined) {
      const title = unquote(String(titleVal));
      if (title.length > 0) {
        const authorRaw =
          authorVal !== null && authorVal !== undefined ? unquote(String(authorVal)) : '';
        rows.push({ title, author: authorRaw.length > 0 ? authorRaw : undefined });
      }
    }
  });
  return rows;
}

function readRowsFromCsv(filePath: string): BatchRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parse(content, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as string[][];

  const rows: BatchRow[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const firstCol = parsed[i]?.[0];
    const secondCol = parsed[i]?.[1];
    if (i === 0 && firstCol && /title|book|topic/i.test(unquote(String(firstCol)))) {
      continue;
    }
    if (firstCol && unquote(String(firstCol)).length > 0) {
      const title = unquote(String(firstCol));
      const authorRaw = secondCol != null ? unquote(String(secondCol)) : '';
      const author = authorRaw.length > 0 ? authorRaw : undefined;
      rows.push({ title, author });
    }
  }
  return rows;
}

async function readRowsFromFile(filePath: string): Promise<BatchRow[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return readRowsFromCsv(filePath);
  return readRowsFromExcel(filePath);
}

// ---------------------------------------------------------------------------
// Per-book processing
// ---------------------------------------------------------------------------

async function processBook(
  title: string,
  index: number,
  total: number,
  author?: string,
): Promise<void> {
  const bookStartMs = Date.now();
  const mem = process.memoryUsage();
  console.log(`[BATCH] (${index + 1}/${total}) Generating: "${title}" | heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);

  const session = createBatchSession(title, author);

  try {
    await orchestrate(session);

    if (session.status === 'failed') {
      throw new Error(session.error || 'Orchestration failed');
    }

    if (!session.finalMarkdown) {
      session.finalMarkdown = rebuildFinalMarkdown(session);
    }

    const safeName = sanitizeFileName(title);

    await exportPDF(session);
    if (!session.pdfBuffer) {
      throw new Error('PDF export produced no buffer');
    }
    console.log(`[BATCH] (${index + 1}/${total}) PDF ready for "${title}" (${session.callCount} calls, ${session.tokenCount} tokens)`);

    session.finalMarkdown = rebuildFinalMarkdown(session);
    const docxBuffer = await exportDOCX(session);
    console.log(`[BATCH] (${index + 1}/${total}) DOCX ready for "${title}"`);

    await uploadPdfToDrive(session.pdfBuffer, `${safeName}.pdf`);
    await uploadDocxToDrive(docxBuffer, `${safeName}.docx`);

    const elapsed = Math.round((Date.now() - bookStartMs) / 1000);
    console.log(`[BATCH] (${index + 1}/${total}) DONE: "${title}" in ${elapsed}s`);
  } finally {
    freeSession(session);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DEFAULT_CSV = '/data/batch-sample.csv';

async function main(): Promise<void> {
  const filePath = process.argv[2] || DEFAULT_CSV;

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.csv' && ext !== '.xlsx') {
    console.error(`Unsupported file type "${ext}". Use .csv or .xlsx`);
    process.exit(1);
  }

  console.log(`[BATCH] Reading titles from: ${resolved}`);
  const rawRows = await readRowsFromFile(resolved);

  if (rawRows.length === 0) {
    console.error('[BATCH] No titles found in column A. Exiting.');
    process.exit(1);
  }

  const seen = new Set<string>();
  const rows: BatchRow[] = [];
  for (const r of rawRows) {
    const key = r.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(r);
    } else {
      console.warn(`[BATCH] Skipping duplicate title: "${r.title}"`);
    }
  }

  const titles = rows.map((r) => r.title);
  const progress = loadProgress();

  // Deduplicate the failed list from previous runs
  progress.failed = [...new Set(progress.failed)];
  saveProgress(progress);

  const alreadyDone = new Set(progress.completed);
  const remainingRows = rows.filter((r) => !alreadyDone.has(r.title));
  const retrying = remainingRows.filter((r) => progress.failed.includes(r.title));

  console.log(`[BATCH] Found ${titles.length} title(s). Already completed: ${alreadyDone.size}. Remaining: ${remainingRows.length}.`);
  if (retrying.length > 0) {
    console.log(`[BATCH] Retrying ${retrying.length} previously failed title(s).`);
  }
  console.log('');

  if (remainingRows.length === 0) {
    console.log('[BATCH] All titles already completed. Nothing to do.');
    console.log('[BATCH] To re-run, delete .batch-progress.json and run again.');
    process.exit(0);
  }

  let successCount = progress.completed.length;
  let failCount = 0;
  const sessionErrors: Array<{ title: string; error: string }> = [];

  for (let i = 0; i < remainingRows.length; i++) {
    const row = remainingRows[i];
    const globalIdx = titles.indexOf(row.title);

    try {
      await processBook(row.title, globalIdx, titles.length, row.author);
      progress.completed.push(row.title);
      const failedIdx = progress.failed.indexOf(row.title);
      if (failedIdx !== -1) progress.failed.splice(failedIdx, 1);
      saveProgress(progress);
      successCount++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[BATCH] FAILED: "${row.title}" — ${errMsg}\n`);
      if (!progress.failed.includes(row.title)) {
        progress.failed.push(row.title);
      }
      saveProgress(progress);
      sessionErrors.push({ title: row.title, error: errMsg });
      failCount++;
    }

    if (i < remainingRows.length - 1) {
      console.log(`[BATCH] Cooling down ${COOLDOWN_BETWEEN_BOOKS_MS / 1000}s before next book...`);
      await new Promise((r) => setTimeout(r, COOLDOWN_BETWEEN_BOOKS_MS));

      if (global.gc) {
        global.gc();
      }
    }
  }

  await closeBrowser().catch(() => {});

  console.log('\n========================================');
  console.log('             BATCH SUMMARY              ');
  console.log('========================================');
  console.log(`Total in file:   ${titles.length}`);
  console.log(`Completed (all): ${successCount}`);
  console.log(`Failed (run):    ${failCount}`);
  console.log(`Skipped (done):  ${alreadyDone.size}`);

  if (sessionErrors.length > 0) {
    console.log('\nFailed books this run:');
    for (const e of sessionErrors) {
      console.log(`  - "${e.title}": ${e.error}`);
    }
  }

  if (progress.failed.length > 0) {
    console.log('\nAll failed titles (including previous runs):');
    for (const t of progress.failed) {
      console.log(`  - "${t}"`);
    }
    console.log('\nTo retry failed titles, remove them from .batch-progress.json "failed" array');
    console.log('and re-run the command.');
  }

  console.log('========================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[BATCH] Fatal error:', err);
  process.exit(1);
});
