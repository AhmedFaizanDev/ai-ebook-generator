const STOP = new Set(
  'the a an and or for to of in on at by as is are was were be been being it this that these those with from into over per via'.split(' '),
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Cheap keyword list from headings + start of bodies (no LLM). */
export function extractGlobalKeywords(sections: { heading: string; bodyMarkdown: string }[], max = 40): string[] {
  const freq = new Map<string, number>();
  const bump = (w: string) => freq.set(w, (freq.get(w) ?? 0) + 3);
  const bumpLight = (w: string) => freq.set(w, (freq.get(w) ?? 0) + 1);

  for (const sec of sections) {
    for (const w of tokenize(sec.heading)) bump(w);
    const head = sec.bodyMarkdown.slice(0, 1200);
    for (const w of tokenize(head)) bumpLight(w);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

export function keywordsForText(text: string, max = 12): string[] {
  const freq = new Map<string, number>();
  for (const w of tokenize(text)) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}
