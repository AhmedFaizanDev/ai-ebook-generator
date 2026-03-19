export function buildGlossaryPrompt(
  topic: string,
  unitTitles: string[],
  isTechnical: boolean = true,
): string {
  const outline = unitTitles.map((t, i) => `Unit ${i + 1}: ${t}`).join('\n');
  const termType = isTechnical ? 'key technical terms' : 'key terms and concepts';

  return `Book: "${topic}"

Units covered:
${outline}

Generate a Glossary section. Start with # Glossary.

Requirements:
1. List 15–20 ${termType} used throughout this book
2. Arrange terms in strict alphabetical order
3. Each entry format: **Term** — concise definition (1–2 sentences)
4. Definitions must be precise, self-contained, and relevant to "${topic}"
5. Include foundational terms a reader would need to look up, not obvious common words

Tone: formal, academic. 400–500 words. Output clean text only — no stray symbols or artifact characters. Do NOT exceed 500 words.`;
}
