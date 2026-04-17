import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildUnitSummaryCombinePrompt } from '@/prompts/unit-summary-combine';
import { validateContentBlocks } from './content-validator';
import { runWithContentValidationRetries } from './section-enforce';

export async function combineUnitSummary(
  unitTitle: string,
  microSummaries: string[],
  session: SessionState
): Promise<string> {
  const label = `unit-summary-combine: ${unitTitle}`;

  return runWithContentValidationRetries(
    session,
    label,
    (md) => {
      const r = validateContentBlocks(md, session.visuals);
      return { pass: r.pass, errors: r.errors };
    },
    async ({ repairSuffix }) => {
      const userPrompt =
        buildUnitSummaryCombinePrompt(unitTitle, microSummaries, session.outputLanguage) + (repairSuffix ?? '');
      const result = await callLLM({
        model: LIGHT_MODEL,
        systemPrompt: buildSystemPrompt(session.isTechnical, session.visuals, session.outputLanguage),
        userPrompt,
        maxTokens: 150,
        temperature: 0.15,
        callLabel: repairSuffix ? `${label} (validation repair)` : `unit-summary: ${unitTitle}`,
        bookTitle: session.topic,
        bookIndex: session.batchIndex,
        bookTotal: session.batchTotal,
      });
      incrementCounters(session, result.totalTokens);
      return result.content.trim();
    },
  );
}
