import { SubtopicContext } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { DEFAULT_SUBTOPIC_BAND } from '@/lib/word-budget';

export function buildSubtopicPrompt(ctx: SubtopicContext): string {
  const visuals = ctx.visuals ?? DEFAULT_VISUAL_CONFIG;
  const band = ctx.targetWords ?? DEFAULT_SUBTOPIC_BAND;

  const contextLine = ctx.prevUnitSummary
    ? `\nPrior unit context (build on this, do not repeat it):\n${ctx.prevUnitSummary}`
    : '';

  const chainLine = ctx.prevSubtopicSummary
    ? `\nPrevious subtopic flow (continue from this, do not repeat):\n${ctx.prevSubtopicSummary}`
    : '';

  const subCount = ctx.unitSubtopicCount ?? 0;
  const positionHint = ctx.subtopicIndex === 0
    ? 'This is the unit opener — establish the unit\'s central theme.'
    : (subCount > 0 && ctx.subtopicIndex === subCount - 1)
      ? 'This is the unit closer — synthesize and point forward.'
      : '';

  const positionLine = positionHint ? `\n${positionHint}` : '';

  const unitNum = ctx.unitIndex + 1;
  const subNum = ctx.subtopicIndex + 1;
  const sectionId = `${unitNum}.${subNum}`;

  const unitLabel = ctx.unitCount && ctx.unitCount > 0 ? `Unit ${unitNum}/${ctx.unitCount}` : `Unit ${unitNum}`;
  const subLabel = subCount > 0 ? `Subtopic ${subNum}/${subCount}` : `Subtopic ${subNum}`;

  const mathRule = visuals.equations.enabled
    ? 'When a mathematical relationship genuinely needs symbolic notation, use LaTeX delimiters: inline \\(...\\) and display \\[...\\]. Do NOT use $...$ or $$...$$. Ensure every delimiter is closed. Put each complete formula in a single \\[...\\] block (e.g. attention, softmax, norms); do not split one equation across multiple blocks. After a display equation, define symbols in normal prose in the following paragraph (e.g. "Here Q, K, and V denote..."), not as a separate pseudo-equation per symbol. For multiplication inside sums, products, or fractions use \\cdot or \\times only — never \\square or \\Box (those render as empty boxes in print).'
    : 'Do NOT use mathematical equations, formulas, symbolic notation, or LaTeX-style expressions; explain quantitative relationships in plain prose.';

  const mermaidRule = visuals.mermaid.enabled
    ? 'When a concept benefits from a diagram, use a fenced ```mermaid block (graph TD or graph LR only, quoted node labels, 3–10 nodes). Do NOT use ASCII art.'
    : 'Do NOT include ASCII art or text-based diagrams.';

  return `Book: "${ctx.topic}"
${unitLabel}: "${ctx.unitTitle}"
${subLabel}: "${ctx.subtopicTitle}"${contextLine}${chainLine}${positionLine}

Write ${band.min}–${band.max} words. Start with ## ${sectionId} ${ctx.subtopicTitle}. Use ### headings (descriptive text only, no numbering) for sub-sections within this subtopic. Include at least 3 distinct ### sub-sections that progress from concept to detail to application. Numbering is limited to 2 levels only (Units and Topics) — do NOT number sub-sections. Open with the central problem or concept — not a definition paragraph. Include a ### subsection with a GFM table that carries analytical weight (tables only for data or comparison; never put paragraph narrative in table cells). ${mermaidRule} ${ctx.isTechnical ? 'Use code blocks only when the topic is programming, software engineering, or computer science — not for finance, economics, stock market, or business analysis (use prose and tables for those). Do not put narrative or theory inside code blocks. When you do include code, use a fenced block labeled `output` for expected output and close with ```. Do NOT use raw HTML in prose. Do NOT use ```html blocks for diagrams or figures.' : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams (it does not render as a real image in the book). Use tables and prose only; no HTML diagrams.'} Use numbered lists (1. 2. 3.) or bullet lists (- or *) for lists; never render lists as plain paragraphs. Close with an implication or forward reference, not a recap. Do NOT include a conclusion section — the unit has its own summary. Do NOT use the heading "Summary" here (reserved for end-of-unit); use "Conclusion" or "Key Takeaways" if you need a mid-section wrap-up. Do not add an inner title page or duplicate book title. ${mathRule} Do NOT exceed ${band.max} words.`;
}
