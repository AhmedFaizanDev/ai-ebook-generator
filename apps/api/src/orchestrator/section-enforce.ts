import type { ContentBlockError, SessionState } from '@/lib/types';
import { validateContentBlocks } from './content-validator';
import { ContentValidationError } from './content-validation-error';

export type SectionContentGate = (markdown: string) => { pass: boolean; errors: ContentBlockError[] };

const REPAIR_PREAMBLE =
  'The previous output failed automated validation. Regenerate the same section and fix every issue below. Do not explain the fixes; output only the corrected markdown.\n\nIssues:\n';

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
  validate: SectionContentGate,
  generate: (ctx: { attempt: number; repairSuffix: string | null }) => Promise<string>,
): Promise<string> {
  const maxAttempts = Math.max(1, 1 + Math.max(0, session.visuals.autoFixAttempts));
  let lastErrors: ContentBlockError[] = [];
  let lastMd = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const repairSuffix =
      attempt === 1
        ? null
        : `\n\n---\n${REPAIR_PREAMBLE}${formatContentErrorsForRepairPrompt(lastErrors)}\n---\n`;

    const md = (await generate({ attempt, repairSuffix })).trim();
    lastMd = md;

    const { pass, errors } = validate(md);
    if (pass) return md;

    lastErrors = errors;
    console.warn(
      `[content] ${label}: validation failed (${errors.length} issue(s)), attempt ${attempt}/${maxAttempts}`,
    );

    if (attempt === maxAttempts) {
      if (session.visuals.strictMode) {
        throw new ContentValidationError(label, errors);
      }
      console.warn(`[content] ${label}: strictMode off — keeping last output despite validation failures`);
      return lastMd;
    }
  }

  return lastMd;
}

/** True when the whole markdown and each top-level `## ...` chunk pass fence-aware validation. */
export function isMarkdownFullyValidForSession(session: SessionState, markdown: string): boolean {
  const whole = validateContentBlocks(markdown, session.visuals);
  if (!whole.pass) return false;

  const chunks = markdown
    .split(/(?=^##\s)/m)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  for (const chunk of chunks) {
    if (!chunk.startsWith('##')) continue;
    const r = validateContentBlocks(chunk, session.visuals);
    if (!r.pass) return false;
  }
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
