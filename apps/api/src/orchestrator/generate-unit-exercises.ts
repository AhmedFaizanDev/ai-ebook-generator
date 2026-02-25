import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildUnitExercisesPrompt } from '@/prompts/unit-exercises';

export async function generateUnitExercises(
  session: SessionState,
  unitIndex: number,
): Promise<string> {
  const structure = session.structure!;
  const unit = structure.units[unitIndex];
  const unitSummary = session.unitSummaries[unitIndex] ?? '';

  const userPrompt = buildUnitExercisesPrompt(
    session.topic,
    unitIndex,
    unit.unitTitle,
    unit.subtopics,
    unitSummary,
  );

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1500,
    temperature: 0.3,
    callLabel: `unit-exercises-${unitIndex + 1}`,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
