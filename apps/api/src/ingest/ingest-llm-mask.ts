/**
 * Mask visual + math blocks before LLM calls so models cannot corrupt figures,
 * tables, Mermaid, or LaTeX. Used by tests and any future ingest LLM passes.
 */

export interface VisualMasks {
  imageLines: string[];
  mermaidBlocks: string[];
  tableBlocks: string[];
}

export interface IngestLlmMasks extends VisualMasks {
  mathDisplay: string[];
  mathInline: string[];
}

function transformOutsideCodeFences(md: string, fn: (segment: string) => string): string {
  const lines = md.split('\n');
  const segments: { text: string; isFence: boolean }[] = [];
  let buf: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence) {
      if (trimmed.startsWith('```')) {
        if (buf.length > 0) {
          segments.push({ text: buf.join('\n'), isFence: false });
          buf = [];
        }
        inFence = true;
        buf.push(line);
      } else {
        buf.push(line);
      }
    } else {
      buf.push(line);
      if (trimmed === '```') {
        segments.push({ text: buf.join('\n'), isFence: true });
        buf = [];
        inFence = false;
      }
    }
  }
  if (buf.length > 0) {
    segments.push({ text: buf.join('\n'), isFence: inFence });
  }

  return segments.map((s) => (s.isFence ? s.text : fn(s.text))).join('\n');
}

function isProbablySingleDollarMath(expr: string): boolean {
  const t = expr.trim();
  if (!t) return false;
  if (/^\d+([.,]\d+)*$/.test(t)) return false;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return false;
  if (/\\[a-zA-Z]|[=^_{}]|[+\-*/×÷·⋅]/.test(t)) return true;
  if (/\s/.test(t)) return false;
  return /^[A-Za-z][A-Za-z0-9'’-]*$/.test(t);
}

function maskMathInPlainSegment(seg: string, mathDisplay: string[], mathInline: string[]): string {
  let s = seg;
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (full) => {
    const i = mathDisplay.push(full) - 1;
    return `\n<<<INGEST_MATH_DISP_${i}>>>\n`;
  });
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (full) => {
    const i = mathDisplay.push(full) - 1;
    return `\n<<<INGEST_MATH_DISP_${i}>>>\n`;
  });
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (full) => {
    const i = mathInline.push(full) - 1;
    return `<<<INGEST_MATH_INLINE_${i}>>>`;
  });
  s = s.replace(/(?<!\$)\$(?!\$)\s*((?:\\.|[^$])+?)\s*\$(?!\$)/g, (full, expr: string) => {
    const t = String(expr).trim();
    if (!t || !isProbablySingleDollarMath(t)) return full;
    const i = mathInline.push(full) - 1;
    return `<<<INGEST_MATH_INLINE_${i}>>>`;
  });
  return s;
}

export function maskVisualBlocks(md: string): { masked: string; masks: VisualMasks } {
  const imageLines: string[] = [];
  let masked = md.replace(/^!\[[^\n]*\]\([^)]+\)\s*$/gm, (line) => {
    const i = imageLines.push(line.trimEnd()) - 1;
    return `\n<<<INGEST_IMG_${i}>>>\n`;
  });

  const mermaidBlocks: string[] = [];
  masked = masked.replace(/```mermaid[\s\S]*?```/gi, (block) => {
    const i = mermaidBlocks.push(block.trimEnd()) - 1;
    return `\n<<<INGEST_MERMAID_${i}>>>\n`;
  });

  const tableBlocks: string[] = [];
  masked = masked.replace(/(?:^|\n)((?:\|[^\n]+\|\n?){2,})/g, (_m, block: string) => {
    const i = tableBlocks.push(block.trimEnd()) - 1;
    return `\n<<<INGEST_TABLE_${i}>>>\n`;
  });

  return {
    masked,
    masks: { imageLines, mermaidBlocks, tableBlocks },
  };
}

function restoreVisualBlocksOnly(merged: string, masks: VisualMasks): string {
  let out = merged;
  out = out.replace(/<<<INGEST_TABLE_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.tableBlocks[idx] ?? `<!-- missing table ${idx} -->`;
  });
  out = out.replace(/<<<INGEST_MERMAID_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.mermaidBlocks[idx] ?? `<!-- missing mermaid ${idx} -->`;
  });
  out = out.replace(/<<<INGEST_IMG_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.imageLines[idx] ?? `<!-- missing image ${idx} -->`;
  });
  return out;
}

/**
 * Mask math outside fenced code, then mask images / Mermaid / tables on the full string.
 */
export function maskIngestForLlm(md: string, includeMath: boolean): { masked: string; masks: IngestLlmMasks } {
  const mathDisplay: string[] = [];
  const mathInline: string[] = [];
  const body = includeMath
    ? transformOutsideCodeFences(md, (seg) => maskMathInPlainSegment(seg, mathDisplay, mathInline))
    : md;
  const { masked, masks } = maskVisualBlocks(body);
  return {
    masked,
    masks: {
      ...masks,
      mathDisplay,
      mathInline,
    },
  };
}

function restoreMathBlocks(merged: string, masks: IngestLlmMasks): string {
  let out = merged;
  out = out.replace(/<<<INGEST_MATH_DISP_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.mathDisplay[idx] ?? `<!-- missing math display ${idx} -->`;
  });
  out = out.replace(/<<<INGEST_MATH_INLINE_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.mathInline[idx] ?? `<!-- missing math inline ${idx} -->`;
  });
  return out;
}

/** Restore placeholders after an LLM call (visual first, then math). */
export function restoreIngestLlmBlocks(merged: string, masks: IngestLlmMasks): string {
  const visualOnly: VisualMasks = {
    imageLines: masks.imageLines,
    mermaidBlocks: masks.mermaidBlocks,
    tableBlocks: masks.tableBlocks,
  };
  let out = restoreVisualBlocksOnly(merged, visualOnly);
  out = restoreMathBlocks(out, masks);
  return out.trim();
}
