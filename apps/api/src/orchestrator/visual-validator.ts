import type { VisualValidationResult, VisualConfig, ContentBlockError } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { validateContentBlocks } from './content-validator';

const TABLE_RE = /^\|.+\|/m;
const TABLE_SEPARATOR_RE = /^\|[\s:|\-]+\|/m;

const SUBSECTION_RE =
  /^###\s+(Key Concepts|Process Overview|Diagram|Reference Table)/im;

function hasTableIn(text: string): boolean {
  return TABLE_RE.test(text) && TABLE_SEPARATOR_RE.test(text);
}

/**
 * Extracts the content block following the first matching ### subsection
 * (Key Concepts / Process Overview / Diagram / Reference Table) up to the
 * next heading of equal or higher level, or end-of-string.
 */
function extractSubsectionBlock(md: string): string | null {
  const match = md.match(SUBSECTION_RE);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const rest = md.slice(start);
  const nextHeading = rest.search(/^#{1,3}\s/m);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

export function visualValidator(md: string, visuals: VisualConfig = DEFAULT_VISUAL_CONFIG): VisualValidationResult {
  const hasTable = hasTableIn(md);

  const subsectionBlock = extractSubsectionBlock(md);
  const hasRequiredSubsection = subsectionBlock !== null;

  const visualInSubsection = hasRequiredSubsection
    ? hasTableIn(subsectionBlock!)
    : false;

  const tablePass = hasTable && (hasRequiredSubsection ? visualInSubsection : true);

  const contentResult = validateContentBlocks(md, visuals);
  const allErrors: ContentBlockError[] = [...contentResult.errors];

  if (!hasTable) {
    allErrors.push({
      type: 'markdown-leak',
      blockIndex: 0,
      source: '',
      message:
        'Include a GitHub-flavored markdown pipe table with a header row and a separator line (e.g. | Col A | Col B | then |---|---|).',
    });
  } else if (hasRequiredSubsection && !visualInSubsection) {
    allErrors.push({
      type: 'markdown-leak',
      blockIndex: 0,
      source: '',
      message:
        'Place the pipe table under ### Key Concepts, ### Process Overview, ### Diagram, or ### Reference Table (not only in the opening prose).',
    });
  }

  const pass = tablePass && contentResult.pass;

  return { hasTable, hasAsciiDiagram: false, hasRequiredSubsection, pass, errors: allErrors };
}
