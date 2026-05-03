/**
 * Normalise syllabus / heading strings where pasted outlines omit spaces after
 * colons ("Management:Introduction") or use sloppy hyphen spacing ("Word- Next").
 * Used when parsing CSV syllabi and when rendering the Table of Contents so display
 * matches reader expectations. Does not alter hyphenated compounds like "Self-Organizing"
 * (no spaces around the hyphen).
 */
export function normalizeTitleSpacing(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 8; i++) {
    const next = t.replace(/([A-Za-z)]):([A-Za-z(0-9])/g, '$1: $2');
    if (next === t) break;
    t = next;
  }
  // "Management- Next" (missing space before hyphen)
  t = t.replace(/([A-Za-z0-9)])-\s+([A-Za-z(0-9])/g, '$1 - $2');
  // "Word -Next" (missing space after hyphen)
  t = t.replace(/([A-Za-z0-9)])\s+-([A-Za-z(0-9])/g, '$1 - $2');
  return t.replace(/\s+/g, ' ').trim();
}
