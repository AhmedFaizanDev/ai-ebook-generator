import { SubtopicContext } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { UNIT_COUNT, SUBTOPICS_PER_UNIT } from '@/lib/config';
import { orchestratorWordsPerSubtopicFromEnv } from '@/prompts/orch-page-target';

function buildSourceAnchorBlock(ctx: SubtopicContext): string {
  const slot = ctx.sourceSlot;
  if (!slot) return '';
  const imgs = slot.imageLines ?? [];
  const imgBlock =
    imgs.length > 0
      ? `\nSOURCE FIGURES (required for this subtopic — paste each line below verbatim into your Markdown; keep exact \`![](rvimg://…)\` paths so exports resolve; use a ### Figures from source subsection and/or place each figure beside the paragraph it supports; do not skip, renumber, or substitute placeholders):\n${imgs.map((l) => `- ${l}`).join('\n')}`
      : '';
  const eqBlock =
    slot.equations.length > 0
      ? `\nVerbatim math / notation from source (where you cover the same ideas, express using \\(...\\) and \\[...\\] per book rules; do not contradict):\n${slot.equations.map((e) => `- ${e}`).join('\n')}`
      : '';
  const kw = slot.keywords.length ? slot.keywords.join(', ') : '(none)';
  return `

--- Source anchor (imported document; do not invent facts, numbers, or citations beyond this material) ---
Summary:
${slot.summary}

Keywords: ${kw}
Source headings: ${slot.sourceHeadingRefs.join(' → ') || '—'}${imgBlock}${eqBlock}
--- End source anchor ---
`;
}

export function buildSubtopicPrompt(ctx: SubtopicContext): string {
  const visuals = ctx.visuals ?? DEFAULT_VISUAL_CONFIG;

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

  const mathRule = visuals.equations.enabled
    ? 'When a mathematical relationship genuinely needs symbolic notation, use LaTeX delimiters: inline \\(...\\) and display \\[...\\]. Do NOT use $...$ or $$...$$. Ensure every delimiter is closed. Put each complete formula in a single \\[...\\] block (e.g. attention, softmax, norms); do not split one equation across multiple blocks. After a display equation, define symbols in normal prose in the following paragraph (e.g. "Here Q, K, and V denote..."), not as a separate pseudo-equation per symbol. For multiplication inside sums, products, or fractions use \\cdot or \\times only — never \\square or \\Box (those render as empty boxes in print).'
    : 'Do NOT use mathematical equations, formulas, symbolic notation, or LaTeX-style expressions; explain quantitative relationships in plain prose.';

  const mermaidRule = visuals.mermaid.enabled
    ? 'When a concept benefits from a diagram, use a fenced ```mermaid block (graph TD or graph LR only, quoted node labels, 3–10 nodes). Do NOT use ASCII art.'
    : 'Do NOT include ASCII art or text-based diagrams.';

  const band = orchestratorWordsPerSubtopicFromEnv();
  const wordBand = band
    ? `Write approximately ${band.min}–${band.max} words (whole-book page budget from env).`
    : 'Write 1100–1300 words.';
  const wordCap = band ? `Do NOT exceed ${band.max} words.` : 'Do NOT exceed 1300 words.';

  const slot = ctx.sourceSlot;
  const figureCarry =
    slot && (slot.imageLines?.length ?? 0) > 0
      ? ' SOURCE FIGURES: If the anchor lists `![](rvimg://…)` lines, your output MUST include every one verbatim (exact characters). This overrides brevity—figures are not optional.'
      : '';
  const equationCarry =
    slot && slot.equations.length > 0 && visuals.equations.enabled
      ? ' SOURCE MATH: Where your prose aligns with the anchor’s equation fragments, include matching formal notation (\\(...\\) / \\[...\\]) so the subtopic reflects the source’s quantitative content.'
      : '';

  return `Book: "${ctx.topic}"
Unit ${unitNum}/${UNIT_COUNT}: "${ctx.unitTitle}"
Subtopic ${subNum}/${SUBTOPICS_PER_UNIT}: "${ctx.subtopicTitle}"${contextLine}${chainLine}${positionLine}
${buildSourceAnchorBlock(ctx)}
${figureCarry}${equationCarry}
${wordBand} Start with ## ${sectionId} ${ctx.subtopicTitle}. Use ### headings (descriptive text only, no numbering) for sub-sections within this subtopic. Numbering is limited to 2 levels only (Units and Topics) — do NOT number sub-sections. Open with the central problem or concept — not a definition paragraph. Include a ### subsection with a GFM table that carries analytical weight (tables only for data or comparison; never put paragraph narrative in table cells). ${mermaidRule} ${ctx.isTechnical ? 'Use code blocks only when the topic is programming, software engineering, or computer science — not for finance, economics, stock market, or business analysis (use prose and tables for those). Do not put narrative or theory inside code blocks. When you do include code, use a fenced block labeled `output` for expected output and close with ```. Do NOT use raw HTML in prose. Do NOT use ```html blocks for diagrams or figures.' : 'Do NOT include code blocks, raw HTML, or markup. Do NOT use ```html for diagrams (it does not render as a real image in the book). Use tables and prose only; no HTML diagrams.'} Use numbered lists (1. 2. 3.) or bullet lists (- or *) for lists; never render lists as plain paragraphs. Close with an implication or forward reference, not a recap. Do NOT include a conclusion section — the unit has its own summary. Do NOT use the heading "Summary" here (reserved for end-of-unit); use "Conclusion" or "Key Takeaways" if you need a mid-section wrap-up. Do not add an inner title page or duplicate book title. ${mathRule} ${wordCap}`;
}
