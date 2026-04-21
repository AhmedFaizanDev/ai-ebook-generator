import type { BookStructure } from '@/lib/types';
import type { IngestSection } from '@/ingest/types';

export interface SectionizeResult {
  structure: BookStructure;
  sections: IngestSection[];
}

function hasMermaid(md: string): boolean {
  return /```mermaid[\s\S]*?```/i.test(md);
}

function hasTable(md: string): boolean {
  return /^\s*\|.+\|\s*$/m.test(md);
}

function isPageHeading(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^page\s+\d+$/.test(t) || /^\d+(?:\.\d+)*\s+page\s+\d+$/.test(t);
}

function cleanHeading(raw: string): string | null {
  const heading = raw.trim().replace(/\s+/g, ' ');
  if (!heading) return null;
  if (isPageHeading(heading)) return null;
  return heading;
}

function safeMermaidId(s: string): string {
  const id = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return id || 'n';
}

function buildUnitVisualEnrichment(unitTitle: string, subtopics: string[]): string {
  const rows = subtopics.slice(0, 10).map((t) => `| ${t.replace(/\|/g, '/')} | Core concepts and worked examples |`).join('\n');
  const table = [
    `### ${unitTitle.replace(/#/g, '')} — at a glance`,
    '',
    '| Section | Focus |',
    '| --- | --- |',
    rows || '| Overview | Core concepts and worked examples |',
    '',
  ].join('\n');

  const nodes = (subtopics.length > 0 ? subtopics : ['Overview']).slice(0, 10);
  const lines: string[] = ['```mermaid', 'flowchart LR'];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!.replace(/"/g, "'").slice(0, 60);
    const id = `n${i}_${safeMermaidId(unitTitle)}`;
    lines.push(`  ${id}["${n}"]`);
    if (i > 0) {
      const prevId = `n${i - 1}_${safeMermaidId(unitTitle)}`;
      lines.push(`  ${prevId} --> ${id}`);
    }
  }
  lines.push('```', '');
  return `${table}\n${lines.join('\n')}`;
}

type RawBlock = { headingLevel: 1 | 2 | 3; heading: string; body: string[] };

/** Lines that look like structural headings in Word exports without proper heading styles. */
function inferHeadingFromPlainLine(trimmed: string): { level: 1 | 2 | 3; title: string } | null {
  if (/^#{1,3}\s/.test(trimmed)) return null;
  if (trimmed.length > 120) return null;
  if (/^(chapter|part|unit|module)\s+\d+/i.test(trimmed)) {
    return { level: 1, title: trimmed };
  }
  // "3.2 Title" but not "1. let us find"
  if (/^\d{1,2}\.\d{1,3}\s+[A-Za-z]/.test(trimmed)) {
    const rest = trimmed.replace(/^\d{1,2}\.\d{1,3}\s+/, '');
    if (/^(let|find|show|prove|solve|if|then|given|obtain)\b/i.test(rest)) return null;
    return { level: 2, title: trimmed };
  }
  if (/^\d{1,2}\.\s+[A-Z][a-zA-Z\s,&/-]{8,}/.test(trimmed) && !/^\d+\.\s+let\b/i.test(trimmed)) {
    return { level: 2, title: trimmed };
  }
  return null;
}

function flushRawBlock(current: RawBlock | null, out: RawBlock[]): RawBlock | null {
  if (current && (current.body.length > 0 || current.heading)) {
    out.push(current);
  }
  return null;
}

function splitMarkdownIntoRawBlocks(markdown: string, bookTitle: string): RawBlock[] {
  const lines = markdown.split(/\r?\n/);
  const rawBlocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  const pushCurrent = () => {
    current = flushRawBlock(current, rawBlocks);
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (m) {
      const level = Math.min(3, m[1]!.length) as 1 | 2 | 3;
      const heading = cleanHeading(m[2]!.trim());
      if (!heading) {
        if (current) current.body.push(line);
        continue;
      }
      if (level === 1 && heading.toLowerCase() === bookTitle.toLowerCase()) {
        continue;
      }
      pushCurrent();
      current = { headingLevel: level, heading, body: [] };
      continue;
    }

    const trimmed = line.trim();
    const inferred = inferHeadingFromPlainLine(trimmed);
    if (inferred && trimmed === line.trim()) {
      const title = inferred.title;
      if (title.toLowerCase() !== bookTitle.toLowerCase()) {
        pushCurrent();
        current = { headingLevel: inferred.level, heading: title, body: [] };
        continue;
      }
    }

    if (!current) {
      current = { headingLevel: 2, heading: 'Overview', body: [] };
    }
    current.body.push(line);
  }
  flushRawBlock(current, rawBlocks);

  if (rawBlocks.length === 0) {
    rawBlocks.push({ headingLevel: 2, heading: 'Overview', body: [markdown] });
  }

  return rawBlocks;
}

/** When the document has almost no structure, split body into readable sections. */
function expandOversizedOverviewBlocks(rawBlocks: RawBlock[], maxBodyChars: number): RawBlock[] {
  const out: RawBlock[] = [];
  for (const block of rawBlocks) {
    const body = block.body.join('\n');
    if (block.heading === 'Overview' && body.length > maxBodyChars) {
      const paras = body.split(/\n\n+/);
      let buf: string[] = [];
      let n = 0;
      let chars = 0;
      const flushPart = () => {
        if (buf.length === 0) return;
        n += 1;
        out.push({
          headingLevel: 2,
          heading: `Part ${n}`,
          body: [...buf],
        });
        buf = [];
        chars = 0;
      };
      for (const p of paras) {
        buf.push(p);
        chars += p.length + 2;
        if (chars >= maxBodyChars) flushPart();
      }
      flushPart();
      if (out.length === 0) {
        out.push(block);
      }
    } else {
      out.push(block);
    }
  }
  return out.length > 0 ? out : rawBlocks;
}

function assignUnitsAndSections(
  rawBlocks: RawBlock[],
  bookTitle: string,
): { units: Array<{ title: string; subtopics: string[] }>; sections: IngestSection[] } {
  const units: Array<{ title: string; subtopics: string[] }> = [];
  const sections: IngestSection[] = [];
  let currentUnitIndex = -1;
  let currentSubtopicIndex = 0;

  const h2ishCount = rawBlocks.filter((b) => b.headingLevel >= 2).length;
  const h1Count = rawBlocks.filter((b) => b.headingLevel === 1).length;

  // If there are many H2-like sections but no H1, group them into units for a real "book" feel.
  const groupEvery =
    h1Count === 0 && h2ishCount > 6
      ? Math.max(2, Math.min(6, Math.ceil(h2ishCount / Math.min(10, Math.max(3, Math.round(Math.sqrt(h2ishCount)))))))
      : 0;

  let h2InCurrentUnit = 0;

  for (const block of rawBlocks) {
    const body = block.body.join('\n').trim();
    const headingTitle = cleanHeading(block.heading) || `Topic ${sections.length + 1}`;

    const startsNewUnit =
      block.headingLevel === 1 ||
      currentUnitIndex < 0 ||
      (groupEvery > 0 && block.headingLevel >= 2 && h2InCurrentUnit >= groupEvery);

    if (startsNewUnit) {
      const unitTitle = block.headingLevel === 1 ? headingTitle : headingTitle;
      units.push({ title: unitTitle, subtopics: [] });
      currentUnitIndex = units.length - 1;
      currentSubtopicIndex = 0;
      h2InCurrentUnit = 0;
    }

    if (block.headingLevel === 1) {
      const unit = units[currentUnitIndex]!;
      if (body) {
        const stTitle = 'Introduction';
        unit.subtopics.push(stTitle);
        const sectionMarkdown = `## ${stTitle}\n\n**${headingTitle}**\n\n${body}`.trim();
        sections.push({
          id: `u${currentUnitIndex}-s${currentSubtopicIndex}`,
          title: stTitle,
          level: 2,
          markdown: sectionMarkdown,
          unitIndex: currentUnitIndex,
          subtopicIndex: currentSubtopicIndex,
          containsTable: hasTable(sectionMarkdown),
          containsMermaid: hasMermaid(sectionMarkdown),
        });
        currentSubtopicIndex += 1;
        h2InCurrentUnit += 1;
      }
      continue;
    }

    if (block.headingLevel >= 2) {
      const sectionMarkdown = [`## ${headingTitle}`, body].filter(Boolean).join('\n\n').trim();
      const unit = units[currentUnitIndex]!;
      if (!unit.subtopics.includes(headingTitle)) {
        unit.subtopics.push(headingTitle);
      }
      const subtopicIndex = currentSubtopicIndex++;
      sections.push({
        id: `u${currentUnitIndex}-s${subtopicIndex}`,
        title: headingTitle,
        level: block.headingLevel,
        markdown: sectionMarkdown,
        unitIndex: currentUnitIndex,
        subtopicIndex,
        containsTable: hasTable(sectionMarkdown),
        containsMermaid: hasMermaid(sectionMarkdown),
      });
      h2InCurrentUnit += 1;
    }
  }

  for (const u of units) {
    if (u.subtopics.length === 0) u.subtopics.push('Overview');
  }

  if (sections.length === 0) {
    units.splice(0, units.length, { title: 'Unit 1', subtopics: ['Overview'] });
    const md = rawBlocks.map((b) => b.body.join('\n')).join('\n\n') || bookTitle;
    sections.push({
      id: 'u0-s0',
      title: 'Overview',
      level: 2,
      markdown: `## Overview\n\n${md}`,
      unitIndex: 0,
      subtopicIndex: 0,
      containsTable: hasTable(md),
      containsMermaid: hasMermaid(md),
    });
  }

  return { units, sections };
}

function ensureVisualsPerUnit(
  structure: BookStructure,
  sections: IngestSection[],
): void {
  for (let u = 0; u < structure.units.length; u++) {
    const unitSections = sections.filter((s) => s.unitIndex === u);
    if (unitSections.length === 0) continue;
    const hasUnitTable = unitSections.some((s) => s.containsTable);
    const hasUnitMermaid = unitSections.some((s) => s.containsMermaid);
    if (!hasUnitTable || !hasUnitMermaid) {
      const first = unitSections[0]!;
      const enrich = buildUnitVisualEnrichment(
        structure.units[u]!.unitTitle,
        structure.units[u]!.subtopics,
      );
      first.markdown = `${first.markdown}\n\n${enrich}`.trim();
      first.containsTable = true;
      first.containsMermaid = true;
    }
  }
}

/**
 * Turn flat / semi-structured ingest markdown into BookStructure + per-subtopic sections.
 */
export function sectionizeIngestMarkdown(markdown: string, fallbackTitle: string): SectionizeResult {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const bookTitle = (titleMatch?.[1]?.trim() || fallbackTitle || 'Ingested Book').trim();

  let rawBlocks = splitMarkdownIntoRawBlocks(markdown, bookTitle);
  const h2Sections = rawBlocks.filter((b) => b.headingLevel >= 2).length;
  if (h2Sections < 4 && markdown.length > 12_000) {
    rawBlocks = expandOversizedOverviewBlocks(rawBlocks, 7000);
  }

  const { units, sections } = assignUnitsAndSections(rawBlocks, bookTitle);

  const structure: BookStructure = {
    title: bookTitle,
    units: units.map((u, idx) => ({
      unitTitle: u.title?.trim() || `Unit ${idx + 1}`,
      subtopics: u.subtopics.length > 0 ? u.subtopics : ['Overview'],
    })),
    capstoneTopics: [],
    caseStudyTopics: [],
  };

  ensureVisualsPerUnit(structure, sections);

  return { structure, sections };
}
