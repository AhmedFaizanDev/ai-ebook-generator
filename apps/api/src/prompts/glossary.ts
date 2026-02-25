export function buildGlossaryPrompt(
  topic: string,
  unitTitles: string[],
): string {
  const outline = unitTitles.map((t, i) => `Unit ${i + 1}: ${t}`).join('\n');

  return `Book: "${topic}"

Units covered:
${outline}

Generate a Glossary section. Start with # Glossary.

Requirements:
1. List 15–20 key technical terms used throughout this book
2. Arrange terms in strict alphabetical order
3. Each entry format: **Term** — concise definition (1–2 sentences)
4. Definitions must be precise, self-contained, and relevant to "${topic}"
5. Include foundational terms a reader would need to look up, not obvious common words

Tone: formal, academic. 400–500 words. Do NOT exceed 500 words.`;
}
