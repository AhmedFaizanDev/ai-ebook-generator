#!/usr/bin/env tsx
/**
 * CLI batch generator — run directly via `npx tsx src/cli/batch.ts <file>`
 *
 * Reads book titles from a CSV or XLSX file. Column A = title, column B = optional author (used on cover),
 * column C = optional ISBN (shown on copyright page). If author is missing, a random author from a fixed list is used. Then for each row:
 *   orchestrate → PDF → DOCX → upload to Google Drive
 *
 * Features:
 *   - Idempotent job tracking: completed list = skip; existing session file = resume from checkpoint
 *   - Stable session id per title so the same book always resumes to the same checkpoint
 *   - Automatic retry rounds: failed books are retried in the same run (up to BATCH_MAX_RETRY_ROUNDS, default 5)
 *   - Cooldown between books and between retry rounds to avoid rate limits
 *   - Memory cleanup after each book
 *   - Single-writer: run one batch process per progress file / .sessions dir (e.g. one AWS instance)
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
import { closeBrowser } from '@/pdf/browser-pool';
import { exportDOCX } from '@/docx/generate-docx';
import {
  uploadPdfToDrive,
  uploadDocxToDrive,
  bookAlreadyInDrive,
  resolveUploadFolders,
  type UploadFolders,
} from '@/drive/upload';
import { getDriveClient } from '@/drive/auth';
import { loadSessionById, deletePersistedSession } from '@/lib/session-store';
import { isTechnicalTopic } from '@/lib/topic-classifier';
import type { SessionState } from '@/lib/types';

const SESSIONS_DIR = path.resolve(process.cwd(), '.sessions');
const PROGRESS_FILE = process.env.BATCH_PROGRESS_FILE
  ? path.resolve(process.env.BATCH_PROGRESS_FILE)
  : path.resolve(process.cwd(), '.batch-progress.json');
const COOLDOWN_BETWEEN_BOOKS_MS = 5_000;
/** Max automatic retry rounds for failed books in the same run (set BATCH_MAX_RETRY_ROUNDS to override). */
const MAX_RETRY_ROUNDS = parseInt(process.env.BATCH_MAX_RETRY_ROUNDS ?? '5', 10);
/** Cooldown (ms) before starting a retry round (set BATCH_COOLDOWN_BETWEEN_ROUNDS_MS to override). */
const COOLDOWN_BETWEEN_ROUNDS_MS = parseInt(process.env.BATCH_COOLDOWN_BETWEEN_ROUNDS_MS ?? '30000', 10);
/** Skip generation if PDF + DOCX already exist in Drive (duplicate prevention). Default: true. */
const SKIP_IF_IN_DRIVE = process.env.BATCH_SKIP_IF_IN_DRIVE !== 'false';

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

/** Deterministic session id from book title so the same book always gets the same id (for checkpoint/resume). */
function stableSessionId(title: string): string {
  return crypto.createHash('sha256').update(title.normalize()).digest('hex').slice(0, 16);
}

interface BatchRow {
  title: string;
  author?: string;
  isbn?: string;
  domain?: string;
  /** When set, overrides keyword-based technical classification from title. */
  isTechnical?: boolean;
}

function createBatchSession(topic: string, author?: string, isbn?: string, stableId?: string, isTechnicalOverride?: boolean): SessionState {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const isTechnical = typeof isTechnicalOverride === 'boolean' ? isTechnicalOverride : isTechnicalTopic(topic);
  return {
    id: stableId ?? crypto.randomUUID(),
    status: 'queued',
    topic,
    isTechnical,
    author: author?.trim() || undefined,
    isbn: isbn?.trim() || undefined,
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

/** Get existing session from disk (by stable id) or create new one. Enables resume from checkpoint. */
function getOrCreateSessionForBook(
  title: string,
  author?: string,
  isbn?: string,
  isTechnicalOverride?: boolean,
): { session: SessionState; resumed: boolean } {
  const sid = stableSessionId(title);
  const existing = loadSessionById(sid);
  if (existing) {
    existing.lastActivityAt = Date.now();
    return { session: existing, resumed: true };
  }
  const session = createBatchSession(title, author, isbn, sid, isTechnicalOverride);
  return { session, resumed: false };
}

/** Clear in-memory session state to free memory. Does NOT delete the session file — success path calls deletePersistedSession; failed books keep their file for resume. */
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

/** Parse optional technical column: true for technical, false for non-technical, undefined if missing/unknown. */
function parseTechnicalValue(raw: string): boolean | undefined {
  const v = raw.trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'technical', 'tech'].includes(v)) return true;
  if (['false', 'no', 'n', '0', 'non-technical', 'nontechnical', 'non tech'].includes(v)) return false;
  return undefined;
}

async function readRowsFromExcel(filePath: string): Promise<BatchRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no worksheets');

  const rows: BatchRow[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const val = cell.value;
    headers[colNumber - 1] = val != null ? String(val).trim() : '';
  });

  const getCell = (row: ExcelJS.Row, key: string): string => {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === key.toLowerCase());
    if (idx < 0) return '';
    const val = row.getCell(idx + 1).value;
    return val != null ? unquote(String(val).trim()) : '';
  };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const title = getCell(row, 'title') || getCell(row, 'Title') || getCell(row, 'topic') || getCell(row, 'book') || getCell(row, 'Book Title');
    if (!title) return;
    const authorRaw = getCell(row, 'author') || getCell(row, 'Author');
    const isbnRaw = getCell(row, 'isbn') || getCell(row, 'ISBN');
    const domainRaw = getCell(row, 'domain') || getCell(row, 'Domain') || getCell(row, 'folder');
    const technicalRaw = getCell(row, 'technical') || getCell(row, 'isTechnical') || getCell(row, 'type');
    const isTechnical = parseTechnicalValue(technicalRaw);
    rows.push({
      title,
      author: authorRaw.length > 0 ? authorRaw : undefined,
      isbn: isbnRaw.length > 0 ? isbnRaw : undefined,
      domain: domainRaw.length > 0 ? domainRaw : undefined,
      isTechnical: isTechnical,
    });
  });
  return rows;
}

/** Get string value from a record by header name (case-insensitive). */
function getCol(record: Record<string, string>, ...names: string[]): string {
  const keys = Object.keys(record);
  for (const name of names) {
    const k = keys.find((key) => key.trim().toLowerCase() === name.toLowerCase());
    if (k != null && record[k] != null) return unquote(String(record[k]).trim());
  }
  return '';
}

function readRowsFromCsv(filePath: string): BatchRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  const rows: BatchRow[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const record = parsed[i];
    if (!record || typeof record !== 'object') continue;
    const title = getCol(record, 'title', 'book', 'topic');
    if (!title) continue;
    const authorRaw = getCol(record, 'author');
    const isbnRaw = getCol(record, 'isbn');
    const domainRaw = getCol(record, 'domain', 'folder');
    const technicalRaw = getCol(record, 'technical', 'isTechnical', 'type');
    const isTechnical = parseTechnicalValue(technicalRaw);
    rows.push({
      title,
      author: authorRaw.length > 0 ? authorRaw : undefined,
      isbn: isbnRaw.length > 0 ? isbnRaw : undefined,
      domain: domainRaw.length > 0 ? domainRaw : undefined,
      isTechnical,
    });
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
  isbn?: string,
  folders?: UploadFolders,
  isTechnicalOverride?: boolean,
): Promise<void> {
  const bookStartMs = Date.now();
  const mem = process.memoryUsage();
  console.log(`[BATCH] (${index + 1}/${total}) Generating: "${title}" | heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);

  const { session, resumed } = getOrCreateSessionForBook(title, author, isbn, isTechnicalOverride);
  session.batchIndex = index + 1;
  session.batchTotal = total;
  if (resumed) {
    console.log(`[BATCH] Resuming from checkpoint for "${title}" (session ${session.id})`);
  }

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

    await uploadPdfToDrive(session.pdfBuffer, `${safeName}.pdf`, folders?.pdfFolderId);
    await uploadDocxToDrive(docxBuffer, `${safeName}.docx`, folders?.docFolderId);

    deletePersistedSession(session.id);

    const elapsed = Math.round((Date.now() - bookStartMs) / 1000);
    console.log(`[BATCH] (${index + 1}/${total}) DONE: "${title}" in ${elapsed}s`);

    // Close browser after each book so next book gets a fresh Chromium (reduces "Target closed" in Docker)
    await closeBrowser();
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
  let rowsByTitle: BatchRow[] = [];
  for (const r of rawRows) {
    const key = r.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      rowsByTitle.push(r);
    } else {
      console.warn(`[BATCH] Skipping duplicate title: "${r.title}"`);
    }
  }

  // Dedupe by sanitized filename (titles that normalize to same output file)
  const seenFilename = new Set<string>();
  const rows: BatchRow[] = [];
  for (const r of rowsByTitle) {
    const fn = sanitizeFileName(r.title);
    if (!seenFilename.has(fn)) {
      seenFilename.add(fn);
      rows.push(r);
    } else {
      console.warn(`[BATCH] Skipping duplicate filename (maps to same output): "${r.title}"`);
    }
  }

  // Filter out blocked domains (STEM domains paused for this batch run)
  const BLOCKED_DOMAINS = new Set(['physics', 'chemistry', 'mathematics', 'maths', 'engineering']);
  const blockedCount = new Map<string, number>();
  const filteredRows: BatchRow[] = [];
  for (const r of rows) {
    const domainKey = (r.domain ?? '').trim().toLowerCase();
    if (BLOCKED_DOMAINS.has(domainKey)) {
      blockedCount.set(r.domain ?? domainKey, (blockedCount.get(r.domain ?? domainKey) ?? 0) + 1);
    } else {
      filteredRows.push(r);
    }
  }
  if (blockedCount.size > 0) {
    const total = [...blockedCount.values()].reduce((a, b) => a + b, 0);
    console.log(`[BATCH] Skipping ${total} title(s) from blocked domains:`);
    for (const [domain, count] of blockedCount) {
      console.log(`[BATCH]   - ${domain}: ${count}`);
    }
  }

  const titles = filteredRows.map((r) => r.title);
  const progress = loadProgress();

  // Deduplicate the failed list from previous runs
  progress.failed = [...new Set(progress.failed)];
  saveProgress(progress);

  const alreadyDone = new Set(progress.completed);
  let remainingRows = filteredRows.filter((r) => !alreadyDone.has(r.title));
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

  // Domain-based folders: root → domain → PDF, Doc (no instance level)
  const rootId = process.env.GDRIVE_EBOOKS_ROOT_ID;
  const useDomainFolders = !!rootId;

  // Validate Drive config before processing any book (fail fast)
  if (useDomainFolders) {
    try {
      const drive = getDriveClient();
      await drive.files.get({ fileId: rootId, fields: 'id', supportsAllDrives: true });
      console.log('[BATCH] Drive root folder validated (domain-based upload).');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : undefined;
      console.error(`[BATCH] Drive validation failed (root folder): ${msg}`);
      if (code !== undefined) console.error(`[BATCH] API response code: ${code}`);
      if (/invalid_grant|Token has been expired|credentials/i.test(msg)) {
        console.error('[BATCH] Re-run OAuth, update GDRIVE_REFRESH_TOKEN, then restart.');
      } else if (/File not found|404|not found/i.test(msg) || code === 404) {
        console.error('[BATCH] Root folder not visible. Check GDRIVE_EBOOKS_ROOT_ID and Drive permissions.');
      }
      process.exit(1);
    }
  } else {
    const pdfFolderId = process.env.GDRIVE_PDF_FOLDER_ID;
    const docFolderId = process.env.GDRIVE_DOC_FOLDER_ID;
    if (!pdfFolderId || !docFolderId) {
      console.error(
        '[BATCH] Missing Drive config. Set either GDRIVE_EBOOKS_ROOT_ID (domain-based) or GDRIVE_PDF_FOLDER_ID and GDRIVE_DOC_FOLDER_ID in .env',
      );
      process.exit(1);
    }
    try {
      const drive = getDriveClient();
      await drive.files.get({ fileId: pdfFolderId, fields: 'id' });
      await drive.files.get({ fileId: docFolderId, fields: 'id' });
      console.log('[BATCH] Drive folders validated (legacy).');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : undefined;
      console.error(`[BATCH] Drive validation failed: ${msg}`);
      if (code !== undefined) console.error(`[BATCH] API response code: ${code}`);
      if (/invalid_grant|Token has been expired|credentials/i.test(msg)) {
        console.error('[BATCH] Re-run OAuth, update GDRIVE_REFRESH_TOKEN, then restart.');
      } else if (/File not found|404|not found/i.test(msg) || code === 404) {
        console.error('[BATCH] Folder not visible to this token. Fix: (1) Rebuild image so app uses full Drive scope. (2) Run OAuth again (localhost:4000/auth/google or your server URL). (3) Sign in with the Google account that OWNS the folders. (4) Put the NEW refresh token in .env and restart.');
      }
      process.exit(1);
    }
  }

  const sessionErrors: Array<{ title: string; error: string }> = [];
  let round = 0;

  while (remainingRows.length > 0 && round < MAX_RETRY_ROUNDS) {
    if (round > 0) {
      console.log(`\n[BATCH] === Retry round ${round + 1}/${MAX_RETRY_ROUNDS}: ${remainingRows.length} book(s) still not completed ===\n`);
      if (COOLDOWN_BETWEEN_ROUNDS_MS > 0) {
        console.log(`[BATCH] Cooldown ${COOLDOWN_BETWEEN_ROUNDS_MS / 1000}s before retry round...`);
        await new Promise((r) => setTimeout(r, COOLDOWN_BETWEEN_ROUNDS_MS));
      }
    }

    for (let i = 0; i < remainingRows.length; i++) {
      const row = remainingRows[i];
      const globalIdx = titles.indexOf(row.title);

      const safeName = sanitizeFileName(row.title);
      if (!safeName) {
        console.error(`[BATCH] Skipping (title sanitizes to empty filename): "${row.title}"`);
        progress.completed.push(row.title);
        saveProgress(progress);
        continue;
      }

      let folders: UploadFolders | undefined;
      if (useDomainFolders && row.domain) {
        try {
          folders = await resolveUploadFolders(row.domain);
        } catch (driveErr) {
          const errMsg = driveErr instanceof Error ? driveErr.message : String(driveErr);
          console.error(`[BATCH] Resolve folders failed for "${row.title}" (domain: ${row.domain}) — ${errMsg}. Adding to failed.`);
          if (!progress.failed.includes(row.title)) progress.failed.push(row.title);
          saveProgress(progress);
          sessionErrors.push({ title: row.title, error: `Drive resolve failed: ${errMsg}` });
          continue;
        }
      }

      if (SKIP_IF_IN_DRIVE) {
        const pdfName = `${safeName}.pdf`;
        const docxName = `${safeName}.docx`;
        let alreadyInDrive = false;
        try {
          alreadyInDrive = await bookAlreadyInDrive(pdfName, docxName, folders);
        } catch (driveErr) {
          const errMsg = driveErr instanceof Error ? driveErr.message : String(driveErr);
          console.error(`[BATCH] Drive check failed for "${row.title}" — ${errMsg}. Adding to failed; re-run after fixing connectivity.`);
          if (!progress.failed.includes(row.title)) progress.failed.push(row.title);
          saveProgress(progress);
          sessionErrors.push({ title: row.title, error: `Drive check failed: ${errMsg}` });
          continue;
        }
        if (alreadyInDrive) {
          console.log(`[BATCH] (${globalIdx + 1}/${titles.length}) Skipping (already in Drive): "${row.title}"`);
          progress.completed.push(row.title);
          const failedIdx = progress.failed.indexOf(row.title);
          if (failedIdx !== -1) progress.failed.splice(failedIdx, 1);
          saveProgress(progress);
          continue;
        }
      }

      try {
        await processBook(row.title, globalIdx, titles.length, row.author, row.isbn, folders, row.isTechnical);
        progress.completed.push(row.title);
        const failedIdx = progress.failed.indexOf(row.title);
        if (failedIdx !== -1) progress.failed.splice(failedIdx, 1);
        saveProgress(progress);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[BATCH] FAILED: "${row.title}" — ${errMsg}\n`);
        if (!progress.failed.includes(row.title)) {
          progress.failed.push(row.title);
        }
        saveProgress(progress);
        sessionErrors.push({ title: row.title, error: errMsg });
        await closeBrowser().catch(() => {}); // fresh browser for next book
      }

      if (i < remainingRows.length - 1) {
        console.log(`[BATCH] Cooling down ${COOLDOWN_BETWEEN_BOOKS_MS / 1000}s before next book...`);
        await new Promise((r) => setTimeout(r, COOLDOWN_BETWEEN_BOOKS_MS));

        if (global.gc) {
          global.gc();
        }
      }
    }

    round++;
    remainingRows = filteredRows.filter((r) => !progress.completed.includes(r.title));
  }

  await closeBrowser().catch(() => {});

  const successCount = progress.completed.length;
  const stillFailedCount = progress.failed.length;

  console.log('\n========================================');
  console.log('             BATCH SUMMARY              ');
  console.log('========================================');
  console.log(`Total in file:   ${titles.length}`);
  console.log(`Completed (all): ${successCount}`);
  console.log(`Still failed:    ${stillFailedCount}`);
  console.log(`Skipped (done):  ${alreadyDone.size}`);
  if (round > 1) {
    console.log(`Retry rounds:    ${round} (max ${MAX_RETRY_ROUNDS})`);
  }

  if (sessionErrors.length > 0) {
    console.log('\nLast failure per book (may have been retried):');
    const byTitle = new Map(sessionErrors.map((e) => [e.title, e.error]));
    for (const [title, error] of byTitle) {
      console.log(`  - "${title}": ${error}`);
    }
  }

  if (progress.failed.length > 0) {
    console.log('\nTitles still not completed (after automatic retries):');
    for (const t of progress.failed) {
      console.log(`  - "${t}"`);
    }
    console.log('\nRe-run the same batch command to retry these again (or fix .batch-progress.json).');
  }

  console.log('========================================\n');

  process.exit(stillFailedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[BATCH] Fatal error:', err);
  process.exit(1);
});
