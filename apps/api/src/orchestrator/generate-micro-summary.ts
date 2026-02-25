import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildMicroSummaryPrompt } from '@/prompts/micro-summary';

function truncateToTokenEstimate(text: string, targetTokens: number): string {
  const charEstimate = targetTokens * 4;
  if (text.length <= charEstimate) return text;
  return text.slice(0, charEstimate) + '...';
}

export async function generateMicroSummary(
  subtopicTitle: string,
  subtopicMarkdown: string,
  session: SessionState
): Promise<string> {
  const excerpt = truncateToTokenEstimate(subtopicMarkdown, 250);
  const userPrompt = buildMicroSummaryPrompt(subtopicTitle, excerpt);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 100,
    temperature: 0.1,
    callLabel: `micro-summary: ${subtopicTitle}`,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
