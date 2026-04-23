import { UNIT_COUNT, SUBTOPICS_PER_UNIT } from '@/lib/config';
import type { SourceSeed } from '@/ingest/source-seed/types';
import { buildStructurePrompt } from '@/prompts/structure';

/** Append source slot hints so JSON titles align with imported document themes. */
export function buildStructurePromptWithSourceSeed(
  topic: string,
  isTechnical: boolean,
  seed: SourceSeed,
): string {
  const base = buildStructurePrompt(topic, isTechnical);
  const chunks: string[] = [];
  for (let u = 0; u < UNIT_COUNT; u++) {
    const lines: string[] = [];
    for (let s = 0; s < SUBTOPICS_PER_UNIT; s++) {
      const slot = seed.slots[u * SUBTOPICS_PER_UNIT + s]!;
      const heads = slot.sourceHeadingRefs.slice(0, 4).join(' | ') || '—';
      const snip = slot.summary.replace(/\s+/g, ' ').slice(0, 220);
      lines.push(`    Subtopic ${s + 1}: [${heads}] ${snip}${slot.summary.length > 220 ? '…' : ''}`);
    }
    chunks.push(`Unit ${u + 1} (map subtopic titles to these source anchors):\n${lines.join('\n')}`);
  }
  const kw = seed.brief.globalKeywords.slice(0, 28).join(', ');
  return `${base}

Imported source constraints:
- The book must read as grounded in this document, not a generic textbook on another topic.
- Each unitTitle and each of its ${SUBTOPICS_PER_UNIT} subtopic strings should paraphrase or condense themes from the corresponding slot below (same unit order).
- Do not invent unrelated domains. Capstone/case study strings may extend the same domain.
- Source PDF/DOCX figures are carried as Markdown \`![](rvimg://…)\` lines per subtopic; choose titles that naturally support those visuals (methods, results, maps, data plots).

Slot outline (use for titling only; do not paste verbatim into JSON as the only content):
${chunks.join('\n\n')}

Global keywords (optional weave): ${kw || '(none)'}
`;
}
