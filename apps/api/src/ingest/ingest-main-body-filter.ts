import type { BookStructure } from '@/lib/types';
import type { SessionState } from '@/lib/types';
import type { IngestSection } from '@/ingest/types';

function stripModeOff(): boolean {
  const v = (process.env.INGEST_BASELINE_STRIP_MODE || 'strict').toLowerCase();
  return v === 'off' || v === '0' || v === 'false' || v === 'no';
}

function legacyFormalStripEnabled(): boolean {
  const v = (process.env.INGEST_STRIP_FORMAL_FRONT_MATTER || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

/** Dot-leader / page-number TOC lines from Word imports (duplicate of generated HTML TOC). */
function isTocLikeMarkdownBody(markdown: string): boolean {
  const body = markdown.replace(/^#{1,6}\s+[^\n]+\n+/, '').trim();
  if (body.length < 80) return false;
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return false;
  let score = 0;
  for (const line of lines) {
    if (/\.{4,}/.test(line) && /\d+\s*$/.test(line)) score += 1;
    if (/^\d+\.[\d.]*\s+.+\s+\d+\s*$/.test(line)) score += 1;
  }
  return score >= Math.min(8, Math.ceil(lines.length * 0.25));
}

/**
 * True if this unit/section should be omitted from ingest body (deterministic).
 * Default: remove only duplicate table-of-contents material (Word TOC vs auto HTML TOC).
 * Set INGEST_STRIP_FORMAL_FRONT_MATTER=1 to also drop declaration, abstract, etc. (legacy strict baseline).
 */
export function shouldStripNonNarrativeSection(
  unitTitle: string,
  sectionTitle: string,
  sectionMarkdown?: string,
): boolean {
  if (stripModeOff()) return false;
  const u = norm(unitTitle);
  const t = norm(sectionTitle);
  const combined = `${u} ${t}`;
  const md = sectionMarkdown ?? '';

  if (/\bfrom source\b/.test(combined)) return true;
  if (/^table of contents \(from source\)$/i.test(sectionTitle.trim())) return true;

  const titlePlain = sectionTitle.trim();
  if (/^table of contents$/i.test(titlePlain) || /^contents$/i.test(titlePlain)) {
    if (isTocLikeMarkdownBody(md)) return true;
  }

  if (legacyFormalStripEnabled()) {
    if (/\bdeclaration\b/.test(combined)) return true;
    if (/\bapproval\b/.test(combined)) return true;
    if (/\backnowledg(e)?ment/.test(combined)) return true;
    if (/\babstract\b/.test(combined)) return true;
    if (/\blist of (the )?figures?\b/.test(combined)) return true;
    if (/\blist of (the )?tables?\b/.test(combined)) return true;
    if (/\bexecutive summary\b/.test(combined)) return true;
    if (/\bsignature\b/.test(combined)) return true;
    if (/^contents$/i.test(t) || /^contents$/i.test(u)) return true;
  }

  return false;
}

function sortSections(a: IngestSection, b: IngestSection): number {
  if (a.unitIndex !== b.unitIndex) return a.unitIndex - b.unitIndex;
  return a.subtopicIndex - b.subtopicIndex;
}

/**
 * Remove duplicate TOC / non-narrative sections from session; renumber units/subtopics and rebuild `structure`.
 * Does not delete image files on disk.
 */
export function stripNonNarrativeForBaseline(session: SessionState): void {
  if (!session.structure || !session.ingestSections?.length) return;

  const structure = session.structure;
  const units = structure.units;
  const warnings: string[] = [];

  const kept: IngestSection[] = [];
  for (const sec of [...session.ingestSections].sort(sortSections)) {
    const unitTitle = units[sec.unitIndex]?.unitTitle ?? '';
    if (shouldStripNonNarrativeSection(unitTitle, sec.title, sec.markdown)) {
      warnings.push(`[baseline-strip] dropped section: unit "${unitTitle}" / "${sec.title}"`);
      continue;
    }
    kept.push(sec);
  }

  if (kept.length === session.ingestSections.length) {
    session.ingestWarnings = [...(session.ingestWarnings ?? []), ...warnings];
    return;
  }

  const newUnits: Array<{ unitTitle: string; sections: IngestSection[] }> = [];
  let group: { unitTitle: string; sections: IngestSection[] } | null = null;
  let lastOrigUnit = -1;

  for (const sec of kept) {
    if (!group || sec.unitIndex !== lastOrigUnit) {
      if (group) newUnits.push(group);
      group = {
        unitTitle: units[sec.unitIndex]?.unitTitle?.trim() || `Unit ${newUnits.length + 1}`,
        sections: [],
      };
      lastOrigUnit = sec.unitIndex;
    }
    group.sections.push(sec);
  }
  if (group) newUnits.push(group);

  const outSections: IngestSection[] = [];
  const newStructure: BookStructure = {
    title: structure.title,
    units: [],
    capstoneTopics: [],
    caseStudyTopics: [],
  };

  for (let ui = 0; ui < newUnits.length; ui++) {
    const g = newUnits[ui]!;
    const subtopics: string[] = [];
    for (let si = 0; si < g.sections.length; si++) {
      const s = g.sections[si]!;
      subtopics.push(s.title);
      outSections.push({
        ...s,
        id: `u${ui}-s${si}`,
        unitIndex: ui,
        subtopicIndex: si,
      });
    }
    newStructure.units.push({ unitTitle: g.unitTitle, subtopics: subtopics.length ? subtopics : ['Overview'] });
  }

  if (outSections.length === 0) {
    session.ingestWarnings = [
      ...(session.ingestWarnings ?? []),
      '[baseline-strip] all sections matched strip rules; keeping original structure',
      ...warnings,
    ];
    return;
  }

  session.structure = newStructure;
  session.ingestSections = outSections;
  session.subtopicMarkdowns.clear();
  for (const sec of outSections) {
    session.subtopicMarkdowns.set(`u${sec.unitIndex}-s${sec.subtopicIndex}`, sec.markdown);
  }
  session.unitMarkdowns = newStructure.units.map(() => null);
  session.ingestWarnings = [...(session.ingestWarnings ?? []), ...warnings];
}
