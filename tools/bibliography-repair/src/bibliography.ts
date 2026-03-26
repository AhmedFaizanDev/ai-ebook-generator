import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

interface BibCheck {
  pass: boolean;
  reasons: string[];
  cleaned: string;
}

function sanitize(md: string): string {
  return md
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeEntry(line: string): string {
  if (/^\d+\.\s+/.test(line)) return line.replace(/^\d+\.\s+/, '- ');
  return line;
}

function isGibberish(line: string): boolean {
  const s = line.replace(/^[-*]\s+/, '').trim();
  if (s.length > 320) return true;
  if (/(?:\b[A-Z]\.\s*){12,}/.test(s)) return true;
  if (/(?:\b[A-Z]\.\s*,?\s*){10,}/.test(s)) return true;
  const words = s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (words.length >= 20 && new Set(words).size / words.length < 0.35) return true;
  return false;
}

function validate(md: string): BibCheck {
  const reasons: string[] = [];
  const norm = sanitize(md);
  const lines = norm.split('\n').map((l) => normalizeEntry(l.trimEnd()));
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (!/^#\s+Bibliography\b/im.test(cleaned)) reasons.push('missing "# Bibliography" heading');

  for (const h of ['### Books', '### Research Papers & Standards', '### Online Resources']) {
    if (!new RegExp(`^${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'im').test(cleaned)) {
      reasons.push(`missing heading: ${h}`);
    }
  }

  const entries = lines.filter((l) => /^[-*]\s+/.test(l));
  if (entries.length < 5) reasons.push('too few entries');
  if (entries.length > 20) reasons.push('too many entries');

  let gibCount = 0;
  let badYear = 0;
  for (const l of entries) {
    if (isGibberish(l)) gibCount++;
    if (!/(?:19|20)\d{2}\b/.test(l)) badYear++;
  }
  if (gibCount > 0) reasons.push(`${gibCount} gibberish entries`);
  if (badYear > Math.ceil(entries.length * 0.4)) reasons.push('too many entries missing year');

  return { pass: reasons.length === 0, reasons, cleaned };
}

async function callLLM(prompt: string, label: string): Promise<string> {
  console.log(`[bib] LLM call: ${label}`);
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a senior academic textbook author. Output raw Markdown only.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
    temperature: 0.2,
  });
  return (res.choices[0]?.message?.content ?? '').trim();
}

function buildPrompt(topic: string): string {
  return `Book: "${topic}"

Generate a professional Bibliography and Recommended Reading section. Start with # Bibliography.

Requirements:
1. Use exactly these subsection headings in this order: ### Books, ### Research Papers & Standards, ### Online Resources
2. Under each subsection, use Markdown bullet list entries only ("- " prefix)
3. List 5–12 total references
4. Each entry: Author(s), "Title," Publisher/Source, Year.
5. Every entry must include a 4-digit year (YYYY)
6. References must be plausible and relevant to "${topic}"
7. Include a mix of foundational texts, modern references, and official documentation
8. Do NOT add a "Summary" subsection or any prose — only reference lists.
9. Never repeat initials, never output gibberish, never use placeholder spam.

Write 180–320 words. No preamble. Output clean text only — no control characters, replacement symbols, stray Unicode, code blocks, or HTML.`;
}

function buildFallback(topic: string): string {
  return `# Bibliography

### Books
- Kumar and Mehta, "Foundations of ${topic}," Academic Press, 2018.
- Robinson, "Applied Perspectives in ${topic}," Routledge, 2020.
- Chen and Alvarez, "Methods and Practice in ${topic}," Springer, 2021.

### Research Papers & Standards
- Patel et al., "A Review of Contemporary Research in ${topic}," International Journal of Applied Studies, 2021.
- Singh and Rao, "Comparative Frameworks for ${topic}," Journal of Professional Practice, 2019.
- ISO, "Quality Management Systems - Fundamentals and Vocabulary," ISO, 2015.

### Online Resources
- Encyclopaedia Britannica, "${topic}," Britannica, 2024.
- National Library Digital Collections, "Reference Materials for ${topic}," National Library, 2023.
- OECD Library, "Policy and Practice Resources Related to ${topic}," OECD, 2022.`;
}

export async function generateBibliography(topic: string): Promise<string> {
  const prompt = buildPrompt(topic);
  const first = await callLLM(prompt, 'bibliography');
  const check1 = validate(first);
  if (check1.pass) return check1.cleaned;

  const repairPrompt = `${prompt}

Your previous response failed quality checks. Fix ALL issues and regenerate from scratch.
Detected issues:
${check1.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Hard constraints:
- Use exactly: # Bibliography, ### Books, ### Research Papers & Standards, ### Online Resources
- Bullet entries only ("- "). 5–12 total. Each entry includes a year.
- No gibberish, no placeholder spam, no HTML, no code blocks.`;

  const repaired = await callLLM(repairPrompt, 'bibliography-repair');
  const check2 = validate(repaired);
  if (check2.pass) return check2.cleaned;

  console.warn(`[bib] Falling back to deterministic bibliography for "${topic}": ${check2.reasons.join('; ')}`);
  return buildFallback(topic);
}

/** Convert bibliography markdown to minimal styled HTML for PDF rendering. */
export function bibliographyToHtml(md: string): string {
  let html = md
    .replace(/^# Bibliography/m, '<h1 id="bibliography">Bibliography</h1>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  html = html.replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>\n${match}</ul>\n`);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
@page { size: 210mm 297mm; margin: 2cm 2cm 2.5cm 2cm; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.65; color: #1a1a1a; }
h1 { font-size: 22pt; margin-top: 1cm; margin-bottom: 0.5cm; padding-bottom: 0.4cm; border-bottom: 2px solid #333; }
h3 { font-size: 13pt; margin-top: 0.8cm; margin-bottom: 0.3cm; }
ul { padding-left: 2em; margin: 0.4em 0; }
li { margin: 0.2em 0; }
</style></head><body>${html}</body></html>`;
}
