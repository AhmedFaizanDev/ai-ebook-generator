import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildUnitExercisesPrompt } from '@/prompts/unit-exercises';

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

  let combined = (block1 + '\n\n' + block2).trim();
  // Ensure Option A is never on the same line as the question: force newline before A)
  combined = combined.replace(/([.?])\s*A\)/g, '$1\n\nA)');
  return combined;
}
