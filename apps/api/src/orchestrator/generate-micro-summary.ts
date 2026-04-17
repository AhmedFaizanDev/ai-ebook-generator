import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildMicroSummaryPrompt } from '@/prompts/micro-summary';
import { validateContentBlocks } from './content-validator';
import { runWithContentValidationRetries } from './section-enforce';

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
  const label = `micro-summary: ${subtopicTitle}`;

  return runWithContentValidationRetries(
    session,
    label,
    (md) => {
      const r = validateContentBlocks(md, session.visuals);
      return { pass: r.pass, errors: r.errors };
    },
    async ({ repairSuffix }) => {
      const userPrompt = buildMicroSummaryPrompt(subtopicTitle, excerpt, session.outputLanguage) + (repairSuffix ?? '');
      const result = await callLLM({
        model: LIGHT_MODEL,
        systemPrompt: buildSystemPrompt(session.isTechnical, session.visuals, session.outputLanguage),
        userPrompt,
        maxTokens: 100,
        temperature: 0.1,
        callLabel: repairSuffix ? `${label} (validation repair)` : label,
        bookTitle: session.topic,
        bookIndex: session.batchIndex,
        bookTotal: session.batchTotal,
      });
      incrementCounters(session, result.totalTokens);
      return result.content.trim();
    },
  );
}
