import { SubtopicContext } from '@/lib/types';
import { UNIT_COUNT, SUBTOPICS_PER_UNIT } from '@/lib/config';

export function buildSubtopicPrompt(ctx: SubtopicContext): string {
  const contextLine = ctx.prevUnitSummary
    ? `\nPrior unit context (build on this, do not repeat it):\n${ctx.prevUnitSummary}`
    : '';

  const chainLine = ctx.prevSubtopicSummary
    ? `\nPrevious subtopic flow (continue from this, do not repeat):\n${ctx.prevSubtopicSummary}`
    : '';

  const positionHint = ctx.subtopicIndex === 0
    ? 'This is the unit opener — establish the unit\'s central theme.'
    : ctx.subtopicIndex === SUBTOPICS_PER_UNIT - 1
      ? 'This is the unit closer — synthesize and point forward.'
      : '';

  const positionLine = positionHint ? `\n${positionHint}` : '';

  const unitNum = ctx.unitIndex + 1;
  const subNum = ctx.subtopicIndex + 1;
  const sectionId = `${unitNum}.${subNum}`;

  return `Book: "${ctx.topic}"
Unit ${unitNum}/${UNIT_COUNT}: "${ctx.unitTitle}"
Subtopic ${subNum}/${SUBTOPICS_PER_UNIT}: "${ctx.subtopicTitle}"${contextLine}${chainLine}${positionLine}

Write 1100–1300 words. Start with ## ${sectionId} ${ctx.subtopicTitle}. Use ### headings (descriptive text only, no numbering) for sub-sections within this subtopic. Numbering is limited to 2 levels only (Units and Topics) — do NOT number sub-sections. Open with the central problem or concept — not a definition paragraph. Include one ### visual subsection containing exactly one fenced block with language \`mermaid\` for a clean textbook-style diagram. STRICT Mermaid rules: use ONLY \`graph TD\` or \`graph LR\`. Wrap every node label in \`["double-quoted label"]\`. Use \`-->\` for arrows and \`-->|"edge label"|\` for labeled edges. Keep it small: 4–8 nodes, short labels (< 5 words). Do NOT use subgraph, style, class, sequenceDiagram, classDiagram, stateDiagram, erDiagram, or any advanced features. Add a short italic caption below the closing \`\`\`. Do NOT use Markdown tables, raw HTML, \`<table>\`, or ASCII art. Never output raw HTML math markup (e.g. \`<span class=\"katex\">...\` or MathML tags) in prose; use LaTeX delimiters instead. ${ctx.isTechnical ? (ctx.allowCodeBlocks ? 'Use fenced code blocks only for actual code — do NOT put narrative, theory, or paragraph content inside code blocks. When including code snippets, always show the expected output in a separate fenced block labeled `output` and close every code block with ```.' : 'Do NOT include fenced code blocks for program code or pseudocode in this section. Keep all technical explanations in prose, lists, diagrams, and equations.') + ' Write mathematical notation in LaTeX: inline `\\(...\\)` and display `\\[...\\]`. Use LaTeX commands for fractions, logs, trigonometric functions, Greek symbols, summations, and integrals.' : 'Do not include code blocks for program code. Use one fenced `mermaid` block only for the visual diagram.'} Use numbered lists (1. 2. 3.) or bullet lists (- or *) for lists; never render lists as plain paragraphs. Close with an implication or forward reference, not a recap. Do NOT include a conclusion section — the unit has its own summary. Do NOT use the heading "Summary" here (reserved for end-of-unit); use "Conclusion" or "Key Takeaways" if you need a mid-section wrap-up. Do not add an inner title page or duplicate book title. Do NOT exceed 1300 words.`;
}
