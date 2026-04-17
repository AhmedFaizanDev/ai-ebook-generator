import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildUnitIntroductionPrompt } from '@/prompts/unit-introduction';
import { validateContentBlocks } from './content-validator';
import { runWithContentValidationRetries } from './section-enforce';

export async function generateUnitIntro(
  session: SessionState,
  unitIndex: number,
): Promise<string> {
  const structure = session.structure!;
  const unit = structure.units[unitIndex];
  const label = `unit-intro-${unitIndex + 1}`;

  return runWithContentValidationRetries(
    session,
    label,
    (md) => {
      const r = validateContentBlocks(md, session.visuals);
      return { pass: r.pass, errors: r.errors };
    },
    async ({ repairSuffix }) => {
      const userPrompt =
        buildUnitIntroductionPrompt(
          session.topic,
          unitIndex,
          unit.unitTitle,
          unit.subtopics,
          session.outputLanguage,
        ) +
        (repairSuffix ?? '');
      const result = await callLLM({
        model: LIGHT_MODEL,
        systemPrompt: buildSystemPrompt(session.isTechnical, session.visuals, session.outputLanguage),
        userPrompt,
        maxTokens: 600,
        temperature: 0.3,
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
