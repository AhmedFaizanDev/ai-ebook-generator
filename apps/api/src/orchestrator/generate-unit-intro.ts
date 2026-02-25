import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildUnitIntroductionPrompt } from '@/prompts/unit-introduction';

export async function generateUnitIntro(
  session: SessionState,
  unitIndex: number,
): Promise<string> {
  const structure = session.structure!;
  const unit = structure.units[unitIndex];

  const userPrompt = buildUnitIntroductionPrompt(
    session.topic,
    unitIndex,
    unit.unitTitle,
    unit.subtopics,
  );

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 600,
    temperature: 0.3,
    callLabel: `unit-intro-${unitIndex + 1}`,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
