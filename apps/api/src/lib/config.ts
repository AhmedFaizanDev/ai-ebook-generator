export const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

export const UNIT_COUNT = DEBUG_MODE ? 1 : 10;
export const SUBTOPICS_PER_UNIT = DEBUG_MODE ? 1 : 6;
export const CAPSTONE_COUNT = DEBUG_MODE ? 1 : 2;
export const CASE_STUDY_COUNT = DEBUG_MODE ? 1 : 3;
export const TOTAL_SUBTOPICS = UNIT_COUNT * SUBTOPICS_PER_UNIT;
export const MIN_CALL_INTERVAL_MS = DEBUG_MODE ? 800 : 0;
export const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY ?? '3', 10);

export const LIGHT_MODEL = process.env.LIGHT_MODEL || 'gpt-4o-mini';
