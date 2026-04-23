import type { SourceFlatSection } from '@/ingest/source-seed/types';

function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Split markdown into ordered sections by ATX headings (# .. ###).
 * Body under each heading until the next same-or-higher level heading.
 */
export function splitMarkdownToFlatSections(markdown: string, displayTitle: string): SourceFlatSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: SourceFlatSection[] = [];
  let current: { level: 1 | 2 | 3; heading: string; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const bodyMarkdown = current.body.join('\n').trim();
    sections.push({
      heading: current.heading,
      level: current.level,
      bodyMarkdown,
      wordCount: countWords(bodyMarkdown),
    });
    current = null;
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (m) {
      const level = Math.min(3, m[1]!.length) as 1 | 2 | 3;
      const heading = m[2]!.trim();
      if (heading.toLowerCase() === displayTitle.toLowerCase() && level === 1) {
        continue;
      }
      flush();
      current = { level, heading, body: [] };
      continue;
    }
    if (!current) {
      if (line.trim()) {
        current = { level: 2, heading: 'Body', body: [line] };
      }
      continue;
    }
    current.body.push(line);
  }
  flush();

  if (sections.length === 0 && markdown.trim()) {
    return [
      {
        heading: 'Overview',
        level: 2,
        bodyMarkdown: markdown.trim(),
        wordCount: countWords(markdown),
      },
    ];
  }
  return sections;
}
