import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildUnitEndSummaryPrompt } from '@/prompts/unit-summary-end';

export async function generateUnitEndSummary(
  session: SessionState,
  unitIndex: number,
): Promise<string> {
  const structure = session.structure!;
  const unit = structure.units[unitIndex];
  const micros = session.microSummaries[unitIndex] ?? [];

  const userPrompt = buildUnitEndSummaryPrompt(
    session.topic,
    unitIndex,
    unit.unitTitle,
    unit.subtopics,
    micros,
  );

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 500,
    temperature: 0.2,
    callLabel: `unit-end-summary-${unitIndex + 1}`,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
