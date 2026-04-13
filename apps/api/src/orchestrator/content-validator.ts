import type { VisualConfig, ContentBlockError } from '@/lib/types';

// ── Fence-aware block extraction ──

interface ExtractedBlock {
  type: 'mermaid' | 'equation-display' | 'equation-inline';
  source: string;
  index: number;
}

const FENCE_OPEN_RE = /^```(\S*)/;

/**
 * Walk markdown line-by-line and extract mermaid fenced blocks
 * and math delimiters (outside code fences).
 */
export function extractContentBlocks(md: string): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  const lines = md.split('\n');
  let inFence = false;
  let fenceLang = '';
  let fenceBody: string[] = [];
  let blockIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!inFence) {
      const m = trimmed.match(FENCE_OPEN_RE);
      if (m) {
        inFence = true;
        fenceLang = (m[1] || '').toLowerCase();
        fenceBody = [];
        continue;
      }
    } else {
      if (trimmed === '```') {
        if (fenceLang === 'mermaid') {
          blocks.push({ type: 'mermaid', source: fenceBody.join('\n'), index: blockIdx++ });
        }
        inFence = false;
        fenceLang = '';
        fenceBody = [];
        continue;
      }
      fenceBody.push(lines[i]);
      continue;
    }
  }

  // Unclosed mermaid fence
  if (inFence && fenceLang === 'mermaid') {
    blocks.push({ type: 'mermaid', source: fenceBody.join('\n'), index: blockIdx++ });
  }

  // Extract math outside fences using a second pass on non-fence regions
  const proseParts = extractProseOutsideFences(md);
  const proseText = proseParts.join('\n');

  // Display math: \[...\]
  const displayRe = /\\\[([\s\S]*?)\\\]/g;
  let dm: RegExpExecArray | null;
  while ((dm = displayRe.exec(proseText)) !== null) {
    blocks.push({ type: 'equation-display', source: dm[1], index: blockIdx++ });
  }

  // Display math: $$...$$
  const ddRe = /\$\$([\s\S]*?)\$\$/g;
  let dd: RegExpExecArray | null;
  while ((dd = ddRe.exec(proseText)) !== null) {
    blocks.push({ type: 'equation-display', source: dd[1], index: blockIdx++ });
  }

  // Inline math: \(...\)
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
      if (m) { inFence = true; continue; }
      prose.push(line);
    } else {
      if (trimmed === '```') { inFence = false; }
    }
  }
  return prose;
}

// ── Code fence pairing & non-mermaid bodies ──

function collectUnclosedFenceErrors(md: string): ContentBlockError[] {
  const lines = md.split('\n');
  let inFence = false;
  let startLine = 0;
  let lang = '';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!inFence) {
      const m = trimmed.match(FENCE_OPEN_RE);
      if (m) {
        inFence = true;
        lang = (m[1] || '').toLowerCase();
        startLine = i + 1;
      }
    } else if (trimmed === '```') {
      inFence = false;
      lang = '';
    }
  }

  if (!inFence) return [];
  return [
    {
      type: 'markdown-leak',
      message: `Unclosed fenced code block starting ~line ${startLine}${lang ? ` (lang: ${lang})` : ''}`,
      blockIndex: 1998,
      source: '',
    },
  ];
}

/** Validate each closed fence: non-mermaid labeled blocks must not be empty (except text/output/markdown). */
function collectClosedFenceBodyErrors(md: string): ContentBlockError[] {
  const errors: ContentBlockError[] = [];
  const lines = md.split('\n');
  let inFence = false;
  let lang = '';
  const body: string[] = [];
  let fenceIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!inFence) {
      const m = trimmed.match(FENCE_OPEN_RE);
      if (m) {
        inFence = true;
        lang = (m[1] || '').toLowerCase();
        body.length = 0;
      }
    } else if (trimmed === '```') {
      const bodyStr = body.join('\n');
      if (lang !== 'mermaid') {
        const allowEmpty =
          lang === '' || lang === 'text' || lang === 'output' || lang === 'markdown';
        if (!allowEmpty && bodyStr.trim().length === 0) {
          errors.push({
            type: 'code-fence',
            message: `Empty fenced code block (lang: ${lang})`,
            blockIndex: fenceIdx,
            source: '',
          });
        }
      }
      fenceIdx++;
      inFence = false;
      lang = '';
      body.length = 0;
    } else {
      body.push(lines[i]);
    }
  }

  return errors;
}

// ── Mermaid validation ──

const VALID_DIRECTIONS = /^(graph|flowchart)\s+(TD|TB|BT|LR|RL)\s*$/m;
const ARROW_RE = /-->|--->/;
const MERMAID_FORBIDDEN_TYPES = /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)/m;

function validateMermaidBlock(source: string, idx: number): ContentBlockError | null {
  const trimmed = source.trim();
  if (!trimmed) {
    return { type: 'mermaid', message: 'Empty mermaid block', blockIndex: idx, source };
  }
  if (MERMAID_FORBIDDEN_TYPES.test(trimmed)) {
    return { type: 'mermaid', message: 'Only graph TD/LR flowcharts are allowed; other diagram types are forbidden', blockIndex: idx, source };
  }
  if (!VALID_DIRECTIONS.test(trimmed)) {
    return { type: 'mermaid', message: 'Mermaid block must start with "graph TD", "graph LR", or "flowchart TD/LR"', blockIndex: idx, source };
  }
  if (!ARROW_RE.test(trimmed)) {
    return { type: 'mermaid', message: 'Mermaid diagram has no edges (missing --> arrows)', blockIndex: idx, source };
  }
  const nodeMatches = trimmed.match(/[A-Za-z_]\w*(\[|(\())/g);
  if (!nodeMatches || nodeMatches.length < 2) {
    return { type: 'mermaid', message: 'Mermaid diagram must have at least 2 nodes', blockIndex: idx, source };
  }
  if (nodeMatches.length > 15) {
    return { type: 'mermaid', message: 'Mermaid diagram too large (>15 nodes); keep between 3–10 nodes', blockIndex: idx, source };
  }
  // Check for unquoted labels with special characters
  const unquotedLabel = /\[[^\]"'\[]+[<>&;]+[^\]]*\]/;
  if (unquotedLabel.test(trimmed)) {
    return { type: 'mermaid', message: 'Node labels with special characters must be quoted: A["label"]', blockIndex: idx, source };
  }
  return null;
}

// ── Equation validation ──

function validateEquationBlock(source: string, idx: number, displayMode: boolean): ContentBlockError | null {
  const trimmed = source.trim();
  if (!trimmed) {
    return { type: 'equation', message: `Empty ${displayMode ? 'display' : 'inline'} equation`, blockIndex: idx, source };
  }
  // Check for obviously unbalanced braces
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) {
    return { type: 'equation', message: 'Unbalanced braces in equation', blockIndex: idx, source };
  }
  // Check for stray unescaped delimiters inside the expression
  if (/\\\(/.test(trimmed) || /\\\)/.test(trimmed) || /\\\[/.test(trimmed) || /\\\]/.test(trimmed)) {
    return { type: 'equation', message: 'Nested or stray math delimiters inside equation body', blockIndex: idx, source };
  }
  // Minimal length check — single character equations are suspicious
  if (trimmed.length < 2 && !/^[a-zA-Z0-9]$/.test(trimmed)) {
    return { type: 'equation', message: 'Equation too short or contains only special characters', blockIndex: idx, source };
  }
  return null;
}

// ── Markdown leak detection ──

function detectLeakErrors(md: string): ContentBlockError[] {
  const errors: ContentBlockError[] = [];
  const prose = extractProseOutsideFences(md).join('\n');
  let blockIdx = 1000; // high offset so indices don't collide with block-level ones

  // Unclosed math delimiters
  const openDisplayCount = (prose.match(/\\\[/g) || []).length;
  const closeDisplayCount = (prose.match(/\\\]/g) || []).length;
  if (openDisplayCount !== closeDisplayCount) {
    errors.push({ type: 'markdown-leak', message: `Unmatched display math delimiters: ${openDisplayCount} \\[ vs ${closeDisplayCount} \\]`, blockIndex: blockIdx++, source: '' });
  }

  const openInlineCount = (prose.match(/\\\(/g) || []).length;
  const closeInlineCount = (prose.match(/\\\)/g) || []).length;
  if (openInlineCount !== closeInlineCount) {
    errors.push({ type: 'markdown-leak', message: `Unmatched inline math delimiters: ${openInlineCount} \\( vs ${closeInlineCount} \\)`, blockIndex: blockIdx++, source: '' });
  }

  // Stray $$...$$ used as inline (not block)
  const dollarInline = prose.match(/[^\n]\$\$[^$\n]+\$\$[^\n]/g);
  if (dollarInline && dollarInline.length > 0) {
    errors.push({ type: 'markdown-leak', message: 'Use \\[...\\] for display math instead of $$...$$', blockIndex: blockIdx++, source: dollarInline[0] });
  }

  // Raw table pipes in paragraphs (likely leaked GFM table)
  const leakedTable = /^[^|]*\|[^|]+\|[^|]+\|[^|]*$/m;
  const lines = prose.split('\n');
  for (const line of lines) {
    if (leakedTable.test(line) && !/^\s*\|/.test(line) && line.includes('|')) {
      const pipeCount = (line.match(/\|/g) || []).length;
      if (pipeCount >= 3) {
        errors.push({ type: 'markdown-leak', message: 'Possible leaked table row in paragraph text', blockIndex: blockIdx++, source: line.slice(0, 120) });
        break;
      }
    }
  }

  // Stray fence markers in prose
  if (/^```\S*/m.test(prose)) {
    errors.push({ type: 'markdown-leak', message: 'Unclosed or stray fenced code block marker in prose', blockIndex: blockIdx++, source: '' });
  }

  return errors;
}

// ── Anti-AI quality heuristics ──

const AI_FILLER_PHRASES = [
  /\b(in today'?s (?:rapidly|ever)[- ](?:changing|evolving))\b/i,
  /\b(it is (?:important|crucial|essential|worth noting|noteworthy) (?:to note |that )?)/i,
  /\b(as (?:we|one) (?:can see|have seen|noted|discussed|mentioned))\b/i,
  /\b(this (?:section|chapter|subsection) (?:will|shall) (?:explore|examine|discuss|delve into))\b/i,
  /\b(let us (?:now )?(?:explore|examine|consider|turn (?:our attention|to)))\b/i,
  /\b(in (?:this|the following) (?:section|chapter|subsection),? we (?:will|shall))\b/i,
  /\b(plays a (?:crucial|vital|pivotal|key|important) role)\b/i,
  /\b(it is (?:widely|generally|commonly) (?:accepted|recognized|acknowledged))\b/i,
  /\b(the (?:importance|significance) of .{3,30} cannot be (?:overstated|understated|underestimated))\b/i,
  /\b((?:has|have) gained (?:significant|considerable|widespread) (?:attention|traction|popularity))\b/i,
];

interface QualityWarning {
  type: 'ai-style';
  message: string;
}

function detectAiStyleIssues(md: string): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const prose = extractProseOutsideFences(md).join('\n');

  // Filler phrases
  for (const re of AI_FILLER_PHRASES) {
    const m = prose.match(re);
    if (m) {
      warnings.push({ type: 'ai-style', message: `AI-filler phrase detected: "${m[0]}"` });
    }
  }

  // Repetitive paragraph starters: check first 4 words of consecutive paragraphs
  const paragraphs = prose.split(/\n{2,}/).filter((p) => p.trim().length > 40);
  if (paragraphs.length >= 3) {
    const starters = paragraphs.map((p) => {
      const words = p.trim().split(/\s+/).slice(0, 4).join(' ').toLowerCase();
      return words;
    });
    const counts = new Map<string, number>();
    for (const s of starters) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    for (const [starter, count] of counts) {
      if (count >= 3) {
        warnings.push({ type: 'ai-style', message: `${count} paragraphs start with "${starter}..."` });
      }
    }
  }

  return warnings;
}

// ── Export quality report ──

export interface ExportQualityReport {
  timestamp: string;
  totalBlocks: number;
  validBlocks: number;
  failedBlocks: number;
  leakErrors: number;
  qualityWarnings: QualityWarning[];
  pass: boolean;
  errors: ContentBlockError[];
}

// ── Public API ──

export interface ContentValidationResult {
  pass: boolean;
  errors: ContentBlockError[];
  qualityWarnings: QualityWarning[];
}

/**
 * Validate all mermaid, equation, and structural blocks in markdown
 * according to the book's visual configuration.
 */
export function validateContentBlocks(md: string, visuals: VisualConfig): ContentValidationResult {
  const errors: ContentBlockError[] = [];
  errors.push(...collectUnclosedFenceErrors(md));
  errors.push(...collectClosedFenceBodyErrors(md));

  const blocks = extractContentBlocks(md);

  for (const block of blocks) {
    if (block.type === 'mermaid') {
      if (!visuals.mermaid.enabled) {
        errors.push({ type: 'mermaid', message: 'Mermaid diagram present but mermaid is disabled for this book', blockIndex: block.index, source: block.source.slice(0, 200) });
        continue;
      }
      const err = validateMermaidBlock(block.source, block.index);
      if (err) errors.push(err);
    }

    if (block.type === 'equation-display' || block.type === 'equation-inline') {
      if (!visuals.equations.enabled) {
        errors.push({ type: 'equation', message: 'Math expression present but equations are disabled for this book', blockIndex: block.index, source: block.source.slice(0, 200) });
        continue;
      }
      const err = validateEquationBlock(block.source, block.index, block.type === 'equation-display');
      if (err) errors.push(err);
    }
  }

  // Structural leak detection
  errors.push(...detectLeakErrors(md));

  // Quality warnings (advisory, do not cause hard fail)
  const qualityWarnings = detectAiStyleIssues(md);

  return { pass: errors.length === 0, errors, qualityWarnings };
}

/**
 * Build a structured quality report for an entire book's markdown.
 */
export function buildExportQualityReport(fullMarkdown: string, visuals: VisualConfig): ExportQualityReport {
  const blocks = extractContentBlocks(fullMarkdown);
  const result = validateContentBlocks(fullMarkdown, visuals);
  const leakCount = result.errors.filter((e) => e.type === 'markdown-leak').length;

  return {
    timestamp: new Date().toISOString(),
    totalBlocks: blocks.length,
    validBlocks: blocks.length - result.errors.filter((e) => e.type !== 'markdown-leak').length,
    failedBlocks: result.errors.filter((e) => e.type !== 'markdown-leak').length,
    leakErrors: leakCount,
    qualityWarnings: result.qualityWarnings,
    pass: result.pass,
    errors: result.errors,
  };
}
