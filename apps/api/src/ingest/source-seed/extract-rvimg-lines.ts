/** Markdown image syntax pointing at ingest assets (`rvimg://…`). */
const RVIMG_MARKDOWN = /!\[[^\]]*\]\(rvimg:\/\/[^)]+\)/g;

/**
 * Unique `![](rvimg://id)` (or `![alt](rvimg://id)`) snippets in document order, capped.
 */
export function extractRvimgMarkdownLines(markdown: string, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(RVIMG_MARKDOWN)) {
    const line = m[0]!;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}
