import type { VisualValidationResult, VisualConfig } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { validateContentBlocks } from './content-validator';

/**
 * Subtopic validation: equations only when enabled (see validateContentBlocks).
 * Table/subsection layout checks were removed.
 */
export function visualValidator(md: string, visuals: VisualConfig = DEFAULT_VISUAL_CONFIG): VisualValidationResult {
  const contentResult = validateContentBlocks(md, visuals);
  return {
    hasTable: false,
    hasAsciiDiagram: false,
    hasRequiredSubsection: false,
    pass: contentResult.pass,
    errors: contentResult.errors,
  };
}
