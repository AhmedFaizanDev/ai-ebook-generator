import type { SessionState } from '@/lib/types';
import { isPremiumFullScaffolding } from '@/ingest/ingest-config';

/**
 * Optional ebook scaffolding: by default (minimal) only ensures arrays exist.
 * Set `INGEST_PREMIUM_FULL=1` for legacy preface, per-unit section lists, and recap blocks.
 */
export function applyPremiumIngest(session: SessionState): void {
  const structure = session.structure;
  if (!structure) return;

  const n = structure.units.length;
  while (session.unitIntroductions.length < n) session.unitIntroductions.push(null);
  while (session.unitEndSummaries.length < n) session.unitEndSummaries.push(null);

  if (!isPremiumFullScaffolding()) {
    session.prefaceMarkdown = null;
    for (let u = 0; u < n; u++) {
      session.unitIntroductions[u] = null;
      session.unitEndSummaries[u] = null;
    }
    return;
  }

  const displayTitle = structure.title.trim();
  session.prefaceMarkdown = [
    '## About this edition',
    '',
    `**${displayTitle}** follows the headings and order from your source file. Figures and tables stay where they appeared in the import.`,
    '',
    'Use the PDF table of contents (clickable links) to move between chapters.',
    '',
  ].join('\n');

  for (let u = 0; u < n; u++) {
    const unit = structure.units[u]!;
    const subs = unit.subtopics.filter(Boolean).slice(0, 14);
    const bullets = subs.map((t) => `- ${t}`).join('\n');

    session.unitIntroductions[u] = [
      `## Part ${u + 1} — ${unit.unitTitle}`,
      '',
      'Sections in this unit:',
      '',
      bullets || '- (see body below)',
      '',
    ].join('\n');

    const recapLines = subs.slice(0, 10).map((t) => `- ${t}`);
    session.unitEndSummaries[u] = [
      `## Part ${u + 1} recap — ${unit.unitTitle}`,
      '',
      'Section checklist:',
      '',
      recapLines.join('\n') || '- Review the unit body above.',
      '',
    ].join('\n');
  }
}

export function looksTechnicalForIngest(title: string, filePath: string): boolean {
  const s = `${title} ${filePath}`.toLowerCase();
  return /math|structural|statics|dynamics|beam|truss|load|moment|shear|deflection|matrix|calculus|algebra|vector|tensor|physics|chemistry|engineering|analysis|mechanics|stress|strain|hydraulic|hydrology|irrigation|evapotranspiration|penman|monteith|manning|weir|canal|catchment|flood|crop|agricult|soil\s+moisture|water\s+balance|pipeline|water\s+supply|reservoir|distribution\s+system|treatment\s+plant|flow\s+rate|final\s+year|thesis|dissertation|design\s+project/i.test(
    s,
  );
}
