export function buildVisualRetryPrompt(subtopicTitle: string): string {
  return `Rewrite this subtopic in 1100–1300 words. Include a ### subsection (descriptive heading, no numbering) containing a GFM table or ASCII diagram that substantively compares, contrasts, or maps a technical relationship from this section's content. The visual must carry analytical value — not merely list items. Start with ## ${subtopicTitle}. Do NOT include a conclusion — the unit has its own summary. Do NOT exceed 1300 words.`;
}
