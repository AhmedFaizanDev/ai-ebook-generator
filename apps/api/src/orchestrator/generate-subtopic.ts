import { SubtopicContext, SessionState } from '@/lib/types';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildSubtopicPrompt } from '@/prompts/subtopic';
import { buildVisualRetryPrompt } from '@/prompts/subtopic-visual-retry';
import { visualValidator } from './visual-validator';

export async function generateSubtopic(
  ctx: SubtopicContext,
  session: SessionState
): Promise<string> {
  const userPrompt = buildSubtopicPrompt(ctx);
  const sectionId = `${ctx.unitIndex + 1}.${ctx.subtopicIndex + 1}`;

  const label = `subtopic U${ctx.unitIndex + 1}/S${ctx.subtopicIndex + 1}`;
  const result = await callLLM({
    model: ctx.model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1800,
    temperature: 0.4,
    callLabel: label,
  });

  incrementCounters(session, result.totalTokens);
  let markdown = result.content;

  if (!markdown.startsWith('## ')) {
    markdown = `## ${sectionId} ${ctx.subtopicTitle}\n\n${markdown}`;
  }

  const validation = visualValidator(markdown);

  if (!validation.pass) {
    try {
      const retryPrompt = buildSubtopicPrompt(ctx) + '\n\n' + buildVisualRetryPrompt(ctx.subtopicTitle);

      const retryResult = await callLLM({
        model: ctx.model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: retryPrompt,
        maxTokens: 1800,
        temperature: 0.4,
        callLabel: `${label} visual-retry`,
      });

      incrementCounters(session, retryResult.totalTokens);
      let retryMarkdown = retryResult.content;

      if (!retryMarkdown.startsWith('## ')) {
        retryMarkdown = `## ${sectionId} ${ctx.subtopicTitle}\n\n${retryMarkdown}`;
      }

      const retryValidation = visualValidator(retryMarkdown);
      if (retryValidation.pass) {
        return retryMarkdown;
      }
    } catch (retryErr) {
      console.warn(`[subtopic] Visual retry failed for ${label}, using original content: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
    }
  }

  return markdown;
}
