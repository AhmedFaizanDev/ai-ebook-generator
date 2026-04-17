import { SessionState } from '@/lib/types';
import { CASE_STUDY_COUNT } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildBatchedCaseStudyPrompt, buildCaseStudyPrompt } from '@/prompts/case-study';
import { validateContentBlocks } from './content-validator';
import {
  enforceContentAggregateAndH2Sections,
  isMarkdownFullyValidForSession,
  runWithContentValidationRetries,
} from './section-enforce';
import {
  caseStudyBatchedSplitSource,
  caseStudyH2Line,
  markdownCaseStudyH1,
  type OutputLanguage,
} from '@/lib/output-language';

function splitBatchedOutput(raw: string, expectedCount: number, lang: OutputLanguage): string[] | null {
  const parts = raw.split(/\n---\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === expectedCount) return parts;

  const re = new RegExp(`(?=${caseStudyBatchedSplitSource(lang)})`, 'mu');
  const byHeading = raw.split(re).map((p) => p.trim()).filter((p) => p.length > 0);
  if (byHeading.length === expectedCount) return byHeading;

  return null;
}

export async function generateCaseStudies(session: SessionState): Promise<string> {
  const structure = session.structure!;
  const lang = session.outputLanguage;
  const h1 = markdownCaseStudyH1(lang);

  if (CASE_STUDY_COUNT >= 2) {
    const batchPrompt = buildBatchedCaseStudyPrompt(
      session.topic,
      structure.caseStudyTopics,
      session.unitSummaries,
      session.isTechnical,
      lang,
    );

    const batchResult = await callLLM({
      model: session.model,
      systemPrompt: buildSystemPrompt(session.isTechnical, session.visuals, lang),
      userPrompt: batchPrompt,
      maxTokens: 5000,
      temperature: 0.35,
      callLabel: `case-studies batched (${CASE_STUDY_COUNT})`,
      bookTitle: session.topic,
      bookIndex: session.batchIndex,
      bookTotal: session.batchTotal,
    });

    incrementCounters(session, batchResult.totalTokens);

    const parts = splitBatchedOutput(batchResult.content.trim(), CASE_STUDY_COUNT, lang);
    if (parts) {
      const fixed = parts.map((md, i) => {
        if (!md.startsWith('## ')) {
          return `${caseStudyH2Line(i, structure.caseStudyTopics[i], lang)}\n\n${md}`;
        }
        return md;
      });
      const out = `${h1}\n\n` + fixed.join('\n\n---\n\n');
      if (isMarkdownFullyValidForSession(session, out)) {
        enforceContentAggregateAndH2Sections(session, out, 'case-studies');
        return out;
      }
      console.warn('[case-studies] Batched output failed content validation; falling back to per-item generation');
    } else {
      console.warn('[case-studies] Batched output could not be split; falling back to per-item calls');
    }
  }

  const parts: string[] = [];
  for (let i = 0; i < CASE_STUDY_COUNT; i++) {
    const md = await runWithContentValidationRetries(
      session,
      `case-study ${i + 1}`,
      (m) => {
        const r = validateContentBlocks(m, session.visuals);
        return { pass: r.pass, errors: r.errors };
      },
      async ({ repairSuffix }) => {
        const userPrompt =
          buildCaseStudyPrompt(
            session.topic,
            i,
            structure.caseStudyTopics[i],
            session.unitSummaries,
            session.isTechnical,
            lang,
          ) + (repairSuffix ?? '');
        const result = await callLLM({
          model: session.model,
          systemPrompt: buildSystemPrompt(session.isTechnical, session.visuals, lang),
          userPrompt,
          maxTokens: 2600,
          temperature: 0.35,
          callLabel: repairSuffix ? `case-study ${i + 1} (validation repair)` : `case-study ${i + 1}`,
          bookTitle: session.topic,
          bookIndex: session.batchIndex,
          bookTotal: session.batchTotal,
        });
        incrementCounters(session, result.totalTokens);
        let chunk = result.content.trim();
        if (!chunk.startsWith('## ')) {
          chunk = `${caseStudyH2Line(i, structure.caseStudyTopics[i], lang)}\n\n${chunk}`;
        }
        return chunk;
      },
    );
    parts.push(md);
  }

  const out = `${h1}\n\n` + parts.join('\n\n---\n\n');
  enforceContentAggregateAndH2Sections(session, out, 'case-studies');
  return out;
}
