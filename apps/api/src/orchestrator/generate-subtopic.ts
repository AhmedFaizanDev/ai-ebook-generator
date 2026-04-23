import { SubtopicContext, SessionState } from '@/lib/types';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildSubtopicPrompt } from '@/prompts/subtopic';
import { buildVisualRetryPrompt } from '@/prompts/subtopic-visual-retry';
import { visualValidator } from './visual-validator';
import { ContentValidationError } from './content-validation-error';

export { ContentValidationError } from './content-validation-error';

export async function generateSubtopic(
  ctx: SubtopicContext,
  session: SessionState
): Promise<string> {
  const visuals = session.visuals;
  const userPrompt = buildSubtopicPrompt(ctx);
  const sectionId = `${ctx.unitIndex + 1}.${ctx.subtopicIndex + 1}`;

  const label = `subtopic U${ctx.unitIndex + 1}/S${ctx.subtopicIndex + 1}`;
  const imgN = ctx.sourceSlot?.imageLines?.length ?? 0;
  const eqN = ctx.sourceSlot?.equations?.length ?? 0;
  const maxTokens = imgN > 0 || eqN > 12 ? 2400 : 1800;
  const result = await callLLM({
    model: ctx.model,
    systemPrompt: buildSystemPrompt(session.isTechnical, visuals),
    userPrompt,
    maxTokens,
    temperature: 0.4,
    callLabel: label,
    bookTitle: session.topic,
    bookIndex: session.batchIndex,
    bookTotal: session.batchTotal,
  });

  incrementCounters(session, result.totalTokens);
  let markdown = result.content;

  if (!markdown.startsWith('## ')) {
    markdown = `## ${sectionId} ${ctx.subtopicTitle}\n\n${markdown}`;
  }

  const validation = visualValidator(markdown, visuals);

  if (!validation.pass) {
    const hasContentErrors = validation.errors.length > 0;
    console.warn(`[subtopic] Validation failed for ${label} (${validation.errors.length} content errors, table=${validation.hasTable}). Attempting auto-fix retry...`);

    try {
      const retryPrompt = buildSubtopicPrompt(ctx) + '\n\n' + buildVisualRetryPrompt(ctx.subtopicTitle, session.isTechnical, visuals, validation.errors);

      const retryResult = await callLLM({
        model: ctx.model,
        systemPrompt: buildSystemPrompt(session.isTechnical, visuals),
        userPrompt: retryPrompt,
        maxTokens,
        temperature: 0.4,
        callLabel: `${label} visual-retry`,
        bookTitle: session.topic,
        bookIndex: session.batchIndex,
        bookTotal: session.batchTotal,
      });

      incrementCounters(session, retryResult.totalTokens);
      let retryMarkdown = retryResult.content;

      if (!retryMarkdown.startsWith('## ')) {
        retryMarkdown = `## ${sectionId} ${ctx.subtopicTitle}\n\n${retryMarkdown}`;
      }

      const retryValidation = visualValidator(retryMarkdown, visuals);
      if (retryValidation.pass) {
        return retryMarkdown;
      }

      // Hard-fail when strict mode is on and there are content-level errors after retry
      if (visuals.strictMode && retryValidation.errors.length > 0) {
        throw new ContentValidationError(label, retryValidation.errors);
      }
    } catch (retryErr) {
      if (retryErr instanceof ContentValidationError) throw retryErr;
      console.warn(`[subtopic] Visual retry error for ${label}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
    }

    // Hard-fail on content errors in strict mode even if retry threw a non-validation error
    if (visuals.strictMode && hasContentErrors) {
      throw new ContentValidationError(label, validation.errors);
    }
  }

  return markdown;
}
