/**
 * Deterministic, source-order-preserving markdown cleanup before HTML/PDF export.
 */

import { applyConservativeUnicodeMath } from '@/ingest/conservative-math';

/** Join words split across lines with a hyphen (PDF line breaks). */
function mergeHyphenatedLineBreaks(s: string): string {
  let t = s.replace(/([A-Za-zÀ-ÖØ-öøÿ])-\n([a-zA-ZÀ-ÖØ-öøÿ])/g, '$1$2');
  t = t.replace(/([A-Za-zÀ-ÖØ-öøÿ])\u00AD([a-zA-ZÀ-ÖØ-öøÿ])/g, '$1$2');
  t = t.replace(/([A-Za-zÀ-ÖØ-öøÿ])\u00AD\n([a-zA-ZÀ-ÖØ-öøÿ])/g, '$1$2');
  return t;
}

/**
 * Merge a paragraph split mid-sentence (short continuation line starting lowercase).
 * Skips markdown structures (headings, lists, fences, blockquotes).
 */
function mergeSoftParagraphBreaks(s: string): string {
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  let buf = '';

  const isStructural = (ln: string) => {
    const t = ln.trim();
    return (
      !t ||
      /^#{1,6}\s/.test(t) ||
      /^[-*+]\s/.test(t) ||
      /^\d+\.\s/.test(t) ||
      t.startsWith('```') ||
      t.startsWith('>') ||
      t.startsWith('|') ||
      /^<[a-z]/i.test(t)
    );
  };

  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };

  for (const line of lines) {
    if (isStructural(line)) {
      flush();
      out.push(line);
      continue;
    }
    if (!buf) {
      buf = line;
      continue;
    }
    const bt = buf.trimEnd();
    const lt = line.trim();
    const endsMid = /[^.!?:;)\]]\s*$/.test(bt);
    const startsLower = /^[a-z(`"']/.test(lt);
    if (endsMid && startsLower && bt.length < 500 && lt.length < 500 && !/\$/.test(bt) && !/\$/.test(lt)) {
      buf = `${bt} ${lt}`;
    } else {
      flush();
      buf = line;
    }
  }
  flush();
  return out.join('\n');
}

function normalizeSpaces(s: string): string {
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n');
}

/** Common unit spellings from Word (ASCII) → Unicode for print. */
function normalizeEngineeringUnitGlyphs(s: string): string {
  let t = s;
  t = t.replace(/(?<![A-Za-z0-9])m3\/s(?![A-Za-z0-9])/gi, 'm³/s');
  t = t.replace(/(?<![A-Za-z0-9])m2\/s(?![A-Za-z0-9])/gi, 'm²/s');
  t = t.replace(/(?<![A-Za-z0-9])km2(?![A-Za-z0-9])/gi, 'km²');
  t = t.replace(/(?<![A-Za-z0-9])Km2(?![A-Za-z0-9])/g, 'km²');
  return t;
}

function normalizeEscapedNoise(s: string): string {
  let out = s;
  // Common DOCX/Pandoc escape artifacts visible in output text.
  out = out.replace(/\\\./g, '.');
  out = out.replace(/\\:/g, ':');
  out = out.replace(/\bREFERANCE\b/gi, 'REFERENCES');
  out = out.replace(/\bCOLLAGE OF ENGINEERING\b/gi, 'College of Engineering');
  // Collapse over-emphasis like ****Heading**** -> **Heading**
  out = out.replace(/\*{4,}([^*\n][\s\S]*?[^*\n])\*{4,}/g, '**$1**');
  // Remove list/heading bullets that became "- •" or "- -" noise.
  out = out.replace(/^\s*[-*]\s+[•·▪◦]\s+/gm, '- ');
  out = out.replace(/^\s*[-*]\s+[-*]\s+/gm, '- ');
  return out;
}

/** Ensure blank line before ATX headings when missing (except start of doc). */
function spacingAroundHeadings(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = out[out.length - 1];
    if (/^#{1,6}\s+\S/.test(line) && prev !== undefined && prev.trim() !== '' && !/^#{1,6}\s/.test(prev)) {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Trim trailing spaces per line; collapse 3+ blank lines to 2. */
export function normalizeIngestMarkdownFormat(md: string): string {
  if (!md) return md;
  let s = md.replace(/[ \t]+$/gm, '');
  s = s
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n');
  s = normalizeEscapedNoise(s);
  s = normalizeEngineeringUnitGlyphs(s);
  s = spacingAroundHeadings(s);
  s = normalizeSpaces(s);
  s = mergeHyphenatedLineBreaks(s);
  s = mergeSoftParagraphBreaks(s);
  // Caption-ish line directly after image: ensure single blank between
  s = s.replace(/(\]\([^)]+\))\n([*_][^*\n]+[*_]\s*$)/gm, '$1\n\n$2');
  if (process.env.INGEST_UNICODE_MATH_WRAP === '1') {
    s = applyConservativeUnicodeMath(s);
  }
  return s.trimEnd() + (s.endsWith('\n') ? '\n' : '');
}
