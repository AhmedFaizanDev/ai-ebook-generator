#!/usr/bin/env tsx
/**
 * Print batch progress: how many ebooks completed, how many failed.
 * Run from apps/api (or set cwd to where .batch-progress.json lives).
 *
 * Usage:
 *   npm run batch-status
 *   npx tsx src/cli/batch-status.ts
 */
import fs from 'fs';
import path from 'path';

const PROGRESS_FILE = process.env.BATCH_PROGRESS_FILE
  ? path.resolve(process.env.BATCH_PROGRESS_FILE)
  : path.resolve(process.cwd(), '.batch-progress.json');

interface BatchProgress {
  completed: string[];
  failed: string[];
  startedAt: string;
  lastUpdatedAt: string;
}

function main(): void {
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.log('No batch progress file found (.batch-progress.json).');
    console.log('Run a batch first: npm run batch -- your-books.csv');
    process.exit(0);
  }

  let progress: BatchProgress;
  try {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    console.error('Could not read .batch-progress.json');
    process.exit(1);
  }

  const completed = progress.completed ?? [];
  const failed = progress.failed ?? [];
  const lastUpdated = progress.lastUpdatedAt ?? progress.startedAt ?? '';

  console.log('');
  console.log('========================================');
  console.log('           BATCH PROGRESS               ');
  console.log('========================================');
  console.log(`Completed: ${completed.length} ebook(s)`);
  console.log(`Failed:    ${failed.length} ebook(s)`);
  if (lastUpdated) {
    console.log(`Updated:   ${lastUpdated}`);
  }
  console.log('----------------------------------------');

  if (completed.length > 0) {
    console.log('Completed titles:');
    completed.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log('');
  }

  if (failed.length > 0) {
    console.log('Failed titles (re-run batch after fixing or remove from .batch-progress.json):');
    failed.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log('');
  }

  console.log('========================================');
  console.log('');
}

main();
