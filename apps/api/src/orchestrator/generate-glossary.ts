import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildGlossaryPrompt } from '@/prompts/glossary';
import { validateContentBlocks } from './content-validator';
import { runWithContentValidationRetries } from './section-enforce';

export async function generateGlossary(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  return runWithContentValidationRetries(
    session,
    'glossary',
    (md) => {
      const r = validateContentBlocks(md, session.visuals);
      return { pass: r.pass, errors: r.errors };
    },
    async ({ repairSuffix }) => {
      const userPrompt =
        buildGlossaryPrompt(session.topic, unitTitles, session.isTechnical, session.outputLanguage) +
        (repairSuffix ?? '');
      const result = await callLLM({
        model: LIGHT_MODEL,
        systemPrompt: buildSystemPrompt(session.isTechnical, session.visuals, session.outputLanguage),
        userPrompt,
        maxTokens: 800,
        temperature: 0.2,
        callLabel: repairSuffix ? 'glossary (validation repair)' : 'glossary',
        bookTitle: session.topic,
        bookIndex: session.batchIndex,
        bookTotal: session.batchTotal,
      });
      incrementCounters(session, result.totalTokens);
      return result.content.trim();
    },
  );
}
