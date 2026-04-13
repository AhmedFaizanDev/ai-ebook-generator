import type { VisualConfig, ContentBlockError } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';

export function buildVisualRetryPrompt(
  subtopicTitle: string,
  isTechnical: boolean = true,
  visuals: VisualConfig = DEFAULT_VISUAL_CONFIG,
  errors: ContentBlockError[] = [],
): string {
  const codeBlockInstruction = isTechnical
    ? 'Use code blocks only for programming/software/CS topics — not for finance, economics, or business analysis (use prose and tables). Do not use raw HTML or ```html for diagrams. Close all code blocks with ```.'
    : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams. Use tables and prose only.';

  const mathRule = visuals.equations.enabled
    ? 'When using math, use LaTeX delimiters \\(...\\) for inline and \\[...\\] for display only. No $...$ or $$...$$. Ensure every delimiter is closed. Use \\cdot or \\times for multiplication — not \\square or \\Box.'
    : 'Do NOT use mathematical equations, formulas, symbolic notation, or LaTeX-style expressions; explain quantitative relationships in plain prose.';

  const mermaidRule = visuals.mermaid.enabled
    ? 'Mermaid diagrams must use ```mermaid blocks with graph TD or graph LR only, quoted node labels, and 3–10 nodes.'
    : 'Do NOT include ASCII art or text-based diagrams.';

  const errorFixes = errors.length > 0
    ? '\n\nFix these specific issues from the previous attempt:\n' + errors.map((e, i) => `${i + 1}. [${e.type}] ${e.message}`).join('\n')
    : '';

  return `Rewrite this subtopic in 1100–1300 words. Include a ### subsection (descriptive heading, no numbering) containing a GFM table that substantively compares, contrasts, or maps a ${isTechnical ? 'technical' : 'conceptual'} relationship from this section's content. The visual must carry analytical value — not merely list items. ${mermaidRule} Use tables only for data/comparison; do not put long prose in tables. ${codeBlockInstruction} Do NOT use the heading "Summary" (reserved for end-of-unit). Start with ## ${subtopicTitle}. Do NOT include a conclusion — the unit has its own summary. ${mathRule} Do NOT exceed 1300 words.${errorFixes}`;
}
