export function buildVisualRetryPrompt(subtopicTitle: string, isTechnical: boolean = true): string {
  const codeBlockInstruction = isTechnical
    ? 'Do not put narrative or theory inside code blocks — code blocks are for code only. Close all code blocks with ```.'
    : 'Do NOT include any fenced code blocks — this is a non-technical topic and code examples are inappropriate.';

  return `Rewrite this subtopic in 1100–1300 words. Include a ### subsection (descriptive heading, no numbering) containing a GFM table that substantively compares, contrasts, or maps a ${isTechnical ? 'technical' : 'conceptual'} relationship from this section's content. The visual must carry analytical value — not merely list items. Do NOT include ASCII art or text-based diagrams. Use tables only for data/comparison; do not put long prose in tables. ${codeBlockInstruction} Do NOT use the heading "Summary" (reserved for end-of-unit). Start with ## ${subtopicTitle}. Do NOT include a conclusion — the unit has its own summary. Do NOT exceed 1300 words.`;
}
