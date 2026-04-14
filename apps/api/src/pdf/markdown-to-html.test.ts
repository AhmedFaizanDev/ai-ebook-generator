import { describe, it, expect } from 'vitest';
import {
  segmentsToHtml,
  markdownToHtml,
  normalizeLatexForKatex,
  normalizeUnicodeSubSupToAscii,
  normalizeUnicodeToPdfSafeAscii,
} from './markdown-to-html';
import type { VisualConfig } from '@/lib/types';
import type { ContentSegment } from '@/orchestrator/build-markdown';

const mathEnabled: VisualConfig = {
  equations: { enabled: true },
  mermaid: { enabled: false },
  strictMode: true,
  autoFixAttempts: 1,
};

const mermaidEnabled: VisualConfig = {
  equations: { enabled: false },
  mermaid: { enabled: true },
  strictMode: true,
  autoFixAttempts: 1,
};

const allDisabled: VisualConfig = {
  equations: { enabled: false },
  mermaid: { enabled: false },
  strictMode: true,
  autoFixAttempts: 1,
};

describe('normalizeUnicodeToPdfSafeAscii', () => {
  it('maps Unicode sub/sup digits and signs to ASCII', () => {
    expect(normalizeUnicodeToPdfSafeAscii('H\u2082CO\u2083')).toBe('H2CO3');
    expect(normalizeUnicodeToPdfSafeAscii('HCO\u2083\u207B')).toBe('HCO3-');
    expect(normalizeUnicodeToPdfSafeAscii('NH\u2084\u207A')).toBe('NH4+');
    expect(normalizeUnicodeToPdfSafeAscii('CO\u2082')).toBe('CO2');
    expect(normalizeUnicodeToPdfSafeAscii('x\u00B2 + y\u00B3')).toBe('x2 + y3');
    expect(normalizeUnicodeToPdfSafeAscii('NO\u2082, O\u2083, CH\u2084')).toBe('NO2, O3, CH4');
  });

  it('maps nabla, dot operator, and math italic letters to ASCII', () => {
    expect(normalizeUnicodeToPdfSafeAscii('The \u2207 operator')).toBe('The nabla operator');
    expect(normalizeUnicodeToPdfSafeAscii('a\u22C5b')).toBe('a*b');
    expect(normalizeUnicodeToPdfSafeAscii('\uD835\uDC65')).toBe('x'); // mathematical italic x (U+1D465)
  });

  it('maps logical operators and implication symbols to ASCII-safe forms', () => {
    expect(normalizeUnicodeToPdfSafeAscii('\u00ac(p \u2228 q) \u21D2 \u00acp \u2227 \u00acq')).toBe('not (p  or  q) => not p  and  not q');
    expect(normalizeUnicodeToPdfSafeAscii('p \u2194 q \u2261 (\u00acp \u2228 q)')).toBe('p <=> q == (not p  or  q)');
  });

  it('maps degree and square glyphs to PDF-safe text', () => {
    expect(normalizeUnicodeToPdfSafeAscii('\u0394G\u00B0')).toBe('DeltaG degrees');
    expect(normalizeUnicodeToPdfSafeAscii('A \u25A1 B')).toBe('A . B');
  });

  it('maps physics and chemistry symbols to ASCII-safe forms', () => {
    expect(normalizeUnicodeToPdfSafeAscii('\u03BB = h/p, \u03BC = 3\u00B5A, R = 10\u03A9')).toBe('lambda = h/p, mu = 3muA, R = 10Ohm');
    expect(normalizeUnicodeToPdfSafeAscii('H\u2082 + O\u2082 \u2192 H\u2082O')).toBe('H2 + O2 => H2O');
    expect(normalizeUnicodeToPdfSafeAscii('A \u222a B, A \u2229 B, A \u2282 B')).toBe('A  union  B, A  intersect  B, A  subset of  B');
  });

  it('maps broad Unicode super/subscript variants to ASCII', () => {
    expect(normalizeUnicodeToPdfSafeAscii('x\u207B\u00B9 + y\u207D\u207F\u207A\u00B9\u207E')).toBe('x-1 + y(n+1)');
    expect(normalizeUnicodeToPdfSafeAscii('CO\u2083\u00B2\u207B + a\u208D\u1D62\u2C7C\u208E')).toBe('CO32- + a(ij)');
    expect(normalizeUnicodeToPdfSafeAscii('t\u1D50 and v\u1D5B')).toBe('tm and vv');
  });

  it('alias normalizeUnicodeSubSupToAscii matches full normalizer', () => {
    expect(normalizeUnicodeSubSupToAscii('CO\u2082')).toBe(normalizeUnicodeToPdfSafeAscii('CO\u2082'));
  });
});

describe('normalizeLatexForKatex', () => {
  it('maps Unicode nabla, dot, and subscripts to TeX-safe forms', () => {
    expect(normalizeLatexForKatex('v\u22C5\u2207 C')).toContain('\\nabla');
    expect(normalizeLatexForKatex('D\u2082O')).toContain('_{2}');
  });

  it('maps logical Unicode symbols to TeX operators', () => {
    const normalized = normalizeLatexForKatex('\u00ac(p \u2228 q) \u21D4 (\u00acp \u2227 \u00acq)');
    expect(normalized).toContain('\\neg');
    expect(normalized).toContain('\\lor');
    expect(normalized).toContain('\\land');
    expect(normalized).toContain('\\Leftrightarrow');
  });

  it('maps degree symbol to TeX superscript degree', () => {
    expect(normalizeLatexForKatex('\u0394G\u00B0')).toContain('^{\\circ}');
  });

  it('maps cross-subject Unicode symbols to TeX-safe equivalents', () => {
    const normalized = normalizeLatexForKatex('\u03BB = h/p, \u03BC = 3\u00B5A, R=10\u03A9, A \u2229 B, x \u00B1 y, H\u2082 + O\u2082 \u2192 H\u2082O');
    expect(normalized).toContain('\\lambda');
    expect(normalized).toContain('\\mu');
    expect(normalized).toContain('\\Omega');
    expect(normalized).toContain('\\cap');
    expect(normalized).toContain('\\pm');
    expect(normalized).toContain('\\to');
    expect(normalized).toContain('_{2}');
  });

  it('maps advanced physics symbols to TeX-safe equivalents', () => {
    const normalized = normalizeLatexForKatex('\u210F\u03C9, F \u221D a, l\u2081 \u27C2 l\u2082, \u2220ABC');
    expect(normalized).toContain('\\hbar');
    expect(normalized).toContain('\\omega');
    expect(normalized).toContain('\\propto');
    expect(normalized).toContain('\\perp');
    expect(normalized).toContain('\\angle');
  });

  it('groups superscript/subscript runs into single TeX groups', () => {
    const normalized = normalizeLatexForKatex('x\u207B\u00B9 + y\u207D\u207F\u207A\u00B9\u207E + CO\u2083\u00B2\u207B + a\u208D\u1D62\u2C7C\u208E');
    expect(normalized).toContain('x^{-1}');
    expect(normalized).toContain('y^{(n+1)}');
    expect(normalized).toContain('CO_{3}^{2-}');
    expect(normalized).toContain('a_{(ij)}');
  });

  it('replaces mistaken \\square / \\Box with ASCII mult dot', () => {
    const dot = String.raw`\,.\,`;
    expect(normalizeLatexForKatex(String.raw`\sum_i N_i \square M_i`)).toBe(String.raw`\sum_i N_i ` + dot + String.raw` M_i`);
    expect(normalizeLatexForKatex(String.raw`a \Box b`)).toBe(`a ${dot} b`);
  });

  it('normalizes unicode multiply glyphs (dot → ASCII mult; × → times)', () => {
    const dot = String.raw`\,.\,`;
    expect(normalizeLatexForKatex('a × b')).toBe(String.raw`a \times b`);
    expect(normalizeLatexForKatex('a·b')).toBe(`a${dot}b`);
  });

  it('replaces unicode square/box glyphs with ASCII mult dot', () => {
    const dot = String.raw`\,.\,`;
    expect(normalizeLatexForKatex('V = I\u25A1R')).toBe(`V = I${dot}R`);
  });

  it('replaces explicit \\cdot with ASCII mult dot', () => {
    expect(normalizeLatexForKatex(String.raw`a \cdot b`)).toBe(String.raw`a \,.\, b`);
  });
});

describe('segmentsToHtml - math rendering', () => {
  it('renders display math to KaTeX HTML when enabled', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: 'Text\n\n\\[E = mc^2\\]\n\nMore' }];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).toContain('math-display');
    expect(html).toContain('katex');
    expect(html).not.toContain('\\[E');
  });

  it('renders inline math to KaTeX HTML when enabled', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: 'The value \\(x + y\\) is cool.' }];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).toContain('math-inline');
    expect(html).toContain('katex');
  });

  it('renders multiline inline math spans', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: 'Text \\(x +\ny\\) end' }];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).toContain('math-inline');
    expect(html).toContain('katex');
  });

  it('renders single-dollar inline math and normalizes \\square', () => {
    const segments: ContentSegment[] = [
      { type: 'md', content: String.raw`Ohm's law: $V = I \square R$ as text.` },
    ];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).toContain('math-inline');
    expect(html).toContain('katex');
    expect(html).not.toContain('\\square');
  });

  it('does not ASCII-strip Unicode operators inside $...$ before KaTeX', () => {
    const segments: ContentSegment[] = [
      { type: 'md', content: 'Dot and nabla in inline math: $v\u22C5\u2207 C$.' },
    ];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).toContain('math-inline');
    expect(html).toContain('katex');
    expect(html).not.toContain('v*nabla');
  });

  it('does not treat plain currency as inline math', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: 'Price is $12 and $3.50 today.' }];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).not.toContain('math-inline');
  });

  it('leaves math as-is when equations disabled', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: 'Text \\[E = mc^2\\] end' }];
    const html = segmentsToHtml(segments, allDisabled);
    expect(html).not.toContain('math-display');
  });

  it('does not render math inside code fences', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: '```python\nprint("\\(x\\)")\n```' }];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).not.toContain('math-inline');
    expect(html).toContain('print');
  });

  it('renders \\square misuse as multiplication (cdot) in KaTeX output', () => {
    const segments: ContentSegment[] = [
      { type: 'md', content: String.raw`\[M_n = \frac{\sum_i N_i \square M_i}{\sum_i N_i}\]` },
    ];
    const html = segmentsToHtml(segments, mathEnabled);
    expect(html).toContain('math-display');
    expect(html).toContain('katex');
    expect(html).not.toContain('\\square');
  });
});

describe('segmentsToHtml - mermaid rendering', () => {
  it('normalizes Unicode chemistry in mermaid node labels to ASCII', () => {
    const segments: ContentSegment[] = [
      {
        type: 'md',
        content: '```mermaid\ngraph TD\n  A[Atmospheric CO\u2082] --> B\n```',
      },
    ];
    const html = segmentsToHtml(segments, mermaidEnabled);
    expect(html).toContain('Atmospheric CO2');
    expect(html).not.toContain('CO\u2082');
  });

  it('converts mermaid fences to pre.mermaid placeholders when enabled', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: '```mermaid\ngraph TD\n  A --> B\n```' }];
    const html = segmentsToHtml(segments, mermaidEnabled);
    expect(html).toContain('class="mermaid-container"');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('graph TD');
  });

  it('renders mermaid as code block when disabled', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: '```mermaid\ngraph TD\n  A --> B\n```' }];
    const html = segmentsToHtml(segments, allDisabled);
    expect(html).not.toContain('mermaid-container');
    expect(html).toContain('language-mermaid');
  });
});

describe('segmentsToHtml - raw html segments', () => {
  it('normalizes Unicode chemistry inside html table cells (not only GFM)', () => {
    const segments: ContentSegment[] = [
      { type: 'html', content: '<table><tr><td>NO\u2082</td><td>O\u2083</td></tr></table>' },
    ];
    const html = segmentsToHtml(segments, allDisabled);
    expect(html).toContain('NO2');
    expect(html).toContain('O3');
    expect(html).not.toContain('\u2082');
  });
});

describe('segmentsToHtml - leak repair', () => {
  it('repairs headings leaked into paragraphs', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: '## Heading\n\nParagraph\n## Leaked' }];
    const html = segmentsToHtml(segments, allDisabled);
    expect(html).toContain('<h2');
  });

  it('handles GFM tables correctly', () => {
    const segments: ContentSegment[] = [{ type: 'md', content: '| A | B |\n|---|---|\n| 1 | 2 |' }];
    const html = segmentsToHtml(segments, allDisabled);
    expect(html).toContain('<table>');
    expect(html).toContain('<td');
  });

  it('normalizes Unicode chemistry in table cells to ASCII (no sub/sup tofu)', () => {
    const segments: ContentSegment[] = [
      {
        type: 'md',
        content:
          '| Buffer | Components |\n|---|---|\n| Bicarbonate | H\u2082CO\u2083, HCO\u2083\u207B |\n',
      },
    ];
    const html = segmentsToHtml(segments, allDisabled);
    expect(html).toContain('H2CO3');
    expect(html).toContain('HCO3-');
    expect(html).not.toContain('\u2082');
  });
});

describe('markdownToHtml', () => {
  it('processes flat markdown with embedded HTML', () => {
    const md = '<div class="cover-page"><h1>Title</h1></div>\n\n## Section\n\nContent.';
    const html = markdownToHtml(md, allDisabled);
    expect(html).toContain('cover-page');
    expect(html).toContain('<h2');
  });
});
