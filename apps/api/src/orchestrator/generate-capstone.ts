import { SessionState } from '@/lib/types';
import { CAPSTONE_COUNT } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { buildSystemPrompt } from '@/prompts/system';
import { buildBatchedCapstonePrompt, buildCapstonePrompt } from '@/prompts/capstone';
import { validateContentBlocks } from './content-validator';
import {
  enforceContentAggregateAndH2Sections,
  isMarkdownFullyValidForSession,
  runWithContentValidationRetries,
} from './section-enforce';

function splitBatchedOutput(raw: string, expectedCount: number): string[] | null {
  const parts = raw.split(/\n---\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === expectedCount) return parts;

  const byHeading = raw.split(/(?=^## Capstone Project \d)/m).map((p) => p.trim()).filter((p) => p.length > 0);
  if (byHeading.length === expectedCount) return byHeading;

  return null;
}

export async function generateCapstones(session: SessionState): Promise<string> {
  const structure = session.structure!;

  if (CAPSTONE_COUNT >= 2) {
    const batchPrompt = buildBatchedCapstonePrompt(
      session.topic,
      structure.capstoneTopics,
      session.unitSummaries,
      session.isTechnical,
    );

    const batchResult = await callLLM({
      model: session.model,
      systemPrompt: buildSystemPrompt(session.isTechnical),
      userPrompt: batchPrompt,
      maxTokens: 5000,
      temperature: 0.35,
      callLabel: `capstones batched (${CAPSTONE_COUNT})`,
      bookTitle: session.topic,
      bookIndex: session.batchIndex,
      bookTotal: session.batchTotal,
    });

    incrementCounters(session, batchResult.totalTokens);

    const parts = splitBatchedOutput(batchResult.content.trim(), CAPSTONE_COUNT);
    if (parts) {
      const fixed = parts.map((md, i) => {
        if (!md.startsWith('## ')) {
          return `## Capstone Project ${i + 1}: ${structure.capstoneTopics[i]}\n\n${md}`;
        }
        return md;
      });
      const out = '# Capstone Projects\n\n' + fixed.join('\n\n---\n\n');
      if (isMarkdownFullyValidForSession(session, out)) {
        enforceContentAggregateAndH2Sections(session, out, 'capstones');
        return out;
      }
      console.warn('[capstones] Batched output failed content validation; falling back to per-item generation');
    } else {
      console.warn('[capstones] Batched output could not be split; falling back to per-item calls');
    }
  }

  const parts: string[] = [];
  for (let i = 0; i < CAPSTONE_COUNT; i++) {
    const md = await runWithContentValidationRetries(
      session,
      `capstone ${i + 1}`,
      (m) => {
        const r = validateContentBlocks(m, session.visuals);
        return { pass: r.pass, errors: r.errors };
      },
      async ({ repairSuffix }) => {
        const userPrompt =
          buildCapstonePrompt(
            session.topic,
            i,
            structure.capstoneTopics[i],
            session.unitSummaries,
            session.isTechnical,
          ) + (repairSuffix ?? '');
        const result = await callLLM({
          model: session.model,
          systemPrompt: buildSystemPrompt(session.isTechnical),
          userPrompt,
          maxTokens: 2600,
          temperature: 0.35,
          callLabel: repairSuffix ? `capstone ${i + 1} (validation repair)` : `capstone ${i + 1}`,
          bookTitle: session.topic,
          bookIndex: session.batchIndex,
          bookTotal: session.batchTotal,
        });
        incrementCounters(session, result.totalTokens);
        let chunk = result.content.trim();
        if (!chunk.startsWith('## ')) {
          chunk = `## Capstone Project ${i + 1}: ${structure.capstoneTopics[i]}\n\n${chunk}`;
        }
        return chunk;
      },
    );
    parts.push(md);
  }

  const out = '# Capstone Projects\n\n' + parts.join('\n\n---\n\n');
  enforceContentAggregateAndH2Sections(session, out, 'capstones');
  return out;
}
