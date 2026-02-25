import { SessionState } from '@/lib/types';
import { CAPSTONE_COUNT } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildBatchedCapstonePrompt, buildCapstonePrompt } from '@/prompts/capstone';

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
      session.unitSummaries
    );

    const batchResult = await callLLM({
      model: session.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: batchPrompt,
      maxTokens: 5000,
      temperature: 0.35,
      timeoutMs: 120_000,
      callLabel: `capstones batched (${CAPSTONE_COUNT})`,
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
      return '# Capstone Projects\n\n' + fixed.join('\n\n---\n\n');
    }

    console.warn('[capstones] Batched output could not be split; falling back to per-item calls');
  }

  const parts: string[] = [];
  for (let i = 0; i < CAPSTONE_COUNT; i++) {
    const userPrompt = buildCapstonePrompt(
      session.topic,
      i,
      structure.capstoneTopics[i],
      session.unitSummaries
    );

    const result = await callLLM({
      model: session.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2600,
      temperature: 0.35,
      callLabel: `capstone ${i + 1}`,
    });

    incrementCounters(session, result.totalTokens);

    let md = result.content.trim();
    if (!md.startsWith('## ')) {
      md = `## Capstone Project ${i + 1}: ${structure.capstoneTopics[i]}\n\n${md}`;
    }
    parts.push(md);
  }

  return '# Capstone Projects\n\n' + parts.join('\n\n---\n\n');
}
