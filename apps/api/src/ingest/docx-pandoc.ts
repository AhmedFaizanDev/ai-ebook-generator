import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type PandocResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

/**
 * Optional Pandoc path for better Word native math → Markdown LaTeX than Mammoth alone.
 * Enable with INGEST_DOCX_MATH=pandoc and install pandoc on PATH (or set PANDOC_PATH).
 */
export async function pandocDocxToMarkdown(docxPath: string): Promise<PandocResult> {
  const pandocBin = process.env.PANDOC_PATH || 'pandoc';
  try {
    const { stdout } = await execFileAsync(
      pandocBin,
      ['--wrap=none', '-f', 'docx', '-t', 'markdown-smart', docxPath],
      {
        maxBuffer: 80 * 1024 * 1024,
        encoding: 'utf-8',
      },
    );
    return { ok: true, markdown: (stdout as string).trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Append Mammoth-only `![](rvimg://...)` lines so PDF pipeline still resolves ingest images. */
export function appendMammothRvimgFigures(pandocMarkdown: string, mammothMarkdown: string): string {
  const lines = mammothMarkdown.split(/\r?\n/);
  const imgs: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^!\[[^\]]*\]\(rvimg:\/\/[^)]+\)$/.test(t)) imgs.push(t);
  }
  if (imgs.length === 0) return pandocMarkdown.trim();
  return `${pandocMarkdown.trim()}\n\n### Figures from source\n\n${imgs.join('\n\n')}`;
}
