import fs from 'fs';
import path from 'path';

export interface BookResult {
  title: string;
  domain: string;
  status: 'completed' | 'failed';
  reason?: string;
  pdfDriveId?: string;
  docxDriveId?: string;
}

export interface ProgressData {
  results: BookResult[];
  startedAt: string;
  lastUpdatedAt: string;
}

const PROGRESS_FILE = path.resolve(process.cwd(), '.repair-progress.json');

export function loadProgress(): ProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {
    console.warn('[progress] Could not read progress file, starting fresh');
  }
  return { results: [], startedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() };
}

export function saveProgress(data: ProgressData): void {
  data.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function isAlreadyProcessed(data: ProgressData, title: string): boolean {
  return data.results.some((r) => r.title === title && r.status === 'completed');
}

export function recordResult(data: ProgressData, result: BookResult): void {
  const idx = data.results.findIndex((r) => r.title === result.title);
  if (idx >= 0) {
    data.results[idx] = result;
  } else {
    data.results.push(result);
  }
  saveProgress(data);
}

export function writeReport(data: ProgressData): void {
  const reportDir = process.cwd();
  fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(data, null, 2), 'utf-8');

  const failures = data.results.filter((r) => r.status === 'failed');
  if (failures.length > 0) {
    const header = 'title,domain,reason\n';
    const rows = failures.map((f) => `"${f.title}","${f.domain}","${(f.reason ?? '').replace(/"/g, '""')}"`).join('\n');
    fs.writeFileSync(path.join(reportDir, 'failures.csv'), header + rows + '\n', 'utf-8');
  }

  const ok = data.results.filter((r) => r.status === 'completed').length;
  const fail = failures.length;
  console.log(`\n[report] ${ok} completed, ${fail} failed. See results.json / failures.csv`);
}
