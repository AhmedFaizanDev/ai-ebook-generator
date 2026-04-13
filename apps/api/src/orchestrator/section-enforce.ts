import type { SessionState } from '@/lib/types';
import { validateContentBlocks } from './content-validator';
import { ContentValidationError } from './content-validation-error';

/**
 * Run fence-aware validation (mermaid, math, leaks, code fences) on generated markdown.
 * In strictMode, throws on any error; otherwise logs warnings and continues.
 */
export function enforceContentAfterGeneration(
  session: SessionState,
  markdown: string,
  label: string,
): void {
  const result = validateContentBlocks(markdown, session.visuals);
  if (result.pass) return;

  if (session.visuals.strictMode) {
    throw new ContentValidationError(label, result.errors);
  }

  console.warn(`[content] ${label}: ${result.errors.length} issue(s) (strictMode off; continuing)`);
  for (const e of result.errors) {
    console.warn(`  [${e.type}] ${e.message}`);
  }
}

/**
 * Validates the full document, then each `## ...` section alone (capstones, case studies, etc.)
 * so a bad diagram in one project does not hide behind aggregate passes.
 */
export function enforceContentAggregateAndH2Sections(
  session: SessionState,
  markdown: string,
  label: string,
): void {
  enforceContentAfterGeneration(session, markdown, `${label} (whole)`);

  const chunks = markdown
    .split(/(?=^##\s)/m)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  let h2Index = 0;
  for (const chunk of chunks) {
    if (!chunk.startsWith('##')) continue;
    h2Index++;
    enforceContentAfterGeneration(session, chunk, `${label} (## section ${h2Index})`);
  }
}
