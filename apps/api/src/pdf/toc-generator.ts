interface TocEntry {
  level: number;
  text: string;
  id: string;
}

export function extractHeadings(html: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const regex = /<h([12])\s+id="([^"]*)"[^>]*>(.*?)<\/h[12]>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    entries.push({
      level: parseInt(match[1], 10),
      text: match[3].replace(/<[^>]*>/g, ''),
      id: match[2],
    });
  }

  return entries;
}

export function buildTocHtml(entries: TocEntry[]): string {
  const lines: string[] = ['<nav class="toc">', '<h2>Table of Contents</h2>', '<ul>'];

  let inSublist = false;

  for (const entry of entries) {
    if (entry.level === 1) {
      if (inSublist) {
        lines.push('</ul></li>');
        inSublist = false;
      }
      lines.push(`<li><a href="#${entry.id}">${entry.text}</a>`);
    } else if (entry.level === 2) {
      if (!inSublist) {
        lines.push('<ul>');
        inSublist = true;
      }
      lines.push(`<li><a href="#${entry.id}">${entry.text}</a></li>`);
    }
  }

  if (inSublist) {
    lines.push('</ul></li>');
  }

  lines.push('</ul>', '</nav>');
  return lines.join('\n');
}
