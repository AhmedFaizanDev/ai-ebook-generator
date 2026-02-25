import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildUnitSummaryCombinePrompt } from '@/prompts/unit-summary-combine';

export async function combineUnitSummary(
  unitTitle: string,
  microSummaries: string[],
  session: SessionState
): Promise<string> {
  const userPrompt = buildUnitSummaryCombinePrompt(unitTitle, microSummaries);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 150,
    temperature: 0.15,
    callLabel: `unit-summary: ${unitTitle}`,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
