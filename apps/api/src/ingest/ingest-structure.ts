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

function hasFigureLine(md: string): boolean {
  return /!\[[^\]]*\]\([^)]+\)/.test(md);
}

function isTocLikeBody(body: string): boolean {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return false;
  let score = 0;
  for (const line of lines) {
    if (/\.{4,}/.test(line) && /\d+\s*$/.test(line)) score += 1;
    if (/^\d+\.[\d.]*\s+.+\s+\d+\s*$/.test(line)) score += 1;
  }
  return score >= Math.min(8, Math.ceil(lines.length * 0.25));
}

function isTocLikeBlock(block: RawBlock): boolean {
  const h = block.heading.trim().toLowerCase();
  if (/^(table of contents|contents|list of figures|list of tables)$/i.test(h)) return true;
  return isTocLikeBody(block.body.join('\n'));
}

/** Merge consecutive TOC/list blocks so they do not each spawn a top-level unit. */
function collapseTocRuns(blocks: RawBlock[]): RawBlock[] {
  const out: RawBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (!isTocLikeBlock(blocks[i]!)) {
      out.push(blocks[i]!);
      i += 1;
      continue;
    }
    let j = i;
    const parts: string[] = [];
    while (j < blocks.length && isTocLikeBlock(blocks[j]!)) {
      const b = blocks[j]!;
      parts.push(`### ${b.heading}`, ...b.body, '');
      j += 1;
    }
    out.push({
      headingLevel: 2,
      heading: 'Table of contents (from source)',
      body: parts,
    });
    i = j;
  }
  return out;
}

function isTrivialHeadingBlock(b: RawBlock): boolean {
  const bodyJoin = b.body.join('\n');
  const bodyTrim = bodyJoin.trim();
  return (
    b.headingLevel >= 2 &&
    bodyTrim.length < 48 &&
    !hasTable(bodyJoin) &&
    !hasMermaid(bodyJoin) &&
    !hasFigureLine(bodyJoin)
  );
}

/** Merge tiny heading-only sections (including runs of them) into the following section. */
function mergeTrivialHeadingBlocks(blocks: RawBlock[]): RawBlock[] {
  const out: RawBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (isTrivialHeadingBlock(b) && i + 1 < blocks.length) {
      const prefix: string[] = [`### ${b.heading}`, '', ...b.body, ''];
      let j = i + 1;
      while (j < blocks.length && isTrivialHeadingBlock(blocks[j]!)) {
        const t = blocks[j]!;
        prefix.push(`### ${t.heading}`, '', ...t.body, '');
        j += 1;
      }
      if (j < blocks.length) {
        const nxt = blocks[j]!;
        out.push({
          headingLevel: nxt.headingLevel,
          heading: nxt.heading,
          body: [...prefix, '', ...nxt.body],
        });
        i = j + 1;
        continue;
      }
      out.push({ ...b, body: prefix });
      i = j;
      continue;
    }
    out.push(b);
    i += 1;
  }
  return out;
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

type RawBlock = { headingLevel: 1 | 2 | 3; heading: string; body: string[] };

/** Lines that look like structural headings in Word exports without proper heading styles. */
function inferHeadingFromPlainLine(trimmed: string): { level: 1 | 2 | 3; title: string } | null {
  if (/^#{1,3}\s/.test(trimmed)) return null;
  if (trimmed.length > 120) return null;
  const collapsed = trimmed.replace(/\s+/g, ' ');
  const u = collapsed.toUpperCase();
  const thesisH1 = new Set([
    'ABSTRACT',
    'ACKNOWLEDGEMENT',
    'ACKNOWLEDGEMENTS',
    'ACKNOWLEDGMENT',
    'ACKNOWLEDGMENTS',
    'DECLARATION',
    'CERTIFICATE',
    'EXECUTIVE SUMMARY',
    'TABLE OF CONTENTS',
    'LIST OF FIGURES',
    'LIST OF TABLES',
    'REFERENCES',
    'REFERENCE',
    'REFERANCE',
    'BIBLIOGRAPHY',
    'INTRODUCTION',
    'LITERATURE REVIEW',
    'METHODOLOGY',
    'RESULTS AND DISCUSSION',
    'RESULTS',
    'DISCUSSION',
    'CONCLUSION',
    'CONCLUSIONS',
    'RECOMMENDATIONS',
    'NOMENCLATURE',
    'ABBREVIATIONS',
  ]);
  if (thesisH1.has(u)) {
    return { level: 1, title: trimmed };
  }
  if (/^appendix\s+[\w.-]+$/i.test(collapsed) && collapsed.length < 80) {
    return { level: 1, title: trimmed };
  }
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
      current = { headingLevel: 2, heading: 'Body', body: [] };
    }
    current.body.push(line);
  }
  flushRawBlock(current, rawBlocks);

  if (rawBlocks.length === 0) {
    rawBlocks.push({ headingLevel: 2, heading: 'Body', body: [markdown] });
  }

  return rawBlocks;
}

/** When the document has almost no structure, split body into readable sections. */
function expandOversizedOverviewBlocks(rawBlocks: RawBlock[], maxBodyChars: number): RawBlock[] {
  const out: RawBlock[] = [];
  for (const block of rawBlocks) {
    const body = block.body.join('\n');
    if ((block.heading === 'Overview' || block.heading === 'Body' || block.heading === 'Opening') && body.length > maxBodyChars) {
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
      } else {
        // Avoid empty units / TOC-only shells: keep heading as a real section with an explicit stub.
        unit.subtopics.push(headingTitle);
        const sectionMarkdown = `## ${headingTitle}\n\n`;
        sections.push({
          id: `u${currentUnitIndex}-s${currentSubtopicIndex}`,
          title: headingTitle,
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

/**
 * Turn flat / semi-structured ingest markdown into BookStructure + per-subtopic sections.
 */
export function sectionizeIngestMarkdown(markdown: string, fallbackTitle: string): SectionizeResult {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const bookTitle = (titleMatch?.[1]?.trim() || fallbackTitle || 'Ingested Book').trim();

  let rawBlocks = splitMarkdownIntoRawBlocks(markdown, bookTitle);
  rawBlocks = mergeTrivialHeadingBlocks(rawBlocks);
  rawBlocks = collapseTocRuns(rawBlocks);
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

  return { structure, sections };
}
