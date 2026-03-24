import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildUnitSummaryCombinePrompt } from '@/prompts/unit-summary-combine';

export async function combineUnitSummary(
  unitTitle: string,
  microSummaries: string[],
  session: SessionState
): Promise<string> {
  const userPrompt = buildUnitSummaryCombinePrompt(unitTitle, microSummaries);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical, session.allowCodeBlocks),
    userPrompt,
    maxTokens: 150,
    temperature: 0.15,
    callLabel: `unit-summary: ${unitTitle}`,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
