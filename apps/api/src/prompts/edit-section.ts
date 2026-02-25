export type EditAction = 'expand' | 'rewrite' | 'add_example' | 'add_table' | 'shorten';

const ACTION_INSTRUCTIONS: Record<EditAction, string> = {
  expand: 'Expand the selected passage with more technical depth, examples, and detail. Double its length. Keep the same heading level and Markdown formatting. Output the expanded version that replaces the selected passage.',
  rewrite: 'Rewrite the selected passage to improve clarity, accuracy, and technical depth. Keep the same length and heading level. Output the rewritten version that replaces the selected passage.',
  add_example: 'Reproduce the selected passage exactly, then immediately after it add a practical, runnable code example that demonstrates the concept. Use a fenced code block with the appropriate language tag. Output the original passage followed by the new example.',
  add_table: 'Reproduce the selected passage exactly, then immediately after it add a comparison or summary table that organizes the key concepts into a GFM Markdown table (| col | col |). Output the original passage followed by the new table.',
  shorten: 'Condense the selected passage to half its current length. Preserve all key technical facts. Remove redundancy and filler. Output the shortened version that replaces the selected passage.',
};

export function buildEditSectionPrompt(
  fullMarkdown: string,
  selectedText: string,
  action: EditAction,
): string {
  return `You are editing one passage inside a larger technical ebook section. Output ONLY the result in raw Markdown — no explanation, no surrounding content.

FULL SECTION (for context only — do NOT reproduce it):
---
${fullMarkdown}
---

SELECTED PASSAGE:
---
${selectedText}
---

INSTRUCTION: ${ACTION_INSTRUCTIONS[action]}

Output raw Markdown only. Match the existing formatting style. No preamble or explanation.`;
}
