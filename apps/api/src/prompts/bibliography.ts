export function buildBibliographyPrompt(topic: string, unitTitles: string[]): string {
  const outline = unitTitles.map((t, i) => `Unit ${i + 1}: ${t}`).join('\n');

  return `Book: "${topic}"

Units covered:
${outline}

Generate a professional Bibliography and Recommended Reading section. Start with # Bibliography.

Requirements:
1. Use exactly these subsection headings in this order: ### Books, ### Research Papers & Standards, ### Online Resources
2. Under each subsection, use Markdown bullet list entries only ("- " prefix)
3. List 5–12 total references
4. Each entry must use this citation format: Author(s), "Title," Publisher/Source, Year.
5. Every entry must include a 4-digit year (YYYY)
6. References must be plausible and relevant to "${topic}" — use real, widely-known works in this field where possible
7. Include a mix of foundational texts, modern references, and official documentation/standards
8. Do NOT add a "Summary" subsection or any paragraph prose within the Bibliography section — only reference lists under the required subsection headings.
9. Never repeat initials, never output gibberish, and never use placeholder spam.
10. Author names must include real surnames (e.g. H. K. Khalil or Khalil, H. K.) — not long chains of initials (A. B. C. D. …), not truncated names with "...", and never omit the opening quote before the title. Good: Lastname, "Book Title," Publisher, 2000. Bad: A. A. A. A., "Title," … ; Bad: Smith, Book Title," Publisher (missing " before Book).

Write 180–320 words total. No preamble. Output clean text only: use standard letters, numbers, and punctuation only — no control characters, replacement symbols (�), stray Unicode, code blocks, or HTML.`;
}
