import type { TableReconstructionMode } from '@/ingest/ingest-config';

function rowCellCount(line: string): number | null {
  const t = line.trim();
  if (!t || !t.includes('|')) return null;
  if (!/^\|/.test(t)) return null;
  const inner = t.replace(/^\|/, '').replace(/\|\s*$/, '');
  if (!inner) return 0;
  return inner.split('|').length;
}

function isSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!/^\|/.test(t)) return false;
  const inner = t.replace(/^\|/, '').replace(/\|\s*$/, '');
  if (!inner.includes('|')) return /^:?-{3,}:?$/.test(inner.trim());
  const parts = inner.split('|').map((p) => p.trim());
  return parts.length > 0 && parts.every((p) => /^:?-{3,}:?$/.test(p));
}

export interface VisualFidelityResult {
  markdown: string;
  warnings: string[];
}

/**
 * Confidence-gated pipe tables: malformed GFM (ragged columns) is replaced with
 * readable plain text so exports never ship broken tables. `always` keeps well-formed
 * tables only; `never` flattens any non-trivial ambiguous block (still keeps valid tables).
 */
export function applyVisualFidelityMarkdown(markdown: string, mode: TableReconstructionMode): VisualFidelityResult {
  const warnings: string[] = [];
  if (!markdown?.trim()) return { markdown, warnings };

  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const cc = rowCellCount(line);
    if (cc !== null && cc >= 1) {
      const blockStart = i;
      const block: string[] = [line];
      i += 1;
      while (i < lines.length) {
        const L = lines[i]!;
        if (L.trim() === '') break;
        const c2 = rowCellCount(L);
        if (c2 === null && !isSeparatorRow(L)) break;
        block.push(L);
        i += 1;
      }
      const { kept, replaced } = processTableBlock(block, mode, warnings);
      if (replaced) {
        out.push(...kept);
      } else {
        out.push(...block);
      }
      if (i < lines.length && lines[i]!.trim() === '') {
        out.push(lines[i]!);
        i += 1;
      }
      void blockStart;
      continue;
    }
    out.push(line);
    i += 1;
  }

  return { markdown: out.join('\n'), warnings };
}

function processTableBlock(
  block: string[],
  mode: TableReconstructionMode,
  warnings: string[],
): { kept: string[]; replaced: boolean } {
  const rows = block.filter((l) => l.trim().length > 0);
  if (rows.length < 2) return { kept: block, replaced: false };

  const counts = rows.map((r) => (isSeparatorRow(r) ? null : rowCellCount(r))).filter((x): x is number => x !== null);
  if (counts.length === 0) return { kept: block, replaced: false };
  const first = counts[0]!;
  const aligned = counts.every((c) => c === first);
  const highConfidence = aligned && first >= 2 && rows.length >= 2;

  if (mode === 'never') {
    if (highConfidence) return { kept: block, replaced: false };
    warnings.push('[visual-fidelity] Flattened low-confidence pipe table block (INGEST_TABLE_RECONSTRUCTION=never).');
    return { kept: flattenTableBlock(block), replaced: true };
  }

  if (mode === 'confidence') {
    if (highConfidence) return { kept: block, replaced: false };
    warnings.push('[visual-fidelity] Replaced malformed / low-confidence GFM table with plain-text rows.');
    return { kept: flattenTableBlock(block), replaced: true };
  }

  // always: keep if aligned at all
  if (aligned && first >= 1) return { kept: block, replaced: false };
  warnings.push('[visual-fidelity] Replaced inconsistent pipe table with plain-text rows (always mode).');
  return { kept: flattenTableBlock(block), replaced: true };
}

function flattenTableBlock(block: string[]): string[] {
  const out: string[] = ['', '_Table (source layout preserved as text — columns were inconsistent):_', ''];
  for (const line of block) {
    if (isSeparatorRow(line)) continue;
    const t = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '');
    const cells = t.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length) out.push(`- ${cells.join(' · ')}`);
    else out.push('');
  }
  out.push('');
  return out;
}
