import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildPrefacePrompt } from '@/prompts/preface';

export async function generatePreface(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  const userPrompt = buildPrefacePrompt(session.topic, unitTitles);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 900,
    temperature: 0.3,
    callLabel: `preface`,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
