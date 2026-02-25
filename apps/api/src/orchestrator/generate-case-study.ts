import { SessionState } from '@/lib/types';
import { CASE_STUDY_COUNT } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildBatchedCaseStudyPrompt, buildCaseStudyPrompt } from '@/prompts/case-study';

function splitBatchedOutput(raw: string, expectedCount: number): string[] | null {
  const parts = raw.split(/\n---\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === expectedCount) return parts;

  const byHeading = raw.split(/(?=^## Case Study \d)/m).map((p) => p.trim()).filter((p) => p.length > 0);
  if (byHeading.length === expectedCount) return byHeading;

  return null;
}

export async function generateCaseStudies(session: SessionState): Promise<string> {
  const structure = session.structure!;

  if (CASE_STUDY_COUNT >= 2) {
    const batchPrompt = buildBatchedCaseStudyPrompt(
      session.topic,
      structure.caseStudyTopics,
      session.unitSummaries
    );

    const batchResult = await callLLM({
      model: session.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: batchPrompt,
      maxTokens: 5000,
      temperature: 0.35,
      timeoutMs: 120_000,
      callLabel: `case-studies batched (${CASE_STUDY_COUNT})`,
    });

    incrementCounters(session, batchResult.totalTokens);

    const parts = splitBatchedOutput(batchResult.content.trim(), CASE_STUDY_COUNT);
    if (parts) {
      const fixed = parts.map((md, i) => {
        if (!md.startsWith('## ')) {
          return `## Case Study ${i + 1}: ${structure.caseStudyTopics[i]}\n\n${md}`;
        }
        return md;
      });
      return '# Case Studies\n\n' + fixed.join('\n\n---\n\n');
    }

    console.warn('[case-studies] Batched output could not be split; falling back to per-item calls');
  }

  const parts: string[] = [];
  for (let i = 0; i < CASE_STUDY_COUNT; i++) {
    const userPrompt = buildCaseStudyPrompt(
      session.topic,
      i,
      structure.caseStudyTopics[i],
      session.unitSummaries
    );

    const result = await callLLM({
      model: session.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2600,
      temperature: 0.35,
      callLabel: `case-study ${i + 1}`,
    });

    incrementCounters(session, result.totalTokens);

    let md = result.content.trim();
    if (!md.startsWith('## ')) {
      md = `## Case Study ${i + 1}: ${structure.caseStudyTopics[i]}\n\n${md}`;
    }
    parts.push(md);
  }

  return '# Case Studies\n\n' + parts.join('\n\n---\n\n');
}
