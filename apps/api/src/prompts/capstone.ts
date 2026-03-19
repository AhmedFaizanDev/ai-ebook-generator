export function buildCapstonePrompt(
  topic: string,
  index: number,
  capstoneTitle: string,
  allUnitSummaries: string[],
  isTechnical: boolean = true,
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `Unit ${i + 1}: ${s}`)
    .join('\n');

  const specDescription = isTechnical
    ? "a senior engineer's project specification"
    : "a detailed applied project specification";

  const contentGuidance = isTechnical
    ? 'a concrete problem statement with measurable success criteria; architecture decisions with trade-off analysis; phased implementation plan with specific deliverables; a rubric that evaluates design quality, not just completion.'
    : 'a concrete problem statement with measurable success criteria; conceptual framework and approach with trade-off analysis; phased plan with specific deliverables; a rubric that evaluates depth of understanding and quality, not just completion.';

  return `Book: "${topic}"
Capstone ${index + 1}/2: "${capstoneTitle}"

Book context (unit summaries):
${summariesBlock}

Write 1600–1900 words as ${specDescription}. Start with ## Capstone ${index + 1}: ${capstoneTitle}. Use ### sub-sections numbered Capstone ${index + 1}.1, Capstone ${index + 1}.2, etc. Include: ${contentGuidance} Reference specific techniques from the book where applicable. Do NOT exceed 1900 words.`;
}

export function buildBatchedCapstonePrompt(
  topic: string,
  capstoneTitles: string[],
  allUnitSummaries: string[],
  isTechnical: boolean = true,
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `Unit ${i + 1}: ${s}`)
    .join('\n');

  const titlesBlock = capstoneTitles
    .map((t, i) => `${i + 1}. "${t}"`)
    .join('\n');

  const contentGuidance = isTechnical
    ? 'Include a concrete problem statement with measurable success criteria; architecture decisions with trade-off analysis; phased implementation plan with specific deliverables; a rubric that evaluates design quality.'
    : 'Include a concrete problem statement with measurable success criteria; conceptual framework and approach with trade-off analysis; phased plan with specific deliverables; a rubric that evaluates depth of understanding and quality.';

  return `Book: "${topic}"

Book context (unit summaries):
${summariesBlock}

Write ${capstoneTitles.length} capstone projects, each 1600–1900 words. Separate them with a line containing only "---".

Capstone titles:
${titlesBlock}

For each capstone: start with ## Capstone N: Title. Use ### sub-sections numbered Capstone N.1, Capstone N.2, etc. ${contentGuidance} Reference specific techniques from the book. Do NOT exceed 1900 words per capstone.`;
}
