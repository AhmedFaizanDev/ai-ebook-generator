export function buildCapstonePrompt(
  topic: string,
  index: number,
  capstoneTitle: string,
  allUnitSummaries: string[]
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `Unit ${i + 1}: ${s}`)
    .join('\n');

  return `Book: "${topic}"
Capstone ${index + 1}/2: "${capstoneTitle}"

Book context (unit summaries):
${summariesBlock}

Write 1600–1900 words as a senior engineer's project specification. Start with ## Capstone ${index + 1}: ${capstoneTitle}. Use ### sub-sections numbered Capstone ${index + 1}.1, Capstone ${index + 1}.2, etc. Include: a concrete problem statement with measurable success criteria; architecture decisions with trade-off analysis; phased implementation plan with specific deliverables; a rubric that evaluates design quality, not just completion. Reference specific techniques from the book where applicable. Do NOT exceed 1900 words.`;
}

export function buildBatchedCapstonePrompt(
  topic: string,
  capstoneTitles: string[],
  allUnitSummaries: string[]
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `Unit ${i + 1}: ${s}`)
    .join('\n');

  const titlesBlock = capstoneTitles
    .map((t, i) => `${i + 1}. "${t}"`)
    .join('\n');

  return `Book: "${topic}"

Book context (unit summaries):
${summariesBlock}

Write ${capstoneTitles.length} capstone projects, each 1600–1900 words. Separate them with a line containing only "---".

Capstone titles:
${titlesBlock}

For each capstone: start with ## Capstone N: Title. Use ### sub-sections numbered Capstone N.1, Capstone N.2, etc. Include a concrete problem statement with measurable success criteria; architecture decisions with trade-off analysis; phased implementation plan with specific deliverables; a rubric that evaluates design quality. Reference specific techniques from the book. Do NOT exceed 1900 words per capstone.`;
}
