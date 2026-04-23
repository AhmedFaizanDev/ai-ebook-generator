/** Split on lines that start with "# " but not "## " (ATX H1 only). */
export function splitByTopLevelHeading(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (/^# [^#]/.test(line) && cur.length > 0) {
      chunks.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks.map((c) => c.join('\n')).filter((s) => s.trim().length > 0);
}
