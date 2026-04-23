import { SUBTOPICS_PER_UNIT, TOTAL_SUBTOPICS } from '@/lib/config';
import type { SourceBrief, SourceFlatSection, SourceSlot } from '@/ingest/source-seed/types';
import { extractEquationSnippets } from '@/ingest/source-seed/extract-math-lines';
import { extractRvimgMarkdownLines } from '@/ingest/source-seed/extract-rvimg-lines';
import { keywordsForText } from '@/ingest/source-seed/keywords-heuristic';

const MAX_RVIMG_PER_SECTION = 8;
const MAX_RVIMG_PER_SLOT = 16;

const DEFAULT_MIN_WORDS_PER_SLOT = 40;
const DEFAULT_MAX_WORDS_PER_SLOT = 3500;

function totalWords(sections: SourceFlatSection[]): number {
  return sections.reduce((a, s) => a + s.wordCount, 0);
}

function sectionText(s: SourceFlatSection): string {
  return `${s.heading}\n\n${s.bodyMarkdown}`;
}

function makeSlot(
  unitIdx: number,
  subIdx: number,
  buf: SourceFlatSection[],
  globalKw: string[],
): SourceSlot {
  if (buf.length === 0) {
    return {
      unitIndex: unitIdx,
      subtopicIndex: subIdx,
      summary: '(No source text mapped to this slot.)',
      keywords: globalKw.slice(0, 10),
      equations: [],
      sourceHeadingRefs: [],
      imageLines: [],
    };
  }
  const heads = buf.map((b) => b.heading);
  const joined = buf.map(sectionText).join('\n\n');
  const excerptMax = 2800;
  const excerpt = joined.length > excerptMax ? `${joined.slice(0, excerptMax)}…` : joined;
  const summary = `Source sections: ${heads.slice(0, 8).join(' → ')}${heads.length > 8 ? ' …' : ''}\n\n${excerpt}`;
  const eqs: string[] = [];
  for (const b of buf) {
    eqs.push(...extractEquationSnippets(b.bodyMarkdown, 12));
  }
  const uniqEq = [...new Set(eqs)].slice(0, 28);
  const uniqHeads = [...new Set(heads)];
  const slotKw = keywordsForText(joined + ' ' + uniqHeads.join(' '), 14);
  const imgs: string[] = [];
  const imgSeen = new Set<string>();
  for (const b of buf) {
    for (const line of extractRvimgMarkdownLines(b.bodyMarkdown, MAX_RVIMG_PER_SECTION)) {
      if (imgSeen.has(line)) continue;
      imgSeen.add(line);
      imgs.push(line);
      if (imgs.length >= MAX_RVIMG_PER_SLOT) break;
    }
    if (imgs.length >= MAX_RVIMG_PER_SLOT) break;
  }
  return {
    unitIndex: unitIdx,
    subtopicIndex: subIdx,
    summary,
    keywords: slotKw.length ? slotKw : globalKw.slice(0, 8),
    equations: uniqEq,
    sourceHeadingRefs: uniqHeads.slice(0, 14),
    imageLines: imgs,
  };
}

/**
 * Order-preserving greedy pack: each slot targets ~total/60 words (clamped), walk sections once.
 * Remaining sections are merged into the last slot(s).
 */
export function buildSlotPlan(brief: SourceBrief): SourceSlot[] {
  const sections = brief.sections;
  const tw = totalWords(sections);
  const rawTarget = Math.floor(tw / TOTAL_SUBTOPICS) || DEFAULT_MIN_WORDS_PER_SLOT;
  const targetPerSlot = Math.min(
    DEFAULT_MAX_WORDS_PER_SLOT,
    Math.max(DEFAULT_MIN_WORDS_PER_SLOT, rawTarget),
  );

  const slots: SourceSlot[] = [];
  let cursor = 0;

  for (let slotIdx = 0; slotIdx < TOTAL_SUBTOPICS; slotIdx++) {
    const unitIdx = Math.floor(slotIdx / SUBTOPICS_PER_UNIT);
    const subIdx = slotIdx % SUBTOPICS_PER_UNIT;
    const buf: SourceFlatSection[] = [];
    let slotW = 0;

    while (cursor < sections.length && slotW < targetPerSlot) {
      const sec = sections[cursor]!;
      buf.push(sec);
      slotW += sec.wordCount;
      cursor += 1;
    }

    if (buf.length === 0 && cursor < sections.length) {
      buf.push(sections[cursor]!);
      cursor += 1;
    }

    slots.push(makeSlot(unitIdx, subIdx, buf, brief.globalKeywords));
  }

  // Append any leftover sections (very long tail) into the final slot
  if (cursor < sections.length) {
    const tail = sections.slice(cursor);
    const last = slots[TOTAL_SUBTOPICS - 1]!;
    const extra = tail.map(sectionText).join('\n\n');
    const extraHeads = tail.map((t) => t.heading);
    last.summary += `\n\n(Additional source tail: ${extraHeads.join(' → ')})\n\n${extra.slice(0, 2000)}${extra.length > 2000 ? '…' : ''}`;
    last.sourceHeadingRefs = [...new Set([...last.sourceHeadingRefs, ...extraHeads])].slice(0, 20);
    const moreEq = tail.flatMap((t) => extractEquationSnippets(t.bodyMarkdown, 8));
    last.equations = [...new Set([...last.equations, ...moreEq])].slice(0, 36);
    const moreImg = tail.flatMap((t) => extractRvimgMarkdownLines(t.bodyMarkdown, MAX_RVIMG_PER_SECTION));
    const prevImg = last.imageLines ?? [];
    last.imageLines = [...new Set([...prevImg, ...moreImg])].slice(0, MAX_RVIMG_PER_SLOT + 8);
  }

  return slots;
}
