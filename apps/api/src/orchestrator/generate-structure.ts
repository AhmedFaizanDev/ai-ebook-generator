import { BookStructure, SessionState } from '@/lib/types';
import { UNIT_COUNT, SUBTOPICS_PER_UNIT, CAPSTONE_COUNT, CASE_STUDY_COUNT } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT_STRUCTURE } from '@/prompts/system';
import { buildStructurePrompt, STRUCTURE_RETRY_SUFFIX } from '@/prompts/structure';

function validateStructure(data: unknown): data is BookStructure {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string' || !obj.title.trim()) return false;
  if (!Array.isArray(obj.units) || obj.units.length !== UNIT_COUNT) return false;

  for (const unit of obj.units) {
    if (typeof unit !== 'object' || !unit) return false;
    const u = unit as Record<string, unknown>;
    if (typeof u.unitTitle !== 'string' || !(u.unitTitle as string).trim()) return false;
    if (!Array.isArray(u.subtopics) || u.subtopics.length !== SUBTOPICS_PER_UNIT) return false;
    if (u.subtopics.some((s: unknown) => typeof s !== 'string' || !(s as string).trim())) return false;
  }

  if (!Array.isArray(obj.capstoneTopics) || obj.capstoneTopics.length !== CAPSTONE_COUNT) return false;
  if (!Array.isArray(obj.caseStudyTopics) || obj.caseStudyTopics.length !== CASE_STUDY_COUNT) return false;
  if (obj.capstoneTopics.some((s: unknown) => typeof s !== 'string' || !(s as string).trim())) return false;
  if (obj.caseStudyTopics.some((s: unknown) => typeof s !== 'string' || !(s as string).trim())) return false;

  return true;
}

function getValidationFailureReason(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Not an object';
  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string') return 'Missing or invalid title';
  if (!(obj.title as string).trim()) return 'Title is empty';
  if (!Array.isArray(obj.units)) return 'units is not an array';
  if (obj.units.length !== UNIT_COUNT) return `units.length is ${obj.units.length}, required ${UNIT_COUNT}`;

  for (let i = 0; i < obj.units.length; i++) {
    const unit = obj.units[i];
    if (typeof unit !== 'object' || !unit) return `units[${i}] invalid`;
    const u = unit as Record<string, unknown>;
    if (typeof u.unitTitle !== 'string' || !(u.unitTitle as string).trim()) return `units[${i}].unitTitle missing or empty`;
    if (!Array.isArray(u.subtopics)) return `units[${i}].subtopics is not an array`;
    if (u.subtopics.length !== SUBTOPICS_PER_UNIT) return `units[${i}].subtopics.length is ${u.subtopics.length}, required ${SUBTOPICS_PER_UNIT}`;
    for (let j = 0; j < u.subtopics.length; j++) {
      const s = u.subtopics[j];
      if (typeof s !== 'string' || !(s as string).trim()) return `units[${i}].subtopics[${j}] missing or empty`;
    }
  }

  if (!Array.isArray(obj.capstoneTopics)) return 'capstoneTopics is not an array';
  if (obj.capstoneTopics.length !== CAPSTONE_COUNT) return `capstoneTopics.length is ${obj.capstoneTopics.length}, required ${CAPSTONE_COUNT}`;
  if (!Array.isArray(obj.caseStudyTopics)) return 'caseStudyTopics is not an array';
  if (obj.caseStudyTopics.length !== CASE_STUDY_COUNT) return `caseStudyTopics.length is ${obj.caseStudyTopics.length}, required ${CASE_STUDY_COUNT}`;

  return 'Unknown';
}

function repairStructure(parsed: unknown): BookStructure {
  const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const title = typeof obj.title === 'string' && obj.title.trim()
    ? obj.title.trim()
    : 'Technical Ebook';

  const unitsRaw = Array.isArray(obj.units) ? obj.units : [];
  const units: BookStructure['units'] = [];

  for (let u = 0; u < UNIT_COUNT; u++) {
    const raw = unitsRaw[u];
    const unitTitle =
      raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).unitTitle === 'string'
        ? (raw as Record<string, unknown>).unitTitle as string
        : `Unit ${u + 1}`;
    const subtopicsRaw = raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).subtopics)
      ? (raw as Record<string, unknown>).subtopics as unknown[]
      : [];
    const subtopics: string[] = [];
    for (let s = 0; s < SUBTOPICS_PER_UNIT; s++) {
      const val = subtopicsRaw[s];
      subtopics.push(typeof val === 'string' && val.trim() ? val.trim() : `Subtopic ${s + 1}`);
    }
    units.push({ unitTitle: unitTitle.trim() || `Unit ${u + 1}`, subtopics });
  }

  const capstoneRaw = Array.isArray(obj.capstoneTopics) ? obj.capstoneTopics : [];
  const capstoneTopics: string[] = [];
  for (let i = 0; i < CAPSTONE_COUNT; i++) {
    const val = capstoneRaw[i];
    capstoneTopics.push(typeof val === 'string' && val.trim() ? val.trim() : `Capstone Project ${i + 1}`);
  }

  const caseStudyRaw = Array.isArray(obj.caseStudyTopics) ? obj.caseStudyTopics : [];
  const caseStudyTopics: string[] = [];
  for (let i = 0; i < CASE_STUDY_COUNT; i++) {
    const val = caseStudyRaw[i];
    caseStudyTopics.push(typeof val === 'string' && val.trim() ? val.trim() : `Case Study ${i + 1}`);
  }

  return { title, units, capstoneTopics, caseStudyTopics };
}

async function callAndParse(
  session: SessionState,
  userPrompt: string,
): Promise<{ parsed: unknown; content: string }> {
  const result = await callLLM({
    model: session.model,
    systemPrompt: SYSTEM_PROMPT_STRUCTURE,
    userPrompt,
    maxTokens: 2000,
    temperature: 0.2,
    callLabel: 'structure',
  });
  incrementCounters(session, result.totalTokens);
  let content = result.content.trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) content = jsonMatch[0];
  const parsed = JSON.parse(content);
  return { parsed, content };
}

export async function generateStructure(session: SessionState): Promise<BookStructure> {
  const userPrompt = buildStructurePrompt(session.topic);

  let parsed: unknown;
  try {
    const first = await callAndParse(session, userPrompt);
    parsed = first.parsed;
  } catch {
    const retryPrompt = userPrompt + '\n\n' + STRUCTURE_RETRY_SUFFIX;
    const r = await callAndParse(session, retryPrompt);
    parsed = r.parsed;
  }

  if (validateStructure(parsed)) {
    return parsed as BookStructure;
  }

  const reason = getValidationFailureReason(parsed);
  console.warn(
    `[generate-structure] Validation failed: ${reason}. Parsed keys:`,
    parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : [],
  );

  const retryPrompt = userPrompt + '\n\n' + STRUCTURE_RETRY_SUFFIX;
  let retryParsed: unknown;
  try {
    const r = await callAndParse(session, retryPrompt);
    retryParsed = r.parsed;
  } catch {
    retryParsed = parsed;
  }

  if (validateStructure(retryParsed)) {
    return retryParsed as BookStructure;
  }

  const repaired = repairStructure(retryParsed);
  console.warn('[generate-structure] Schema repaired to meet required counts; some titles may be placeholders.');
  return repaired;
}
