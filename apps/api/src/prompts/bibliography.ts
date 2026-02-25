export function buildBibliographyPrompt(topic: string, unitTitles: string[]): string {
  const outline = unitTitles.map((t, i) => `Unit ${i + 1}: ${t}`).join('\n');

  return `Book: "${topic}"

Units covered:
${outline}

Generate a professional Bibliography and Recommended Reading section. Start with # Bibliography.

Requirements:
1. List 5–10 references organized under subsection headings: ### Books, ### Research Papers & Standards, ### Online Resources
2. Each entry must use a consistent citation format: Author(s), "Title," Publisher/Source, Year.
3. References must be plausible and relevant to "${topic}" — use real, widely-known works in this field where possible
4. Include a mix of foundational texts, modern references, and official documentation/standards

Write 400–600 words total. No preamble. Do NOT exceed 600 words.`;
}
