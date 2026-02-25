import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildGlossaryPrompt } from '@/prompts/glossary';

export async function generateGlossary(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  const userPrompt = buildGlossaryPrompt(session.topic, unitTitles);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 800,
    temperature: 0.2,
    callLabel: 'glossary',
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
