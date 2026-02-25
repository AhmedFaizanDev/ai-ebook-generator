export function buildMicroSummaryPrompt(subtopicTitle: string, contentExcerpt: string): string {
  return `Subtopic: "${subtopicTitle}"

Excerpt:
${contentExcerpt}

In 50–80 words, state the central technical insight and how it connects to the unit's broader theme. Name specific mechanisms, patterns, or constraints — not headings. No preamble.`;
}
