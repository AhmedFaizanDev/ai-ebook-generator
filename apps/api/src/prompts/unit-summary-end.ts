export function buildUnitEndSummaryPrompt(
  topic: string,
  unitIndex: number,
  unitTitle: string,
  subtopicTitles: string[],
  microSummaries: string[],
): string {
  const context = subtopicTitles
    .map((t, i) => `${unitIndex + 1}.${i + 1} ${t}: ${microSummaries[i] ?? ''}`)
    .join('\n');

  return `Book: "${topic}"
Unit ${unitIndex + 1}: "${unitTitle}"

Subtopic summaries:
${context}

Write a "Summary" section with 5–10 concise bullet points recapping the key learning outcomes and takeaways from this unit. Start with ## Summary.

Rules:
1. Each bullet must be a single sentence capturing one key concept or skill
2. Do NOT introduce new material not covered in the subtopics above
3. Order bullets to follow the logical progression of the unit
4. Use action-oriented language ("Learned how to...", "Understood the role of...")

Tone: formal, academic. 200–300 words. Do NOT exceed 300 words.`;
}
