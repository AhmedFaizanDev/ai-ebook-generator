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

Write 1100–1300 words. Start with ## ${sectionId} ${ctx.subtopicTitle}. Use ### headings (descriptive text only, no numbering) for sub-sections within this subtopic. Numbering is limited to 2 levels only (Units and Topics) — do NOT number sub-sections. Open with the central problem or concept — not a definition paragraph. Include a ### subsection with a table or diagram that carries analytical weight. When including code snippets, always show the expected output immediately after in a separate fenced block labeled \`output\`. Use numbered lists (1. 2. 3.) for any sequential steps, procedures, or prioritized items. Close with an implication or forward reference, not a recap. Do NOT include a conclusion section — the unit has its own summary. Do NOT exceed 1300 words.`;
}
