export function buildVisualRetryPrompt(subtopicTitle: string, isTechnical: boolean = true): string {
  const codeBlockInstruction = isTechnical
    ? 'Use code blocks only for programming/software/CS topics — not for finance, economics, or business analysis (use prose and tables). Do not use raw HTML or ```html for diagrams. Close all code blocks with ```.'
    : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams. Use tables and prose only.';

  return `Rewrite this subtopic in 1100–1300 words. Include a ### subsection (descriptive heading, no numbering) containing a GFM table that substantively compares, contrasts, or maps a ${isTechnical ? 'technical' : 'conceptual'} relationship from this section's content. The visual must carry analytical value — not merely list items. Do NOT include ASCII art or text-based diagrams. Use tables only for data/comparison; do not put long prose in tables. ${codeBlockInstruction} Do NOT use the heading "Summary" (reserved for end-of-unit). Start with ## ${subtopicTitle}. Do NOT include a conclusion — the unit has its own summary. Do NOT use mathematical equations, formulas, symbolic notation, or LaTeX-style expressions; explain quantitative relationships in plain prose. Do NOT exceed 1300 words.`;
}
