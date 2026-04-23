import { TOTAL_SUBTOPICS } from '@/lib/config';

/**
 * Optional whole-book page target for orchestrator-seeded runs.
 * Uses ORCH_TARGET_PAGES or INGEST_TARGET_PAGES with ORCH_WORDS_PER_PAGE or INGEST_WORDS_PER_PAGE.
 */
export function orchestratorWordsPerSubtopicFromEnv(): { min: number; max: number } | null {
  const tp = parseInt(process.env.ORCH_TARGET_PAGES || process.env.INGEST_TARGET_PAGES || '0', 10);
  if (!Number.isFinite(tp) || tp < 30) return null;
  const wpp = parseInt(process.env.ORCH_WORDS_PER_PAGE || process.env.INGEST_WORDS_PER_PAGE || '275', 10);
  const wordsPerPage = Number.isFinite(wpp) && wpp > 0 ? wpp : 275;
  const totalWords = tp * wordsPerPage;
  const per = Math.max(500, Math.floor(totalWords / TOTAL_SUBTOPICS));
  const min = Math.max(750, Math.floor(per * 0.9));
  const max = Math.min(1700, Math.ceil(per * 1.12));
  if (min >= max) return { min: 900, max: 1400 };
  return { min, max };
}
