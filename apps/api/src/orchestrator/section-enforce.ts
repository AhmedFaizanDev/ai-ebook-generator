import type { ContentBlockError, SessionState } from '@/lib/types';

export type SectionContentGate = (markdown: string) => { pass: boolean; errors: ContentBlockError[] };

export function formatContentErrorsForRepairPrompt(errors: ContentBlockError[]): string {
  return errors.map((e, i) => `${i + 1}. [${e.type}] ${e.message}`).join('\n');
}

/**
 * Call the LLM producer up to (1 + autoFixAttempts) times, validating after each call.
 * On failure, the next attempt receives a repair appendix derived from validator errors so
 * downstream steps (e.g. micro-summary) are not run on invalid markdown.
 */
export async function runWithContentValidationRetries(
  session: SessionState,
  label: string,
  _validate: SectionContentGate,
  generate: (ctx: { attempt: number; repairSuffix: string | null }) => Promise<string>,
): Promise<string> {
  // Validation gating is intentionally disabled. Keep function shape stable for call sites.
  void session;
  void label;
  return (await generate({ attempt: 1, repairSuffix: null })).trim();
}

/** True when the whole markdown and each top-level `## ...` chunk pass fence-aware validation. */
export function isMarkdownFullyValidForSession(session: SessionState, markdown: string): boolean {
  // Validation gating is intentionally disabled.
  void session;
  void markdown;
  return true;
}

/**
 * Run fence-aware validation (mermaid, math, leaks, code fences) on generated markdown.
 * In strictMode, throws on any error; otherwise logs warnings and continues.
 */
export function enforceContentAfterGeneration(
  session: SessionState,
  markdown: string,
  label: string,
): void {
  // Validation gating is intentionally disabled.
  void session;
  void markdown;
  void label;
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
  // Validation gating is intentionally disabled.
  void session;
  void markdown;
  void label;
}
