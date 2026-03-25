import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import {
  buildUnitExercisesPrompt,
  buildUnitExercisesRepairPrompt,
} from '@/prompts/unit-exercises';

const QUESTION_HEAD_RE = /\*\*\s*(\d{1,2})\./g;

export interface UnitExercisesValidation {
  pass: boolean;
  reasons: string[];
}

/** Post-validate 20 MCQs: numbering, answers, options, basic format. */
export function validateUnitExercisesMarkdown(md: string): UnitExercisesValidation {
  const reasons: string[] = [];
  if (!md || !md.trim()) {
    return { pass: false, reasons: ['empty exercises markdown'] };
  }

  if (!/^##\s+Exercises\b/im.test(md)) {
    reasons.push('missing "## Exercises" heading');
  }

  const qCounts = new Map<number, number>();
  let m: RegExpExecArray | null;
  QUESTION_HEAD_RE.lastIndex = 0;
  while ((m = QUESTION_HEAD_RE.exec(md)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) {
      qCounts.set(n, (qCounts.get(n) ?? 0) + 1);
    }
  }

  for (let i = 1; i <= 20; i++) {
    const c = qCounts.get(i) ?? 0;
    if (c !== 1) {
      reasons.push(
        c === 0
          ? `missing bold question **${i}.**`
          : `question **${i}.** appears ${c} times (expected exactly once)`,
      );
    }
  }

  const answers = md.match(/\*\*Answer:\s*[A-D]\s*\*\*/gi) ?? [];
  if (answers.length !== 20) {
    reasons.push(`expected 20 lines **Answer: A–D** (bold), found ${answers.length}`);
  }

  const lineStarts = (re: RegExp) => (md.match(re) ?? []).length;
  const a = lineStarts(/^A\)/gm);
  const b = lineStarts(/^B\)/gm);
  const c = lineStarts(/^C\)/gm);
  const d = lineStarts(/^D\)/gm);
  if (a !== 20) reasons.push(`expected 20 lines starting with "A)", found ${a}`);
  if (b !== 20) reasons.push(`expected 20 lines starting with "B)", found ${b}`);
  if (c !== 20) reasons.push(`expected 20 lines starting with "C)", found ${c}`);
  if (d !== 20) reasons.push(`expected 20 lines starting with "D)", found ${d}`);

  if (/\*\*[^\*\n]+\*\s+A\)/.test(md)) {
    reasons.push('Option A) appears on the same line as the end of bold question text (need a line break before A))');
  }

  return { pass: reasons.length === 0, reasons };
}

function normalizeExercisesMarkdown(md: string): string {
  let s = md.trim();
  s = s.replace(/([.?])\s*A\)/g, '$1\n\nA)');
  return s;
}

export async function generateUnitExercises(
  session: SessionState,
  unitIndex: number,
): Promise<string> {
  const structure = session.structure!;
  const unit = structure.units[unitIndex];
  const unitSummary = session.unitSummaries[unitIndex] ?? '';

  const baseArgs = [
    session.topic,
    unitIndex,
    unit.unitTitle,
    unit.subtopics,
    unitSummary,
  ] as const;

  const prompt1 = buildUnitExercisesPrompt(...baseArgs, { start: 1, end: 10 });
  const prompt2 = buildUnitExercisesPrompt(...baseArgs, { start: 11, end: 20 });

  const result1 = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical),
    userPrompt: prompt1,
    maxTokens: 1200,
    temperature: 0.3,
    callLabel: `unit-exercises-${unitIndex + 1}-1-10`,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });
  incrementCounters(session, result1.totalTokens);

  const result2 = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical),
    userPrompt: prompt2,
    maxTokens: 1200,
    temperature: 0.3,
    callLabel: `unit-exercises-${unitIndex + 1}-11-20`,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });
  incrementCounters(session, result2.totalTokens);

  const block1 = result1.content.trim();
  let block2 = result2.content.trim();
  // Strip stray ## Exercises heading from second block if model added it
  block2 = block2.replace(/^##\s*Exercises\s*\n*/i, '').trim();

  let combined = normalizeExercisesMarkdown(block1 + '\n\n' + block2);

  let check = validateUnitExercisesMarkdown(combined);
  if (check.pass) return combined;

  const repairPrompt = buildUnitExercisesRepairPrompt(
    session.topic,
    unitIndex,
    unit.unitTitle,
    unit.subtopics,
    unitSummary,
    check.reasons,
    combined,
  );

  const repairResult = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical),
    userPrompt: repairPrompt,
    maxTokens: 2500,
    temperature: 0.2,
    callLabel: `unit-exercises-${unitIndex + 1}-repair`,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });
  incrementCounters(session, repairResult.totalTokens);

  const repaired = normalizeExercisesMarkdown(repairResult.content);
  const repairCheck = validateUnitExercisesMarkdown(repaired);
  if (repairCheck.pass) return repaired;

  console.warn(
    `[unit-exercises] Unit ${unitIndex + 1} repair still failed validation (${repairCheck.reasons.join('; ')}); using original combined output`,
  );
  return combined;
}
