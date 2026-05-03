import type { UnitStructure } from './types';
import { normalizeTitleSpacing } from './title-spacing';

/**
 * Parse a free-text "syllabus" cell from the batch CSV into ordered units and subtopics.
 *
 * Recognised patterns:
 *   - Unit headers:   `UNIT 1 ALGEBRA`, `Unit 1: Algebra`, `Unit - 1`, `UNIT-1 - Algebra` (case-insensitive).
 *   - Subtopic lines: `1.1 Topic title`, `1.10 Topic title` (any unit number, any sub number).
 *
 * Behaviour:
 *   - Lines that match neither pattern are appended to the previous subtopic title (handles wrapped lines).
 *   - Subtopic numbers are not required to be sequential; ordering follows file order.
 *   - Returns units with their subtopics in the order parsed.
 *
 * Throws when nothing parses (caller decides to skip the row).
 */
export function parseSyllabusOutline(syllabus: string): UnitStructure[] {
  if (!syllabus || typeof syllabus !== 'string') {
    throw new Error('parseSyllabusOutline: empty syllabus');
  }

  const normalised = syllabus
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' '); // non-breaking space

  const lines = normalised.split('\n');

  const unitRe = /^\s*UNIT\s*[-:]?\s*(\d+)\s*[-:.]?\s*(.*)$/i;
  const subtopicRe = /^\s*(\d+)\s*\.\s*(\d+)\s*[)\.\-:]?\s*(.*)$/;

  type WorkingUnit = { unitTitle: string; subtopics: string[] };
  const units: WorkingUnit[] = [];
  let currentUnit: WorkingUnit | null = null;
  let lastWasSubtopic = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      lastWasSubtopic = false;
      continue;
    }

    const unitMatch = line.match(unitRe);
    if (unitMatch) {
      const titleRaw = unitMatch[2]?.trim() ?? '';
      const unitNumber = unitMatch[1];
      const unitTitle = titleRaw.length > 0 ? titleRaw : `Unit ${unitNumber}`;
      currentUnit = { unitTitle: cleanTitle(unitTitle, true), subtopics: [] };
      units.push(currentUnit);
      lastWasSubtopic = false;
      continue;
    }

    const subMatch = line.match(subtopicRe);
    if (subMatch) {
      if (!currentUnit) {
        // Subtopic before any unit header — invent a Unit 1 wrapper to preserve content.
        currentUnit = { unitTitle: 'Unit 1', subtopics: [] };
        units.push(currentUnit);
      }
      const text = (subMatch[3] ?? '').trim();
      if (text.length > 0) {
        currentUnit.subtopics.push(cleanTitle(text, true));
        lastWasSubtopic = true;
      }
      continue;
    }

    // Continuation line: append to last subtopic title if we just had one.
    if (lastWasSubtopic && currentUnit && currentUnit.subtopics.length > 0) {
      const lastIdx = currentUnit.subtopics.length - 1;
      currentUnit.subtopics[lastIdx] = cleanTitle(
        `${currentUnit.subtopics[lastIdx]} ${line}`,
        true,
      );
    }
    // Otherwise: ignore stray prose between units.
  }

  // Drop units that ended up with zero subtopics; throw if nothing usable parsed.
  const usable = units.filter((u) => u.subtopics.length > 0);
  if (usable.length === 0) {
    throw new Error(
      'parseSyllabusOutline: no units with subtopics could be parsed from the syllabus text',
    );
  }

  return usable.map((u) => ({
    unitTitle: u.unitTitle,
    subtopics: u.subtopics,
  }));
}

/** Strip stray leading separators, normalise internal whitespace, cap length. */
function cleanTitle(raw: string, applySpacing = false): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\-:.\)\s]+/, '').trim();
  // Drop dangling sentence-end punctuation that often appears in pasted syllabi.
  t = t.replace(/[\s,;:]+$/g, '').trim();
  // Hard cap so a runaway paragraph cannot become a 2000-char "subtopic title".
  if (t.length > 240) {
    t = t.slice(0, 240).trim();
  }
  if (applySpacing) {
    t = normalizeTitleSpacing(t);
  }
  return t;
}
