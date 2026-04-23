import type { SessionState } from '@/lib/types';
import { getTableReconstructionMode } from '@/ingest/ingest-config';
import { applyVisualFidelityMarkdown } from '@/ingest/visual-fidelity';
import { normalizeIngestMarkdownFormat } from '@/ingest/format-normalize-ingest';
import { rebuildFinalMarkdown } from '@/orchestrator/build-markdown';

/**
 * Deterministic per-section visual fidelity + markdown normalization + rebuild `finalMarkdown`.
 * Safe to call after Phase 1 (no LLM) or after Phase 2 LLM passes.
 */
export function applyDeterministicNormalize(session: SessionState): void {
  const mode = getTableReconstructionMode();
  const extra: string[] = [];

  for (const [key, md] of session.subtopicMarkdowns) {
    const v = applyVisualFidelityMarkdown(md, mode);
    extra.push(...v.warnings);
    const norm = normalizeIngestMarkdownFormat(v.markdown);
    session.subtopicMarkdowns.set(key, norm);
  }

  if (session.ingestSections?.length) {
    for (const sec of session.ingestSections) {
      const v = applyVisualFidelityMarkdown(sec.markdown, mode);
      extra.push(...v.warnings);
      sec.markdown = normalizeIngestMarkdownFormat(v.markdown);
    }
  }

  session.ingestWarnings = [...(session.ingestWarnings ?? []), ...extra];
  session.finalMarkdown = rebuildFinalMarkdown(session);
  session.finalMarkdown = normalizeIngestMarkdownFormat(session.finalMarkdown);
}

/** Alias: same as {@link applyDeterministicNormalize} (used after LLM for naming clarity). */
export function applyIngestDeterministicPostProcess(session: SessionState): void {
  applyDeterministicNormalize(session);
}
