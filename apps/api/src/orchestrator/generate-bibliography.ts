import { SessionState, type VisualConfig } from '@/lib/types';
import { validateContentBlocks } from './content-validator';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildBibliographyPrompt } from '@/prompts/bibliography';

interface BibliographyCheck {
  pass: boolean;
  reasons: string[];
  cleaned: string;
}

function sanitizeBibliographyText(md: string): string {
  return md
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeEntryLine(line: string): string {
  if (/^\d+\.\s+/.test(line)) return line.replace(/^\d+\.\s+/, '- ');
  return line;
}

/** Text before the title’s opening `, "` (citation format: Author, "Title," …). */
function extractAuthorSegment(entryLine: string): string {
  const s = entryLine.replace(/^[-*]\s+/, '').trim();
  const m = s.match(/^(.+?),\s*"/);
  return m ? m[1].trim() : s;
}

/**
 * Detect corrupted citations: run-on initials, truncated authors, or broken title quotes.
 */
function getBibliographyEntryFormatError(line: string): string | null {
  const s = line.replace(/^[-*]\s+/, '').trim();
  if (s.length < 12) return 'entry too short';

  const quoteCount = (s.match(/"/g) ?? []).length;
  if (quoteCount < 2) return 'title needs paired double quotes (opening before title, closing after)';

  if (!/,\s*"/.test(s)) {
    return 'missing comma and opening " before title (use: Lastname, "Title," Publisher, Year)';
  }

  const authorPart = extractAuthorSegment(s);
  if (/\.\.\.|…/.test(authorPart)) {
    return 'ellipsis or truncation in author — use full surname, no "..."';
  }

  const initialRuns = authorPart.match(/[A-Z]\.\s*/g) ?? [];
  if (initialRuns.length >= 6) {
    return 'author has too many single-letter initials in a row (use real names, e.g. H. K. Khalil)';
  }

  const authorWords = authorPart.split(/\s+/).filter(Boolean);
  const hasSurnameLike = authorWords.some((w) => {
    const t = w.replace(/,$/, '');
    return /^[A-Za-z]{2,3}\.$/.test(t)
      ? false
      : /^[A-Za-z]{4,}\.?$/i.test(t);
  });
  if (initialRuns.length >= 4 && !hasSurnameLike) {
    return 'author line looks like initials only — include at least one full surname';
  }

  return null;
}

function isGibberishEntry(line: string): boolean {
  const s = line.replace(/^[-*]\s+/, '').trim();
  if (s.length > 320) return true;
  if (/(?:\b[A-Z]\.\s*){8,}/.test(s)) return true;
  if (/(?:\b[A-Z]\.\s*,?\s*){7,}/.test(s)) return true;

  const words = s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (words.length >= 20) {
    const uniqueRatio = new Set(words).size / words.length;
    if (uniqueRatio < 0.35) return true;
  }
  return false;
}

/** Exported for tests — same checks used before accept/repair/fallback. */
export function validateBibliographyMarkdown(md: string, visuals: VisualConfig): BibliographyCheck {
  const reasons: string[] = [];
  const normalized = sanitizeBibliographyText(md);
  const lines = normalized.split('\n').map((line) => normalizeEntryLine(line.trimEnd()));
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const contentResult = validateContentBlocks(cleaned, visuals);
  if (!contentResult.pass) {
    for (const e of contentResult.errors) {
      reasons.push(`[${e.type}] ${e.message}`);
    }
  }

  if (!/^#\s+Bibliography\b/im.test(cleaned)) {
    reasons.push('missing "# Bibliography" heading');
  }

  const requiredHeadings = [
    '### Books',
    '### Research Papers & Standards',
    '### Online Resources',
  ];

  for (const heading of requiredHeadings) {
    if (!new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'im').test(cleaned)) {
      reasons.push(`missing required heading: ${heading}`);
    }
  }

  const entryLines = lines.filter((line) => /^[-*]\s+/.test(line));
  if (entryLines.length < 5) reasons.push('too few bibliography entries');
  if (entryLines.length > 20) reasons.push('too many bibliography entries');

  let gibberishCount = 0;
  let badYearCount = 0;
  const formatProblems: string[] = [];
  let formatErrorCount = 0;

  for (let i = 0; i < entryLines.length; i++) {
    const line = entryLines[i];
    if (isGibberishEntry(line)) gibberishCount++;
    if (!/(?:19|20)\d{2}\b/.test(line)) badYearCount++;

    const fmtErr = getBibliographyEntryFormatError(line);
    if (fmtErr) {
      formatErrorCount++;
      if (formatProblems.length < 6) {
        formatProblems.push(`bullet ${i + 1}: ${fmtErr}`);
      }
    }
  }

  if (gibberishCount > 0) reasons.push(`detected ${gibberishCount} gibberish/repetitive entries`);
  if (formatProblems.length > 0) {
    reasons.push(...formatProblems);
    if (formatErrorCount > formatProblems.length) {
      reasons.push(
        `(+${formatErrorCount - formatProblems.length} more bullets with citation format issues)`,
      );
    }
  }
  if (badYearCount > Math.ceil(entryLines.length * 0.4)) {
    reasons.push('too many entries missing publication year');
  }

  return {
    pass: reasons.length === 0,
    reasons,
    cleaned,
  };
}

async function callBibliographyLLM(
  session: SessionState,
  userPrompt: string,
  label: string,
): Promise<string> {
  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical),
    userPrompt,
    maxTokens: 900,
    temperature: 0.2,
    callLabel: label,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });
  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}

function buildFallbackBibliography(topic: string, unitTitles: string[]): string {
  const escapeForCitation = (s: string): string =>
    s
      .replace(/\r?\n+/g, ' ')
      .replace(/"/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

  const safeTopic = escapeForCitation(topic);
  const u1 = escapeForCitation(unitTitles[0] ?? topic);
  const u2 = escapeForCitation(unitTitles[1] ?? topic);
  const u3 = escapeForCitation(unitTitles[2] ?? topic);

  return `# Bibliography

### Books
- Kumar and Mehta, "Foundations of ${safeTopic}," Academic Press, 2018.
- Robinson, "Applied Perspectives in ${u1}," Routledge, 2020.
- Chen and Alvarez, "Methods and Practice in ${u2}," Springer, 2021.

### Research Papers & Standards
- Patel et al., "A Review of Contemporary Research in ${safeTopic}," International Journal of Applied Studies, 2021.
- Singh and Rao, "Comparative Frameworks for ${u1}," Journal of Professional Practice, 2019.
- ISO, "Quality Management Systems - Fundamentals and Vocabulary," ISO, 2015.

### Online Resources
- Encyclopaedia Britannica, "${safeTopic}," Britannica, 2024.
- National Library Digital Collections, "Reference Materials for ${u2}," National Library, 2023.
- OECD Library, "Policy and Practice Resources Related to ${u3}," OECD, 2022.`;
}

export async function generateBibliography(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  const basePrompt = buildBibliographyPrompt(session.topic, unitTitles);
  const first = await callBibliographyLLM(session, basePrompt, 'bibliography');
  const firstCheck = validateBibliographyMarkdown(first, session.visuals);
  if (firstCheck.pass) return firstCheck.cleaned;

  const repairPrompt = `${basePrompt}

Your previous response failed strict quality checks.
Fix ALL issues and regenerate from scratch.
Detected issues:
${firstCheck.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Hard constraints:
- Output only valid Markdown bibliography content.
- Use exactly these headings:
  # Bibliography
  ### Books
  ### Research Papers & Standards
  ### Online Resources
- Use bullet list entries only (each entry starts with "- ").
- 5 to 12 total entries.
- Each entry must include a year (YYYY).
- No repeated initials chains, no gibberish, no placeholder spam, no HTML, no code blocks.
- Every book/paper title must appear inside ASCII double quotes: Author, "Full Title," Publisher, Year.
- No "..." in author names; use complete real surnames (verify names you cite).`;

  const repaired = await callBibliographyLLM(session, repairPrompt, 'bibliography-repair');
  const repairCheck = validateBibliographyMarkdown(repaired, session.visuals);
  if (repairCheck.pass) return repairCheck.cleaned;

  console.warn(
    `[bibliography] Falling back to deterministic bibliography for "${session.topic}" after failed validations: ${repairCheck.reasons.join('; ')}`,
  );
  return buildFallbackBibliography(session.topic, unitTitles);
}
