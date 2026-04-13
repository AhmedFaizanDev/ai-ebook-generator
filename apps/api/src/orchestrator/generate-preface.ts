import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildPrefacePrompt } from '@/prompts/preface';
import { validateContentBlocks } from './content-validator';
import { runWithContentValidationRetries } from './section-enforce';

export async function generatePreface(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  return runWithContentValidationRetries(
    session,
    'preface',
    (md) => {
      const r = validateContentBlocks(md, session.visuals);
      return { pass: r.pass, errors: r.errors };
    },
    async ({ repairSuffix }) => {
      const userPrompt = buildPrefacePrompt(session.topic, unitTitles) + (repairSuffix ?? '');
      const result = await callLLM({
        model: LIGHT_MODEL,
        systemPrompt: buildSystemPrompt(session.isTechnical),
        userPrompt,
        maxTokens: 900,
        temperature: 0.3,
        callLabel: repairSuffix ? 'preface (validation repair)' : 'preface',
        bookTitle: session.topic,
        bookIndex: session.batchIndex,
        bookTotal: session.batchTotal,
      });
      incrementCounters(session, result.totalTokens);
      return result.content.trim();
    },
  );
}
