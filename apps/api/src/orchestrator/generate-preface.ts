import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildPrefacePrompt } from '@/prompts/preface';
import { enforceContentAfterGeneration } from './section-enforce';

export async function generatePreface(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  const userPrompt = buildPrefacePrompt(session.topic, unitTitles);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical),
    userPrompt,
    maxTokens: 900,
    temperature: 0.3,
    callLabel: `preface`,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });

  incrementCounters(session, result.totalTokens);
  const md = result.content.trim();
  enforceContentAfterGeneration(session, md, 'preface');
  return md;
}
