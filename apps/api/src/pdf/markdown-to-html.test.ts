import { describe, it, expect } from 'vitest';
import { segmentsToHtml, markdownToHtml, normalizeLatexForKatex } from './markdown-to-html';
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

describe('normalizeLatexForKatex', () => {
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
});

describe('markdownToHtml', () => {
  it('processes flat markdown with embedded HTML', () => {
    const md = '<div class="cover-page"><h1>Title</h1></div>\n\n## Section\n\nContent.';
    const html = markdownToHtml(md, allDisabled);
    expect(html).toContain('cover-page');
    expect(html).toContain('<h2');
  });
});
