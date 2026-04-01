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

Write 1100–1300 words. Start with ## ${sectionId} ${ctx.subtopicTitle}. Use ### headings (descriptive text only, no numbering) for sub-sections within this subtopic. Numbering is limited to 2 levels only (Units and Topics) — do NOT number sub-sections. Open with the central problem or concept — not a definition paragraph. Include a ### subsection with a GFM table that carries analytical weight (tables only for data or comparison; never put paragraph narrative in table cells). Do NOT include ASCII art or text-based diagrams. ${ctx.isTechnical ? 'Use code blocks only when the topic is programming, software engineering, or computer science — not for finance, economics, stock market, or business analysis (use prose and tables for those). Do not put narrative or theory inside code blocks. When you do include code, use a fenced block labeled `output` for expected output and close with ```. Do NOT use raw HTML in prose. Do NOT use ```html blocks for diagrams or figures.' : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams (it does not render as a real image in the book). Use tables and prose only; no HTML diagrams.'} Use numbered lists (1. 2. 3.) or bullet lists (- or *) for lists; never render lists as plain paragraphs. Close with an implication or forward reference, not a recap. Do NOT include a conclusion section — the unit has its own summary. Do NOT use the heading "Summary" here (reserved for end-of-unit); use "Conclusion" or "Key Takeaways" if you need a mid-section wrap-up. Do not add an inner title page or duplicate book title. Do NOT use mathematical equations, formulas, symbolic notation, or LaTeX-style expressions; explain quantitative relationships in plain prose. Do NOT exceed 1300 words.`;
}
