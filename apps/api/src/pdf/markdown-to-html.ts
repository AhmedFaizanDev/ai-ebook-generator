import { Marked, Tokens } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';
import type { ContentSegment } from '@/orchestrator/build-markdown';
import type { VisualConfig } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';

let highlightCssCache: string | null = null;

export function getHighlightCss(): string {
  if (!highlightCssCache) {
    highlightCssCache = `
.hljs{color:#24292e;background:#f6f8fa}
.hljs-comment,.hljs-quote{color:#6a737d;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-built_in{color:#d73a49}
.hljs-string,.hljs-attr,.hljs-addition{color:#032f62}
.hljs-number,.hljs-literal{color:#005cc5}
.hljs-type,.hljs-template-variable{color:#6f42c1}
.hljs-title,.hljs-section{color:#005cc5;font-weight:bold}
.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#22863a}
.hljs-variable,.hljs-template-tag{color:#e36209}
.hljs-deletion{color:#b31d28;background:#ffeef0}
.hljs-meta{color:#6a737d}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}
`;
  }
  return highlightCssCache;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── KaTeX math rendering ──

/**
 * Multiplication shown as a plain ASCII period with thin math spacing (\\,.\,).
 * Avoids \\cdot / Unicode middle-dot / dot-operator glyphs that can render as boxes in PDFs.
 */
const LATEX_ASCII_MULT = String.raw`\,.\,`;

const UNICODE_SUPERSCRIPT_TO_ASCII: Record<number, string> = {
  0x00b9: '1',
  0x00b2: '2',
  0x00b3: '3',
  0x02b0: 'h',
  0x02b2: 'j',
  0x02b3: 'r',
  0x02b7: 'w',
  0x02b8: 'y',
  0x02e1: 'l',
  0x02e2: 's',
  0x02e3: 'x',
  0x1d2c: 'A',
  0x1d2e: 'B',
  0x1d30: 'D',
  0x1d31: 'E',
  0x1d33: 'G',
  0x1d34: 'H',
  0x1d35: 'I',
  0x1d36: 'J',
  0x1d37: 'K',
  0x1d38: 'L',
  0x1d39: 'M',
  0x1d3a: 'N',
  0x1d3c: 'O',
  0x1d3e: 'P',
  0x1d3f: 'R',
  0x1d40: 'T',
  0x1d41: 'U',
  0x1d42: 'W',
  0x1d43: 'a',
  0x1d47: 'b',
  0x1d48: 'd',
  0x1d49: 'e',
  0x1d4d: 'g',
  0x1d4f: 'k',
  0x1d50: 'm',
  0x1d52: 'o',
  0x1d56: 'p',
  0x1d57: 't',
  0x1d58: 'u',
  0x1d5b: 'v',
  0x1d9c: 'c',
  0x1da0: 'f',
  0x1dbb: 'z',
  0x2c7d: 'V',
  0x2070: '0',
  0x2071: 'i',
  0x2072: 'r',
  0x2073: 'v',
  0x2074: '4',
  0x2075: '5',
  0x2076: '6',
  0x2077: '7',
  0x2078: '8',
  0x2079: '9',
  0x207a: '+',
  0x207b: '-',
  0x207c: '=',
  0x207d: '(',
  0x207e: ')',
  0x207f: 'n',
};

const UNICODE_SUBSCRIPT_TO_ASCII: Record<number, string> = {
  0x2080: '0',
  0x2081: '1',
  0x2082: '2',
  0x2083: '3',
  0x2084: '4',
  0x2085: '5',
  0x2086: '6',
  0x2087: '7',
  0x2088: '8',
  0x2089: '9',
  0x208a: '+',
  0x208b: '-',
  0x208c: '=',
  0x208d: '(',
  0x208e: ')',
  0x2090: 'a',
  0x2091: 'e',
  0x2092: 'o',
  0x2093: 'x',
  0x2094: 'e',
  0x2095: 'h',
  0x2096: 'k',
  0x2097: 'l',
  0x2098: 'm',
  0x2099: 'n',
  0x209a: 'p',
  0x209b: 's',
  0x209c: 't',
  0x1d62: 'i',
  0x2c7c: 'j',
  0x1d63: 'r',
  0x1d64: 'u',
  0x1d65: 'v',
};

function replaceUnicodeScriptRunsWithLatex(
  input: string,
  lookup: Record<number, string>,
  marker: '^' | '_',
): string {
  const chars = [...input];
  let out = '';
  for (let i = 0; i < chars.length;) {
    const cp = chars[i].codePointAt(0)!;
    const mapped = lookup[cp];
    if (mapped === undefined) {
      out += chars[i];
      i++;
      continue;
    }
    let run = '';
    let j = i;
    while (j < chars.length) {
      const nextCp = chars[j].codePointAt(0)!;
      const next = lookup[nextCp];
      if (next === undefined) break;
      run += next;
      j++;
    }
    out += `${marker}{${run}}`;
    i = j;
  }
  return out;
}

const UNICODE_TO_LATEX_MATH: Array<[RegExp, string]> = [
  [/\u2207/g, '\\nabla '],
  [/\u2206/g, '\\Delta '],
  [/\u0394/g, '\\Delta '],
  [/\u03b4/g, '\\delta '],
  [/\u2202/g, '\\partial '],
  [/\u00ac/g, '\\neg '],
  [/\u2227/g, '\\land '],
  [/\u2228/g, '\\lor '],
  [/\u2295/g, '\\oplus '],
  [/\u2297/g, '\\otimes '],
  [/\u2190/g, '\\leftarrow '],
  [/\u2192/g, '\\to '],
  [/\u21d2/g, '\\Rightarrow '],
  [/\u2194/g, '\\leftrightarrow '],
  [/\u21d4/g, '\\Leftrightarrow '],
  [/\u21cc/g, '\\rightleftharpoons '],
  [/\u2261/g, '\\equiv '],
  [/\u2212/g, '-'],
  [/\u00b1/g, '\\pm '],
  [/\u2213/g, '\\mp '],
  [/\u00b0/g, '^{\\circ}'],
  [/\u221e/g, '\\infty '],
  [/\u2264/g, '\\leq '],
  [/\u2265/g, '\\geq '],
  [/\u2260/g, '\\neq '],
  [/\u2248/g, '\\approx '],
  [/\u223c/g, '\\sim '],
  [/\u2243/g, '\\simeq '],
  [/\u2208/g, '\\in '],
  [/\u2209/g, '\\notin '],
  [/\u2205/g, '\\varnothing '],
  [/\u2229/g, '\\cap '],
  [/\u222a/g, '\\cup '],
  [/\u2282/g, '\\subset '],
  [/\u2286/g, '\\subseteq '],
  [/\u2283/g, '\\supset '],
  [/\u2287/g, '\\supseteq '],
  [/\u221a/g, '\\sqrt{}'],
  [/\u222b/g, '\\int '],
  [/\u220f/g, '\\prod '],
  [/\u2211/g, '\\sum '],
  [/\u221d/g, '\\propto '],
  [/\u2220/g, '\\angle '],
  [/\u2225/g, '\\parallel '],
  [/\u27c2|\u22a5/g, '\\perp '],
  [/\u00d7/g, '\\times'],
  [/\u00f7/g, '\\div'],
  [/\u03c0/g, '\\pi '],
  [/\u03b1/g, '\\alpha '],
  [/\u03b2/g, '\\beta '],
  [/\u03b3/g, '\\gamma '],
  [/\u03b5/g, '\\epsilon '],
  [/\u03f5/g, '\\varepsilon '],
  [/\u03b6/g, '\\zeta '],
  [/\u03b7/g, '\\eta '],
  [/\u03b8/g, '\\theta '],
  [/\u03d1/g, '\\vartheta '],
  [/\u03b9/g, '\\iota '],
  [/\u03ba/g, '\\kappa '],
  [/\u03bb/g, '\\lambda '],
  [/\u03bc|\u00b5/g, '\\mu '],
  [/\u03bd/g, '\\nu '],
  [/\u03be/g, '\\xi '],
  [/\u03bf/g, 'o'],
  [/\u03c1/g, '\\rho '],
  [/\u03c3|\u03c2/g, '\\sigma '],
  [/\u03c4/g, '\\tau '],
  [/\u03c5/g, '\\upsilon '],
  [/\u03c6/g, '\\phi '],
  [/\u03d5/g, '\\varphi '],
  [/\u03c7/g, '\\chi '],
  [/\u03c8/g, '\\psi '],
  [/\u03c9/g, '\\omega '],
  [/\u0393/g, '\\Gamma '],
  [/\u0398/g, '\\Theta '],
  [/\u039b/g, '\\Lambda '],
  [/\u039e/g, '\\Xi '],
  [/\u03a0/g, '\\Pi '],
  [/\u03a3/g, '\\Sigma '],
  [/\u03a6/g, '\\Phi '],
  [/\u03a8/g, '\\Psi '],
  [/\u03a9|\u2126/g, '\\Omega '],
  [/\u210f/g, '\\hbar '],
];

/**
 * LLMs often emit \\square / \\Box (amssymb “end of proof” / shape symbols) between factors;
 * Unicode box / middle-dot glyphs can render as tofu. Normalize to a simple math-period.
 */
function normalizeUnicodeOperatorsInLatex(latex: string): string {
  let s = latex;
  for (const [re, replacement] of UNICODE_TO_LATEX_MATH) {
    s = s.replace(re, replacement);
  }

  s = replaceUnicodeScriptRunsWithLatex(s, UNICODE_SUBSCRIPT_TO_ASCII, '_');
  s = replaceUnicodeScriptRunsWithLatex(s, UNICODE_SUPERSCRIPT_TO_ASCII, '^');

  for (let cp = 0x1d434; cp <= 0x1d44d; cp++) {
    const ascii = String.fromCharCode(0x41 + (cp - 0x1d434));
    s = s.split(String.fromCodePoint(cp)).join(ascii);
  }
  for (let cp = 0x1d44e; cp <= 0x1d467; cp++) {
    const ascii = String.fromCharCode(0x61 + (cp - 0x1d44e));
    s = s.split(String.fromCodePoint(cp)).join(ascii);
  }

  return s;
}

export function normalizeLatexForKatex(latex: string): string {
  let s = normalizeUnicodeOperatorsInLatex(latex);
  s = s.replace(/\\square\b/g, LATEX_ASCII_MULT);
  s = s.replace(/\\Box\b/g, LATEX_ASCII_MULT);
  // Unicode box / square glyphs often used (or rendered) as bogus “multiply” or tofu
  s = s.replace(/[\u25A0-\u25A3\u25AA\u25AB\u25FB-\u25FE\u2610\u2611\u2B1C\u2B1D]/g, LATEX_ASCII_MULT);
  s = s.replace(/·|⋅|∙|\u2022/g, LATEX_ASCII_MULT);
  s = s.replace(/×/g, '\\times');
  s = s.replace(/⊗/g, '\\otimes');
  s = s.replace(/÷/g, '\\div');
  s = s.replace(/\\cdot\b/g, LATEX_ASCII_MULT);
  return s;
}

function renderMath(latex: string, displayMode: boolean): string {
  const source = normalizeLatexForKatex(latex.trim());
  if (!source) return '';
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: 'ignore',
    });
  } catch {
    return displayMode ? `\\[${source}\\]` : `\\(${source}\\)`;
  }
}

/**
 * Apply a transform function to text segments that are outside fenced code
 * blocks. This prevents math/mermaid processing from corrupting code samples.
 */
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

  return segments.map((s) => s.isFence ? s.text : fn(s.text)).join('\n');
}

/** Private-use chars to stash TeX math spans while normalizing Unicode chemistry in plain text. */
const MATH_STASH_BASE = 0xe000;

/**
 * Unicode chemistry/math glyphs often have no glyph in PDF body fonts (Georgia/Times) or in Mermaid → tofu boxes.
 * Replace with ASCII letters, digits, and simple punctuation so prose, GFM tables, raw HTML tables, and diagrams stay readable.
 */
export function normalizeUnicodeToPdfSafeAscii(input: string): string {
  let out = '';
  for (const ch of input) {
    const c = ch.codePointAt(0)!;

    const scriptMapped = UNICODE_SUBSCRIPT_TO_ASCII[c] ?? UNICODE_SUPERSCRIPT_TO_ASCII[c];
    if (scriptMapped !== undefined) {
      out += scriptMapped;
      continue;
    }

    // Mathematical italic A–Z / a–z (models paste “𝑥” instead of “x”)
    if (c >= 0x1d434 && c <= 0x1d44d) {
      out += String.fromCharCode(0x41 + (c - 0x1d434));
      continue;
    }
    if (c >= 0x1d44e && c <= 0x1d467) {
      out += String.fromCharCode(0x61 + (c - 0x1d44e));
      continue;
    }

    // Common math operators missing from serif PDF fonts
    if (c === 0x0394) {
      out += 'Delta';
      continue;
    }
    if (c === 0x03b4) {
      out += 'delta';
      continue;
    }
    if (c === 0x03b1) {
      out += 'alpha';
      continue;
    }
    if (c === 0x03b2) {
      out += 'beta';
      continue;
    }
    if (c === 0x03b3) {
      out += 'gamma';
      continue;
    }
    if (c === 0x03bb) {
      out += 'lambda';
      continue;
    }
    if (c === 0x03bc || c === 0x00b5) {
      out += 'mu';
      continue;
    }
    if (c === 0x03c0) {
      out += 'pi';
      continue;
    }
    if (c === 0x03b5 || c === 0x03f5) {
      out += 'epsilon';
      continue;
    }
    if (c === 0x03b6) {
      out += 'zeta';
      continue;
    }
    if (c === 0x03b7) {
      out += 'eta';
      continue;
    }
    if (c === 0x03b8 || c === 0x03d1) {
      out += 'theta';
      continue;
    }
    if (c === 0x03b9) {
      out += 'iota';
      continue;
    }
    if (c === 0x03ba) {
      out += 'kappa';
      continue;
    }
    if (c === 0x03bd) {
      out += 'nu';
      continue;
    }
    if (c === 0x03be) {
      out += 'xi';
      continue;
    }
    if (c === 0x03c1) {
      out += 'rho';
      continue;
    }
    if (c === 0x03c3 || c === 0x03c2) {
      out += 'sigma';
      continue;
    }
    if (c === 0x03c4) {
      out += 'tau';
      continue;
    }
    if (c === 0x03c5) {
      out += 'upsilon';
      continue;
    }
    if (c === 0x03c6 || c === 0x03d5) {
      out += 'phi';
      continue;
    }
    if (c === 0x03c7) {
      out += 'chi';
      continue;
    }
    if (c === 0x03c8) {
      out += 'psi';
      continue;
    }
    if (c === 0x03c9) {
      out += 'omega';
      continue;
    }
    if (c === 0x0393) {
      out += 'Gamma';
      continue;
    }
    if (c === 0x0398) {
      out += 'Theta';
      continue;
    }
    if (c === 0x039b) {
      out += 'Lambda';
      continue;
    }
    if (c === 0x039e) {
      out += 'Xi';
      continue;
    }
    if (c === 0x03a0) {
      out += 'Pi';
      continue;
    }
    if (c === 0x03a3) {
      out += 'Sigma';
      continue;
    }
    if (c === 0x03a6) {
      out += 'Phi';
      continue;
    }
    if (c === 0x03a8) {
      out += 'Psi';
      continue;
    }
    if (c === 0x03a9 || c === 0x2126) {
      out += 'Ohm';
      continue;
    }
    if (c === 0x210f) {
      out += 'hbar';
      continue;
    }
    if (c === 0x2207) {
      out += 'nabla';
      continue;
    }
    if (c === 0x2206) {
      out += 'Delta';
      continue;
    }
    if (c === 0x2202) {
      out += 'partial';
      continue;
    }
    if (c === 0x2212) {
      out += '-';
      continue;
    }
    if (c === 0x00b1) {
      out += '+/-';
      continue;
    }
    if (c === 0x2213) {
      out += '-/+';
      continue;
    }
    if (c === 0x00d7) {
      out += 'x';
      continue;
    }
    if (c === 0x00f7) {
      out += '/';
      continue;
    }
    if (c === 0x2248) {
      out += '~';
      continue;
    }
    if (c === 0x223c || c === 0x2243) {
      out += '~';
      continue;
    }
    if (c === 0x221d) {
      out += ' proportional to ';
      continue;
    }
    if (c === 0x2220) {
      out += ' angle ';
      continue;
    }
    if (c === 0x2225) {
      out += ' parallel ';
      continue;
    }
    if (c === 0x27c2 || c === 0x22a5) {
      out += ' perpendicular ';
      continue;
    }
    if (c === 0x00ac) {
      out += 'not ';
      continue;
    }
    if (c === 0x2227) {
      out += ' and ';
      continue;
    }
    if (c === 0x2228) {
      out += ' or ';
      continue;
    }
    if (c === 0x21d2 || c === 0x2192) {
      out += '=>';
      continue;
    }
    if (c === 0x2190) {
      out += '<-';
      continue;
    }
    if (c === 0x21d4 || c === 0x2194) {
      out += '<=>';
      continue;
    }
    if (c === 0x21cc) {
      out += '<=>';
      continue;
    }
    if (c === 0x2261) {
      out += '==';
      continue;
    }
    if (c === 0x2260) {
      out += '!=';
      continue;
    }
    if (c === 0x2264) {
      out += '<=';
      continue;
    }
    if (c === 0x2265) {
      out += '>=';
      continue;
    }
    if (c === 0x221e) {
      out += 'inf';
      continue;
    }
    if (c === 0x22c5 || c === 0x00b7 || c === 0x2219 || c === 0x2022) {
      out += '*';
      continue;
    }
    if (c === 0x2205) {
      out += 'empty set';
      continue;
    }
    if (c === 0x2229) {
      out += ' intersect ';
      continue;
    }
    if (c === 0x222a) {
      out += ' union ';
      continue;
    }
    if (c === 0x2282) {
      out += ' subset of ';
      continue;
    }
    if (c === 0x2286) {
      out += ' subseteq ';
      continue;
    }
    if (c === 0x2283) {
      out += ' superset of ';
      continue;
    }
    if (c === 0x2287) {
      out += ' superseteq ';
      continue;
    }
    if (c === 0x221a) {
      out += 'sqrt';
      continue;
    }
    if (c === 0x220f) {
      out += 'prod';
      continue;
    }
    if (c >= 0x25a0 && c <= 0x25a3) {
      out += '.';
      continue;
    }
    if (c === 0x00b0) {
      out += ' degrees';
      continue;
    }

    out += ch;
  }
  return out;
}

/** @deprecated alias — behavior is full PDF-safe normalization, not only sub/sup */
export const normalizeUnicodeSubSupToAscii = normalizeUnicodeToPdfSafeAscii;

/** Avoid turning `$12 and $3` into one broken math span (non-greedy stops at first `$`). */
function isProbablySingleDollarMath(expr: string): boolean {
  const t = expr.trim();
  if (!t) return false;
  if (/^\d+([.,]\d+)*$/.test(t)) return false;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return false;
  if (/[\u2080-\u2089\u2070-\u2079\u207A\u207B\u00B9\u00B2\u00B3\u2200-\u22FF\u03B1-\u03C9]/.test(t)) return true;
  if (/[^\x00-\x7F]/.test(t) && /[\\^_{}=]/.test(t)) return true;
  if (/\\[a-zA-Z]|[=^_{}]|[+\-*/×÷·⋅]/.test(t)) return true;
  if (/\s/.test(t)) return false;
  return /^[A-Za-z][A-Za-z0-9'’-]*$/.test(t);
}

/**
 * Normalize Unicode chem glyphs outside math delimiters so TeX / KaTeX input stays intact.
 * When `protectInlineDollarMath` is true, also stashes `$...$` spans that look like inline math.
 */
function normalizeUnicodeChemInPlainMarkdown(segment: string, protectInlineDollarMath: boolean): string {
  const saved: string[] = [];
  const stash = (full: string): string => {
    saved.push(full);
    return String.fromCharCode(MATH_STASH_BASE + saved.length - 1);
  };

  let s = segment.replace(/\$\$[\s\S]*?\$\$/g, stash);
  s = s.replace(/\\\[[\s\S]*?\\\]/g, stash);
  s = s.replace(/\\\([\s\S]*?\\\)/g, stash);

  if (protectInlineDollarMath) {
    s = s.replace(/(?<!\$)\$(?!\$)\s*((?:\\.|[^$])+?)\s*\$(?!\$)/g, (full, expr: string) => {
      const t = expr.trim();
      if (!t || !isProbablySingleDollarMath(t)) return full;
      return stash(full);
    });
  }

  s = normalizeUnicodeToPdfSafeAscii(s);

  for (let i = saved.length - 1; i >= 0; i--) {
    const ph = String.fromCharCode(MATH_STASH_BASE + i);
    s = s.split(ph).join(saved[i]);
  }
  return s;
}

/** Plain `$...$` inline math (models often ignore \\(...\\) rules). Skip obvious currency like `$12`. */
function replaceSingleDollarInlineMath(md: string): string {
  return md.replace(
    /(?<!\$)\$(?!\$)\s*((?:\\.|[^$])+?)\s*\$(?!\$)/g,
    (full, expr: string) => {
      const t = expr.trim();
      if (!t) return full;
      if (!isProbablySingleDollarMath(t)) return full;
      const rendered = renderMath(t, false);
      return rendered ? `<span class="math-inline">${rendered}</span>` : full;
    },
  );
}

function preprocessMath(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;

  return transformOutsideCodeFences(markdown, (segment) => {
    const withDisplay = segment
      .replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr: string) => {
        const rendered = renderMath(expr, true);
        return rendered ? `\n<div class="math-display">${rendered}</div>\n` : '';
      })
      .replace(/\$\$([\s\S]*?)\$\$/g, (_m, expr: string) => {
        const rendered = renderMath(expr, true);
        return rendered ? `\n<div class="math-display">${rendered}</div>\n` : '';
      });

    const withParen = withDisplay.replace(/\\\(([\s\S]+?)\\\)/g, (_m, expr: string) => {
      const rendered = renderMath(expr, false);
      return rendered ? `<span class="math-inline">${rendered}</span>` : '';
    });

    return replaceSingleDollarInlineMath(withParen);
  });
}

// ── Mermaid sanitizer + placeholder ──

function sanitizeMermaidSyntax(raw: string): string {
  return normalizeUnicodeToPdfSafeAscii(raw)
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/\t/g, '    ')
    .trim();
}

// ── Markdown pre-processing ──

/**
 * Ensure fences have blank-line boundaries and fix unclosed fences.
 * Uses line-by-line tracking instead of regex fence counting (which miscounts
 * when ``` appears inside indented blocks or table cells).
 */
function normalizeMarkdownStructure(md: string): string {
  if (!md || typeof md !== 'string') return md;
  let out = md.replace(/\r\n/g, '\n');

  // Blank-line boundaries around fences
  out = out.replace(/([^\n])(```[^\n]*\n)/g, '$1\n$2');
  out = out.replace(/([^\n])\n(```)/g, '$1\n\n$2');
  out = out.replace(/(```)\n([^\n])/g, '$1\n\n$2');

  // Line-by-line fence tracking to find unclosed fences
  const lines = out.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!inFence) {
      if (trimmed.startsWith('```')) {
        inFence = true;
      }
    } else {
      if (trimmed === '```') {
        inFence = false;
      }
    }
  }
  if (inFence) {
    out += '\n```\n';
  }

  // Ensure headings always have blank line before them
  out = out.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  return out;
}

/**
 * Fence-aware stripping of ```html, ```output, and ```html+output pairs.
 * Walks line-by-line so it never eats the closing ``` of a different block.
 */
function stripBannedFences(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return markdown;
  const bannedLangs = /^(html?|output|xml|svg|xhtml)$/i;
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceLang = '';
  let isBanned = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFence) {
      const m = trimmed.match(/^```(\S*)/);
      if (m) {
        inFence = true;
        fenceLang = m[1] || '';
        isBanned = bannedLangs.test(fenceLang);
        if (!isBanned) out.push(line);
      } else {
        out.push(line);
      }
    } else {
      if (trimmed === '```') {
        inFence = false;
        if (!isBanned) out.push(line);
        isBanned = false;
        fenceLang = '';
      } else {
        if (!isBanned) out.push(line);
      }
    }
  }

  return out.join('\n');
}

/**
 * Fix common GFM table issues that prevent marked from recognising them:
 * 1. Missing separator row (|---|---|) after the header row
 * 2. Missing blank line before the table
 * 3. Tab-delimited tables (converted to pipe tables)
 */
function fixGfmTables(md: string): string {
  if (!md || typeof md !== 'string') return md;
  const lines = md.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith('|') && (trimmed.match(/\t/g) || []).length >= 2) {
      const cells = trimmed.split('\t').map((c) => c.trim());
      const pipeLine = '| ' + cells.join(' | ') + ' |';
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const nextIsTabRow = !nextLine.startsWith('|') && (nextLine.match(/\t/g) || []).length >= 2;
      const nextIsPipeRow = nextLine.startsWith('|');
      if (nextIsTabRow || nextIsPipeRow) {
        if (out.length > 0 && out[out.length - 1].trim() !== '') {
          out.push('');
        }
        out.push(pipeLine);
        out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        continue;
      }
      out.push(pipeLine);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const nextIsSep = /^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(nextLine);
      const nextIsPipe = nextLine.startsWith('|') && nextLine.endsWith('|');
      const prevOut = out.length > 0 ? out[out.length - 1].trim() : '';
      const prevIsPipe = prevOut.startsWith('|') && prevOut.endsWith('|');
      const prevIsSep = /^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(prevOut);
      if (nextIsPipe && !nextIsSep && !prevIsPipe && !prevIsSep) {
        const cols = trimmed.split('|').filter((c) => c.trim()).length;
        if (out.length > 0 && out[out.length - 1].trim() !== '' && !out[out.length - 1].trim().startsWith('|')) {
          out.push('');
        }
        out.push(line);
        out.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

// ── Marked instance ──

function createMarkedInstance(visuals: VisualConfig): Marked {
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    renderer: {
      code(token: Tokens.Code): string {
        const { text, lang } = token;
        if (lang) {
          const safeLang = lang.toLowerCase();

          // Mermaid: emit placeholder for Puppeteer to render
          if (safeLang === 'mermaid' && visuals.mermaid.enabled) {
            const cleaned = sanitizeMermaidSyntax(text);
            return `<div class="mermaid-container"><pre class="mermaid">${cleaned}</pre></div>\n`;
          }

          if (safeLang === 'html' || safeLang === 'htm') {
            return `<pre><code class="language-html">${escapeHtml(text)}</code></pre>\n`;
          }
          if (hljs.getLanguage(safeLang)) {
            try {
              const highlighted = hljs.highlight(text, { language: safeLang }).value;
              return `<pre><code class="hljs language-${escapeHtml(safeLang)}">${highlighted}</code></pre>\n`;
            } catch {
              // fall through to plain
            }
          }
          return `<pre><code class="language-${escapeHtml(safeLang)}">${escapeHtml(text)}</code></pre>\n`;
        }
        return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`;
      },

      heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Heading): string {
        const { depth, text } = token;
        const id = text
          .toLowerCase()
          .replace(/<[^>]*>/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          || `heading-${depth}`;
        const content = token.tokens ? this.parser.parseInline(token.tokens) : text;
        return `<h${depth} id="${id}">${content}</h${depth}>\n`;
      },

      table(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Table): string {
        const renderCell = (cell: Tokens.TableCell): string =>
          this.parser.parseInline(cell.tokens);

        let html = '<table>\n<thead>\n<tr>\n';
        for (const cell of token.header) {
          const align = cell.align ? ` style="text-align:${cell.align}"` : '';
          html += `<th${align}>${renderCell(cell)}</th>\n`;
        }
        html += '</tr>\n</thead>\n<tbody>\n';
        for (const row of token.rows) {
          html += '<tr>\n';
          for (const cell of row) {
            const align = cell.align ? ` style="text-align:${cell.align}"` : '';
            html += `<td${align}>${renderCell(cell)}</td>\n`;
          }
          html += '</tr>\n';
        }
        html += '</tbody>\n</table>\n';
        return html;
      },
    },
  });

  return marked;
}

// ── Pre-process a pure-markdown string before feeding to marked ──

function preprocessMarkdown(md: string, visuals: VisualConfig): string {
  let out = normalizeMarkdownStructure(md);
  out = stripBannedFences(out);
  out = fixGfmTables(out);
  out = transformOutsideCodeFences(out, (seg) =>
    normalizeUnicodeChemInPlainMarkdown(seg, visuals.equations.enabled),
  );
  if (visuals.equations.enabled) {
    out = preprocessMath(out);
  }
  return out;
}

// ── Post-render validation ──

function detectRawMarkdownInHtml(html: string): boolean {
  return (
    /<p>\s*```/.test(html) ||
    /<p>\s*#{1,6}\s/.test(html) ||
    /<p>\s*\|[^|]+\|[^|]+\|/.test(html)
  );
}

/**
 * Detect markdown syntax trapped inside <pre><code> blocks.
 * This happens when an unclosed fence swallows subsequent prose.
 * A real code block won't contain ### headings or **bold** patterns.
 */
function detectSwallowedContentInCodeBlocks(html: string): boolean {
  const codeBlockRe = /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi;
  let m: RegExpExecArray | null;
  codeBlockRe.lastIndex = 0;
  while ((m = codeBlockRe.exec(html)) !== null) {
    const content = m[1];
    if (content.length > 500) {
      const hasHeading = /^#{1,6}\s/m.test(content) || /#{1,6}\s/.test(content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      const hasBold = /\*\*[^*]+\*\*/.test(content);
      const hasTable = /\|[^|]+\|[^|]+\|/.test(content);
      if ((hasHeading && hasBold) || (hasHeading && hasTable)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract content trapped in oversized <pre><code> blocks that clearly
 * contain markdown (headings, bold, tables) back out and re-parse them.
 */
function repairSwallowedCodeBlocks(html: string, marked: Marked): string {
  return html.replace(
    /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (full, content: string) => {
      if (content.length < 500) return full;
      const decoded = content
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const hasHeading = /^#{1,6}\s/m.test(decoded);
      const hasBold = /\*\*[^*]+\*\*/.test(decoded);
      const hasTable = /\|[^|]+\|[^|]+\|/.test(decoded);
      if ((hasHeading && hasBold) || (hasHeading && hasTable)) {
        console.warn('[render] Repairing <pre> block that swallowed markdown content');
        return marked.parse(decoded) as string;
      }
      return full;
    },
  );
}

function repairLeakedMarkdown(html: string, marked: Marked): string {
  let repaired = html;

  repaired = repaired.replace(
    /<p>\s*(#{1,6})\s+(.*?)<\/p>/g,
    (_m, hashes: string, text: string) => {
      const level = hashes.length;
      const id = text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `heading-${level}`;
      return `<h${level} id="${id}">${text}</h${level}>`;
    },
  );

  repaired = repaired.replace(
    /<p>(\|[^<]+(?:\n\|[^<]+)+)<\/p>/g,
    (_m, tableBlock: string) => {
      const parsed = marked.parse(tableBlock) as string;
      return parsed.trim();
    },
  );

  repaired = repaired.replace(
    /<p>((?:[^<]|<(?!\/p>))*\*\*[^<]*)<\/p>/g,
    (_m, inner: string) => {
      const decoded = inner.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const parsed = marked.parse(decoded) as string;
      return parsed.trim();
    },
  );

  return repaired;
}

// ── Public API ──

/**
 * Convert structured content segments to HTML. Raw HTML segments are Unicode-normalized for PDF-safe
 * ASCII (same rules as plain markdown outside math delimiters), then passed through; markdown segments are parsed independently by marked. This
 * guarantees that CommonMark HTML-block rules never swallow markdown content.
 *
 * When visuals.equations.enabled is true, LaTeX math is pre-rendered with KaTeX.
 * When visuals.mermaid.enabled is true, ```mermaid blocks become <pre class="mermaid">
 * placeholders for Puppeteer to render.
 */
export function segmentsToHtml(segments: ContentSegment[], visuals: VisualConfig = DEFAULT_VISUAL_CONFIG): string {
  const marked = createMarkedInstance(visuals);
  const htmlParts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'html') {
      htmlParts.push(normalizeUnicodeChemInPlainMarkdown(seg.content, visuals.equations.enabled));
    } else {
      const preprocessed = preprocessMarkdown(seg.content, visuals);
      let rendered = marked.parse(preprocessed) as string;

      if (detectSwallowedContentInCodeBlocks(rendered)) {
        console.warn('[render] Content swallowed by code block — repairing');
        rendered = repairSwallowedCodeBlocks(rendered, marked);
      }

      if (detectRawMarkdownInHtml(rendered)) {
        console.warn('[render] Raw markdown detected in segment — applying repair pass');
        rendered = repairLeakedMarkdown(rendered, marked);
      }

      htmlParts.push(rendered);
    }
  }

  return htmlParts.join('\n');
}

/**
 * Legacy: convert a flat markdown string (with embedded raw HTML) to HTML.
 * Used when only session.finalMarkdown is available (no segments).
 *
 * Splits the string into raw-HTML and markdown regions using a state machine,
 * then parses each markdown region independently.
 */
export function markdownToHtml(markdown: string, visuals: VisualConfig = DEFAULT_VISUAL_CONFIG): string {
  const segments = splitFlatMarkdownIntoSegments(markdown);
  return segmentsToHtml(segments, visuals);
}

/**
 * State-machine that splits a flat markdown string (with embedded raw HTML
 * blocks) into typed segments. Tracks <div> nesting depth so nested divs
 * (cover-page, copyright-page, toc) are treated as single HTML blocks.
 */
function splitFlatMarkdownIntoSegments(md: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = md.split('\n');
  let inHtml = false;
  let depth = 0;
  let htmlBuf: string[] = [];
  let mdBuf: string[] = [];

  const flushMd = () => {
    if (mdBuf.length > 0) {
      const text = mdBuf.join('\n').trim();
      if (text) segments.push({ type: 'md', content: text });
      mdBuf = [];
    }
  };

  const flushHtml = () => {
    if (htmlBuf.length > 0) {
      segments.push({ type: 'html', content: htmlBuf.join('\n') });
      htmlBuf = [];
    }
  };

  for (const line of lines) {
    if (!inHtml) {
      if (/^\s*<(?:div|hr)\b[^>]*\/>\s*$/i.test(line)) {
        flushMd();
        segments.push({ type: 'html', content: line });
        continue;
      }
      if (/^\s*<div[\s>]/i.test(line)) {
        flushMd();
        inHtml = true;
        depth = 0;
        htmlBuf = [];
      }
    }

    if (inHtml) {
      htmlBuf.push(line);
      const opens = (line.match(/<div[\s>]/gi) || []).length;
      const closes = (line.match(/<\/div\s*>/gi) || []).length;
      depth += opens - closes;
      if (depth <= 0) {
        flushHtml();
        inHtml = false;
        depth = 0;
      }
    } else {
      mdBuf.push(line);
    }
  }

  if (htmlBuf.length > 0) {
    flushHtml();
  }
  flushMd();

  return segments;
}
