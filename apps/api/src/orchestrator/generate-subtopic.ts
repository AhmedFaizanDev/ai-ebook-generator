import { SubtopicContext, SessionState } from '@/lib/types';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildSubtopicPrompt } from '@/prompts/subtopic';
import { buildVisualRetryPrompt } from '@/prompts/subtopic-visual-retry';
import { visualValidator } from './visual-validator';
import { runWithContentValidationRetries } from './section-enforce';

export { ContentValidationError } from './content-validation-error';

export async function generateSubtopic(
  ctx: SubtopicContext,
  session: SessionState,
): Promise<string> {
  const visuals = session.visuals;
  const sectionId = `${ctx.unitIndex + 1}.${ctx.subtopicIndex + 1}`;
  const label = `subtopic U${ctx.unitIndex + 1}/S${ctx.subtopicIndex + 1}`;

  return runWithContentValidationRetries(
    session,
    label,
    (md) => {
      const v = visualValidator(md, visuals);
      return { pass: v.pass, errors: v.errors };
    },
    async ({ repairSuffix }) => {
      let userPrompt = buildSubtopicPrompt(ctx);
      if (repairSuffix) {
        userPrompt +=
          '\n\n' +
          buildVisualRetryPrompt(ctx.subtopicTitle, session.isTechnical, visuals, [], session.outputLanguage) +
          repairSuffix;
      }

      const result = await callLLM({
        model: ctx.model,
        systemPrompt: buildSystemPrompt(session.isTechnical, visuals, session.outputLanguage),
        userPrompt,
        maxTokens: 1800,
        temperature: 0.4,
        callLabel: repairSuffix ? `${label} (validation repair)` : label,
        bookTitle: session.topic,
        bookIndex: session.batchIndex,
        bookTotal: session.batchTotal,
      });

      incrementCounters(session, result.totalTokens);
      let markdown = result.content;
      if (!markdown.startsWith('## ')) {
        markdown = `## ${sectionId} ${ctx.subtopicTitle}\n\n${markdown}`;
      }
      return markdown;
    },
  );
}
