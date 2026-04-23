/**
 * Optional unicode-to-LaTeX wrap for short technical lines (ingest).
 * Enable with INGEST_UNICODE_MATH_WRAP=1. Conservative: skips lines with `$`, code, headings, long prose.
 */

const MATHISH = /[∀∃∈∉∩∪⊆⊂∅→↦≤≥≠×±∑∏∫]/;

export function applyConservativeUnicodeMath(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('|') || t.startsWith('>')) {
      out.push(line);
      continue;
    }
    if (/\$/.test(line) || !MATHISH.test(line)) {
      out.push(line);
      continue;
    }
    if (line.length > 160 || t.split(/\s+/).length > 22) {
      out.push(line);
      continue;
    }

    let tex = line
      .replace(/∀/g, '\\forall ')
      .replace(/∃/g, '\\exists ')
      .replace(/∈/g, '\\in ')
      .replace(/∉/g, '\\notin ')
      .replace(/∩/g, '\\cap ')
      .replace(/∪/g, '\\cup ')
      .replace(/⊆/g, '\\subseteq ')
      .replace(/⊂/g, '\\subset ')
      .replace(/∅/g, '\\emptyset ')
      .replace(/→/g, '\\to ')
      .replace(/↦/g, '\\mapsto ')
      .replace(/≤/g, '\\le ')
      .replace(/≥/g, '\\ge ')
      .replace(/≠/g, '\\ne ')
      .replace(/×/g, '\\times ')
      .replace(/±/g, '\\pm ')
      .replace(/∑/g, '\\sum ')
      .replace(/∏/g, '\\prod ')
      .replace(/∫/g, '\\int ');
    tex = tex.replace(/\s+/g, ' ').trim();
    out.push(`$${tex}$`);
  }

  return out.join('\n');
}
