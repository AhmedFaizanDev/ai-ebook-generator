import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function commandWorks(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execFileSync(`${cmd}.exe`, args, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

export function ocrToolchainAvailable(): { pdftoppm: boolean; tesseract: boolean } {
  return {
    pdftoppm: commandWorks('pdftoppm', ['-h']),
    tesseract: commandWorks('tesseract', ['--version']),
  };
}

/**
 * Rasterize each PDF page and OCR with Tesseract. Returns concatenated plain text
 * with page markers (for merging with image placement heuristics).
 */
export async function ocrPdfToText(pdfPath: string, workDir: string): Promise<string> {
  fs.mkdirSync(workDir, { recursive: true });
  const prefix = path.join(workDir, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '200', pdfPath, prefix], {
    maxBuffer: 50 * 1024 * 1024,
  });
  const pngs = fs
    .readdirSync(workDir)
    .filter((f) => f.startsWith('page-') && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const chunks: string[] = [];
  let pageNum = 1;
  for (const png of pngs) {
    const fp = path.join(workDir, png);
    const { stdout } = await execFileAsync('tesseract', [fp, 'stdout', '-l', 'eng'], {
      maxBuffer: 20 * 1024 * 1024,
      encoding: 'utf-8',
    });
    const text = (stdout as string).trim();
    if (text.length > 0) {
      chunks.push(`\n\n## Page ${pageNum}\n\n${text}`);
    }
    pageNum++;
  }
  return chunks.join('\n\n').trim();
}
