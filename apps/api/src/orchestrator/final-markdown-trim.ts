/**
 * Optional whole-book trim after assembly (deterministic, paragraph-preserving).
 * Set ORCH_FINAL_TRIM_MAX_WORDS to a positive cap (e.g. 180000 for ~250 pages at ~720 words/page).
 */
export function applyOptionalFinalMarkdownWordTrim(markdown: string): string {
  const cap = parseInt(process.env.ORCH_FINAL_TRIM_MAX_WORDS || '', 10);
  if (!Number.isFinite(cap) || cap < 500) return markdown;

  const paras = markdown.split(/\n{2,}/);
  const kept: string[] = [];
  let words = 0;
  for (const p of paras) {
    const wc = p.trim().length ? p.trim().split(/\s+/).length : 0;
    if (words + wc > cap) break;
    kept.push(p);
    words += wc;
  }
  if (kept.length === paras.length) return markdown;
  return (
    kept.join('\n\n') +
    '\n\n_[End of book trimmed to ORCH_FINAL_TRIM_MAX_WORDS for length.]_\n'
  );
}
