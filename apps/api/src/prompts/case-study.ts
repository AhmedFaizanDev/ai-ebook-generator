export function buildCaseStudyPrompt(
  topic: string,
  index: number,
  caseStudyTitle: string,
  allUnitSummaries: string[]
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `Unit ${i + 1}: ${s}`)
    .join('\n');

  return `Book: "${topic}"
Case Study ${index + 1}: "${caseStudyTitle}"

Book context (unit summaries):
${summariesBlock}

Write 1600–1900 words as a published technical retrospective. Start with ## Case Study ${index + 1}: ${caseStudyTitle}. Use ### sub-sections numbered Case Study ${index + 1}.1, Case Study ${index + 1}.2, etc. Include: the specific technical challenge and its business context; step-by-step procedures with explanations at each stage; the initial approach and why it failed or was insufficient; the revised architecture with concrete implementation details; quantitative outcomes (use realistic fabricated metrics); lessons that generalize beyond this case. Reference specific techniques from the book where applicable. Do NOT exceed 1900 words.`;
}

export function buildBatchedCaseStudyPrompt(
  topic: string,
  caseStudyTitles: string[],
  allUnitSummaries: string[]
): string {
  const summariesBlock = allUnitSummaries
    .map((s, i) => `Unit ${i + 1}: ${s}`)
    .join('\n');

  const titlesBlock = caseStudyTitles
    .map((t, i) => `${i + 1}. "${t}"`)
    .join('\n');

  return `Book: "${topic}"

Book context (unit summaries):
${summariesBlock}

Write ${caseStudyTitles.length} case studies, each 1600–1900 words. Separate them with a line containing only "---".

Case study titles:
${titlesBlock}

For each case study: start with ## Case Study N: Title. Use ### sub-sections numbered Case Study N.1, Case Study N.2, etc. Include the specific technical challenge and business context; step-by-step procedures with explanations at each stage; the initial approach and why it failed; the revised architecture with concrete implementation details; quantitative outcomes (use realistic fabricated metrics); generalizable lessons. Reference specific techniques from the book. Do NOT exceed 1900 words per case study.`;
}
