import { VisualValidationResult } from '@/lib/types';

const TABLE_RE = /^\|.+\|/m;
const TABLE_SEPARATOR_RE = /^\|[\s:|\-]+\|/m;
const ASCII_DIAGRAM_RE =
  /\+[-+]{3,}\+|\[[\w\s]+\]\s*-{1,2}>\s*\[|\[[\w\s]+\]\s*<-{1,2}\s*\[|[│┌└├┤─]/;

const SUBSECTION_RE =
  /^###\s+(Key Concepts|Process Overview|Diagram|Reference Table)/im;

function hasTableIn(text: string): boolean {
  return TABLE_RE.test(text) && TABLE_SEPARATOR_RE.test(text);
}

function hasAsciiIn(text: string): boolean {
  return ASCII_DIAGRAM_RE.test(text);
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

export function visualValidator(md: string): VisualValidationResult {
  const hasTable = hasTableIn(md);
  const hasAsciiDiagram = hasAsciiIn(md);

  const subsectionBlock = extractSubsectionBlock(md);
  const hasRequiredSubsection = subsectionBlock !== null;

  const visualInSubsection = hasRequiredSubsection
    ? hasTableIn(subsectionBlock!) || hasAsciiIn(subsectionBlock!)
    : false;

  const pass =
    (hasTable || hasAsciiDiagram) && (visualInSubsection || hasTable || hasAsciiDiagram);

  return { hasTable, hasAsciiDiagram, hasRequiredSubsection, pass };
}
