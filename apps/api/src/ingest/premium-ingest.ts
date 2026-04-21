import type { SessionState } from '@/lib/types';

/**
 * Adds professional ebook scaffolding: preface, per-unit learning objectives, and unit recaps.
 * Does not remove or rewrite imported technical content (that is handled by polish when enabled).
 */
export function applyPremiumIngest(session: SessionState): void {
  const structure = session.structure;
  if (!structure) return;

  const displayTitle = structure.title.trim();
  session.prefaceMarkdown = [
    '## How to use this edition',
    '',
    `This ebook edition of **${displayTitle}** is organized into units with clear learning objectives,`,
    'worked-style sections from your source material, and end-of-unit recap tables.',
    '',
    '- **Figures** from the original document are preserved where they were placed in the source.',
    '- **Diagrams** use Mermaid in a few strategic overview spots so the digital layout stays crisp in PDF and Word.',
    '',
    '> Tip: use the table of contents links (in the exported PDF) to jump between units quickly.',
    '',
  ].join('\n');

  const n = structure.units.length;
  while (session.unitIntroductions.length < n) session.unitIntroductions.push(null);
  while (session.unitEndSummaries.length < n) session.unitEndSummaries.push(null);

  for (let u = 0; u < n; u++) {
    const unit = structure.units[u]!;
    const subs = unit.subtopics.filter(Boolean).slice(0, 14);
    const bullets = subs
      .map((t) => `- **${t}**: master the definitions, typical assumptions, and common solution patterns.`)
      .join('\n');

    session.unitIntroductions[u] = [
      `## Learning objectives - Unit ${u + 1}: ${unit.unitTitle}`,
      '',
      'By the end of this unit you should be able to:',
      '',
      bullets || '- Navigate the core material and connect it to the practice problems that follow.',
      '',
    ].join('\n');

    const coreRow = (subs.slice(0, 4).join('; ') || 'Foundational concepts from this unit.').replace(/\|/g, '/');
    session.unitEndSummaries[u] = [
      `## Unit ${u + 1} recap - ${unit.unitTitle}`,
      '',
      '| Theme | What to carry forward |',
      '| --- | --- |',
      `| Core ideas | ${coreRow} |`,
      '| Study approach | Revisit any section where steps felt fast, then rework one representative problem end-to-end. |',
      '',
    ].join('\n');
  }
}

export function looksTechnicalForIngest(title: string, filePath: string): boolean {
  const s = `${title} ${filePath}`.toLowerCase();
  return /math|structural|statics|dynamics|beam|truss|load|moment|shear|deflection|matrix|calculus|algebra|vector|tensor|physics|chemistry|engineering|analysis|mechanics|stress|strain/i.test(
    s,
  );
}
