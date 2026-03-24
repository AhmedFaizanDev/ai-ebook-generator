import { SubtopicContext, SessionState } from '@/lib/types';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildSubtopicPrompt } from '@/prompts/subtopic';
import { buildVisualRetryPrompt } from '@/prompts/subtopic-visual-retry';
import { visualValidator } from './visual-validator';

function buildFallbackMermaidDiagram(ctx: SubtopicContext): string {
  const topic = ctx.subtopicTitle.replace(/"/g, "'");
  const unit = ctx.unitTitle.replace(/"/g, "'");
  return `### Visual Concept Map

\`\`\`mermaid
graph TD
    A["${topic}"] --> B["Key Concepts"]
    A --> C["Methods"]
    B --> D["Applications"]
    C --> D
    D --> E["Outcomes"]
\`\`\`

*Figure: Conceptual flow for ${topic} within ${unit}.*
`;
}

function appendFallbackDiagram(markdown: string, ctx: SubtopicContext): string {
  return `${markdown.trimEnd()}\n\n${buildFallbackMermaidDiagram(ctx)}`;
}

export async function generateSubtopic(
  ctx: SubtopicContext,
  session: SessionState
): Promise<string> {
  const userPrompt = buildSubtopicPrompt(ctx);
  const sectionId = `${ctx.unitIndex + 1}.${ctx.subtopicIndex + 1}`;

  const label = `subtopic U${ctx.unitIndex + 1}/S${ctx.subtopicIndex + 1}`;
  const result = await callLLM({
    model: ctx.model,
    systemPrompt: buildSystemPrompt(session.isTechnical, session.allowCodeBlocks),
    userPrompt,
    maxTokens: 1800,
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

  const validation = visualValidator(markdown);

  if (!validation.pass) {
    try {
      const retryPrompt =
        buildSubtopicPrompt(ctx) +
        '\n\n' +
        buildVisualRetryPrompt(ctx.subtopicTitle, session.isTechnical, session.allowCodeBlocks);

      const retryResult = await callLLM({
        model: ctx.model,
        systemPrompt: buildSystemPrompt(session.isTechnical, session.allowCodeBlocks),
        userPrompt: retryPrompt,
        maxTokens: 1800,
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

      const retryValidation = visualValidator(retryMarkdown);
      if (retryValidation.pass) {
        return retryMarkdown;
      }
      console.warn(`[subtopic] Visual retry produced weak diagram for ${label}; appending fallback diagram.`);
      return appendFallbackDiagram(retryMarkdown, ctx);
    } catch (retryErr) {
      console.warn(`[subtopic] Visual retry failed for ${label}, using original content: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
    }
  }

  if (!validation.pass) {
    console.warn(`[subtopic] Original content has weak/missing visual for ${label}; appending fallback diagram.`);
    return appendFallbackDiagram(markdown, ctx);
  }
  return markdown;
}
