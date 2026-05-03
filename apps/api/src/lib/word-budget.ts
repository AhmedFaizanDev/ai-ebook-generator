import type { BookStructure } from './types';

/** Target total book length in words. ~250 pages at ~350 words/page. */
export const TARGET_BOOK_WORDS = 90_000;

/** Reference total subtopics for the scaling factor. Books at this size hit the natural per-topic band. */
export const BASELINE_TOPICS = 60;

/** Lower bound for any single subtopic, regardless of allocation math. */
export const MIN_TOPIC_WORDS = 800;

/** Upper bound for any single subtopic, regardless of allocation math. */
export const MAX_TOPIC_WORDS = 2000;

/** Lower bound for the per-unit introduction body. */
export const MIN_UNIT_INTRO_WORDS = 500;
/** Upper bound for the per-unit introduction body. */
export const MAX_UNIT_INTRO_WORDS = 700;

/** Half-width of the [min, max] band reported to the LLM around the centre target. */
const SUBTOPIC_BAND_HALF_WIDTH = 100;

export interface SubtopicWordTarget {
  /** Soft floor reported to the LLM. */
  min: number;
  /** Hard cap reported to the LLM. Always >= min + 1. */
  max: number;
  /** Centre target before clamping (useful for logging). */
  center: number;
}

export interface WordTargets {
  /** perSubtopic[unitIdx][subIdx] -> target band. */
  perSubtopic: SubtopicWordTarget[][];
  /** Per-unit introduction band (shared across units). */
  unitIntro: { min: number; max: number };
  /** Sum of subtopic centre targets. */
  totalSubtopicCenter: number;
}

/**
 * Allocate a per-subtopic word budget based on the CSV-driven structure.
 *
 * Algorithm (matches the user spec):
 *   T = total subtopics; U = units.length
 *   wordsPerUnit  = TARGET_BOOK_WORDS / U
 *   scalingFactor = BASELINE_TOPICS / T
 *   for each unit:
 *     base   = wordsPerUnit / unit.subtopics.length
 *     center = clamp(round(base * scalingFactor), MIN_TOPIC_WORDS, MAX_TOPIC_WORDS)
 */
export function computeWordTargets(structure: BookStructure): WordTargets {
  const units = structure.units ?? [];
  const U = Math.max(1, units.length);
  const T = Math.max(
    1,
    units.reduce((n, u) => n + (u.subtopics?.length ?? 0), 0),
  );

  const wordsPerUnit = TARGET_BOOK_WORDS / U;
  const scalingFactor = BASELINE_TOPICS / T;

  const perSubtopic: SubtopicWordTarget[][] = [];
  let totalSubtopicCenter = 0;

  for (const unit of units) {
    const subCount = Math.max(1, unit.subtopics?.length ?? 0);
    const base = wordsPerUnit / subCount;
    const rawCenter = Math.round(base * scalingFactor);
    const center = clamp(rawCenter, MIN_TOPIC_WORDS, MAX_TOPIC_WORDS);

    const min = clamp(center - SUBTOPIC_BAND_HALF_WIDTH, MIN_TOPIC_WORDS, MAX_TOPIC_WORDS - 1);
    const max = clamp(center + SUBTOPIC_BAND_HALF_WIDTH, min + 1, MAX_TOPIC_WORDS);

    const row: SubtopicWordTarget[] = (unit.subtopics ?? []).map(() => ({ min, max, center }));
    perSubtopic.push(row);
    totalSubtopicCenter += center * row.length;
  }

  return {
    perSubtopic,
    unitIntro: { min: MIN_UNIT_INTRO_WORDS, max: MAX_UNIT_INTRO_WORDS },
    totalSubtopicCenter,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/** Default fallback target when no per-subtopic budget is available (e.g. legacy resume / web flow). */
export const DEFAULT_SUBTOPIC_BAND: SubtopicWordTarget = {
  min: 1100,
  max: 1300,
  center: 1200,
};
