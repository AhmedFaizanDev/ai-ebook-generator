import { SessionState } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildGlossaryPrompt } from '@/prompts/glossary';

export async function generateGlossary(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const unitTitles = structure.units.map((u) => u.unitTitle);

  const userPrompt = buildGlossaryPrompt(session.topic, unitTitles, session.isTechnical);

  const result = await callLLM({
    model: LIGHT_MODEL,
    systemPrompt: buildSystemPrompt(session.isTechnical, session.allowCodeBlocks),
    userPrompt,
    maxTokens: 800,
    temperature: 0.2,
    callLabel: 'glossary',
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });

  incrementCounters(session, result.totalTokens);
  return result.content.trim();
}
