import type { VisualConfig, ContentBlockError } from '@/lib/types';

// ── Equation block extraction (outside fenced code regions) ──

interface ExtractedEquationBlock {
  type: 'equation-display' | 'equation-inline';
  source: string;
  index: number;
}

const FENCE_OPEN_RE = /^```(\S*)/;

/**
 * Extract equation blocks only (inline/display delimiters outside ``` fences).
 * Mermaid and other fenced content are ignored for validation.
 */
export function extractContentBlocks(md: string): ExtractedEquationBlock[] {
  const proseText = extractProseOutsideFences(md).join('\n');
  const blocks: ExtractedEquationBlock[] = [];
  let blockIdx = 0;

  const displayRe = /\\\[([\s\S]*?)\\\]/g;
  let dm: RegExpExecArray | null;
  while ((dm = displayRe.exec(proseText)) !== null) {
    blocks.push({ type: 'equation-display', source: dm[1], index: blockIdx++ });
  }

  const ddRe = /\$\$([\s\S]*?)\$\$/g;
  let dd: RegExpExecArray | null;
  while ((dd = ddRe.exec(proseText)) !== null) {
    blocks.push({ type: 'equation-display', source: dd[1], index: blockIdx++ });
  }

  const inlineRe = /\\\((.+?)\\\)/g;
  let im: RegExpExecArray | null;
  while ((im = inlineRe.exec(proseText)) !== null) {
    blocks.push({ type: 'equation-inline', source: im[1], index: blockIdx++ });
  }

  return blocks;
}

function extractProseOutsideFences(md: string): string[] {
  const lines = md.split('\n');
  const prose: string[] = [];
  let inFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence) {
      const m = trimmed.match(FENCE_OPEN_RE);
      if (m) {
        inFence = true;
        continue;
      }
      prose.push(line);
    } else {
      if (trimmed === '```') {
        inFence = false;
      }
    }
  }
  return prose;
}

function validateEquationBlock(source: string, idx: number, displayMode: boolean): ContentBlockError | null {
  const trimmed = source.trim();
  if (!trimmed) {
    return { type: 'equation', message: `Empty ${displayMode ? 'display' : 'inline'} equation`, blockIndex: idx, source };
  }
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) {
    return { type: 'equation', message: 'Unbalanced braces in equation', blockIndex: idx, source };
  }
  if (/\\\(/.test(trimmed) || /\\\)/.test(trimmed) || /\\\[/.test(trimmed) || /\\\]/.test(trimmed)) {
    return { type: 'equation', message: 'Nested or stray math delimiters inside equation body', blockIndex: idx, source };
  }
  if (trimmed.length < 2 && !/^[a-zA-Z0-9]$/.test(trimmed)) {
    return { type: 'equation', message: 'Equation too short or contains only special characters', blockIndex: idx, source };
  }
  return null;
}

function collectEquationDelimiterBalanceErrors(md: string): ContentBlockError[] {
  const prose = extractProseOutsideFences(md).join('\n');
  const errors: ContentBlockError[] = [];
  let blockIdx = 1000;

  const openDisplayCount = (prose.match(/\\\[/g) || []).length;
  const closeDisplayCount = (prose.match(/\\\]/g) || []).length;
  if (openDisplayCount !== closeDisplayCount) {
    errors.push({
      type: 'equation',
      message: `Unmatched display math delimiters: ${openDisplayCount} \\[ vs ${closeDisplayCount} \\]`,
      blockIndex: blockIdx++,
      source: '',
    });
  }

  const openInlineCount = (prose.match(/\\\(/g) || []).length;
  const closeInlineCount = (prose.match(/\\\)/g) || []).length;
  if (openInlineCount !== closeInlineCount) {
    errors.push({
      type: 'equation',
      message: `Unmatched inline math delimiters: ${openInlineCount} \\( vs ${closeInlineCount} \\)`,
      blockIndex: blockIdx++,
      source: '',
    });
  }

  const dollarInline = prose.match(/[^\n]\$\$[^$\n]+\$\$[^\n]/g);
  if (dollarInline && dollarInline.length > 0) {
    errors.push({
      type: 'equation',
      message: 'Use \\[...\\] for display math instead of $$...$$ in paragraph text',
      blockIndex: blockIdx++,
      source: dollarInline[0],
    });
  }

  return errors;
}

export interface ExportQualityReport {
  timestamp: string;
  totalBlocks: number;
  validBlocks: number;
  failedBlocks: number;
  leakErrors: number;
  qualityWarnings: readonly { type: string; message: string }[];
  pass: boolean;
  errors: ContentBlockError[];
}

export interface ContentValidationResult {
  pass: boolean;
  errors: ContentBlockError[];
  qualityWarnings: readonly { type: string; message: string }[];
}

/**
 * When {@link VisualConfig.equations} is enabled: validate delimiter balance and each equation block.
 * When equations are off: no checks (always pass).
 */
export function validateContentBlocks(md: string, visuals: VisualConfig): ContentValidationResult {
  if (!visuals.equations.enabled) {
    return { pass: true, errors: [], qualityWarnings: [] };
  }

  const errors: ContentBlockError[] = [];
  errors.push(...collectEquationDelimiterBalanceErrors(md));

  const blocks = extractContentBlocks(md);
  for (const block of blocks) {
    const err = validateEquationBlock(block.source, block.index, block.type === 'equation-display');
    if (err) errors.push(err);
  }

  return { pass: errors.length === 0, errors, qualityWarnings: [] };
}

export function buildExportQualityReport(fullMarkdown: string, visuals: VisualConfig): ExportQualityReport {
  const blocks = extractContentBlocks(fullMarkdown);
  const result = validateContentBlocks(fullMarkdown, visuals);
  const failedBlocks = result.errors.length;

  return {
    timestamp: new Date().toISOString(),
    totalBlocks: blocks.length,
    validBlocks: Math.max(0, blocks.length - failedBlocks),
    failedBlocks,
    leakErrors: 0,
    qualityWarnings: [],
    pass: result.pass,
    errors: result.errors,
  };
}
