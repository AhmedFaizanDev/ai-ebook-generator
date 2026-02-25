export function buildUnitSummaryCombinePrompt(unitTitle: string, microSummaries: string[]): string {
  const numbered = microSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return `Unit: "${unitTitle}"

Subtopic summaries:
${numbered}

Synthesize into one paragraph, 80–100 words. State the unit's unifying principle, key techniques, and how it connects to prior or subsequent units. No preamble.`;
}
