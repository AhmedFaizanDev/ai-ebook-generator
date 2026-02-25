import { UNIT_COUNT, SUBTOPICS_PER_UNIT, CAPSTONE_COUNT, CASE_STUDY_COUNT } from '@/lib/config';

const subtopicPlaceholders = Array.from({ length: SUBTOPICS_PER_UNIT }, (_, i) => `"s${i + 1}"`).join(',');
const capstonePlaceholders = Array.from({ length: CAPSTONE_COUNT }, (_, i) => `"c${i + 1}"`).join(',');
const caseStudyPlaceholders = Array.from({ length: CASE_STUDY_COUNT }, (_, i) => `"cs${i + 1}"`).join(',');

export function buildStructurePrompt(topic: string): string {
  return `Ebook topic: "${topic}"

Output valid JSON only. No markdown, no explanation. Use this exact shape:
{"title":"string","units":[{"unitTitle":"string","subtopics":[${subtopicPlaceholders}]}],"capstoneTopics":[${capstonePlaceholders}],"caseStudyTopics":[${caseStudyPlaceholders}]}

Required counts (do not deviate): Exactly ${UNIT_COUNT} units. Each unit has exactly ${SUBTOPICS_PER_UNIT} subtopics (${SUBTOPICS_PER_UNIT} strings in "subtopics" array). Exactly ${CAPSTONE_COUNT} capstone topic${CAPSTONE_COUNT > 1 ? 's' : ''}. Exactly ${CASE_STUDY_COUNT} case study topic${CASE_STUDY_COUNT > 1 ? 's' : ''}. Every title and topic must be a non-empty string. Unit and subtopic titles: specific and technical (e.g. "Request lifecycle" not "Introduction"). Order units foundational to advanced. No duplicate subtopic titles.`;
}

export const STRUCTURE_RETRY_SUFFIX = `CRITICAL: Your JSON must have exactly ${UNIT_COUNT} units. Each unit must have exactly ${SUBTOPICS_PER_UNIT} subtopics. capstoneTopics must have exactly ${CAPSTONE_COUNT} string${CAPSTONE_COUNT > 1 ? 's' : ''}. caseStudyTopics must have exactly ${CASE_STUDY_COUNT} string${CASE_STUDY_COUNT > 1 ? 's' : ''}. No empty strings. Output only the JSON object.`;
