import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function pdfimagesAvailable(): boolean {
  try {
    execFileSync('pdfimages', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execFileSync('pdfimages.exe', ['-v'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

/** Row: 0-based global image index, 1-based page number (as reported by pdfimages). */
export interface PdfImageListRow {
  index: number;
  page: number;
}

/**
 * Parse `pdfimages -list` stdout. Format varies slightly by Poppler version;
 * we look for numeric columns after skipping the header line.
 */
export function parsePdfimagesList(stdout: string): PdfImageListRow[] {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: PdfImageListRow[] = [];
  let idx = 0;
  for (const line of lines) {
    if (/^\s*page\s+/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const page = parseInt(parts[0], 10);
    if (!Number.isFinite(page) || page < 1) continue;
    rows.push({ index: idx++, page });
  }
  return rows;
}

export async function listPdfImages(pdfPath: string): Promise<PdfImageListRow[]> {
  const { stdout } = await execFileAsync('pdfimages', ['-list', pdfPath], {
    maxBuffer: 20 * 1024 * 1024,
    encoding: 'utf-8',
  });
  return parsePdfimagesList(stdout);
}

/**
 * Extract all embedded images as PNG into `outDir` with basename `prefix`.
 * Returns sorted list of written file paths (basename order).
 */
export async function extractPdfImagesPng(pdfPath: string, outDir: string, prefix: string): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, prefix);
  await execFileAsync('pdfimages', ['-png', '-r', '144', pdfPath, base], {
    maxBuffer: 50 * 1024 * 1024,
  });
  const names = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith(prefix) && /\.(png|jpg|ppm|pbm|pgm)$/i.test(f))
    .sort();
  return names.map((f) => path.join(outDir, f));
}
