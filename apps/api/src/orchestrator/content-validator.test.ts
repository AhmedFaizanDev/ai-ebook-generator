import { describe, it, expect } from 'vitest';
import { validateContentBlocks, extractContentBlocks, buildExportQualityReport } from './content-validator';
import type { VisualConfig } from '@/lib/types';

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

const allEnabled: VisualConfig = {
  equations: { enabled: true },
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

describe('extractContentBlocks', () => {
  it('extracts mermaid blocks', () => {
    const md = '# Title\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nSome text';
    const blocks = extractContentBlocks(md);
    expect(blocks.filter((b) => b.type === 'mermaid')).toHaveLength(1);
    expect(blocks[0].source).toContain('graph TD');
  });

  it('extracts display math \\[...\\]', () => {
    const md = 'Some text\n\n\\[E = mc^2\\]\n\nMore text';
    const blocks = extractContentBlocks(md);
    expect(blocks.filter((b) => b.type === 'equation-display')).toHaveLength(1);
    expect(blocks[0].source).toContain('E = mc^2');
  });

  it('extracts inline math \\(...\\)', () => {
    const md = 'The value \\(x + y\\) is important.';
    const blocks = extractContentBlocks(md);
    expect(blocks.filter((b) => b.type === 'equation-inline')).toHaveLength(1);
  });

  it('extracts $$...$$ display math', () => {
    const md = '$$\\frac{a}{b}$$';
    const blocks = extractContentBlocks(md);
    expect(blocks.filter((b) => b.type === 'equation-display')).toHaveLength(1);
  });

  it('does not extract math from inside code fences', () => {
    const md = '```python\nprint("\\(x\\)")\n```';
    const blocks = extractContentBlocks(md);
    expect(blocks).toHaveLength(0);
  });
});

describe('validateContentBlocks - mermaid', () => {
  it('passes a valid graph TD diagram', () => {
    const md = '```mermaid\ngraph TD\n  A["Start"] --> B["End"]\n```';
    const result = validateContentBlocks(md, mermaidEnabled);
    expect(result.errors.filter((e) => e.type === 'mermaid')).toHaveLength(0);
  });

  it('fails on empty mermaid block', () => {
    const md = '```mermaid\n\n```';
    const result = validateContentBlocks(md, mermaidEnabled);
    expect(result.errors.some((e) => e.type === 'mermaid' && e.message.includes('Empty'))).toBe(true);
  });

  it('fails on forbidden diagram type', () => {
    const md = '```mermaid\nsequenceDiagram\n  A->>B: Hello\n```';
    const result = validateContentBlocks(md, mermaidEnabled);
    expect(result.errors.some((e) => e.message.includes('forbidden'))).toBe(true);
  });

  it('fails when mermaid is disabled but block is present', () => {
    const md = '```mermaid\ngraph TD\n  A --> B\n```';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.errors.some((e) => e.message.includes('disabled'))).toBe(true);
  });

  it('fails on missing direction', () => {
    const md = '```mermaid\nA --> B\n```';
    const result = validateContentBlocks(md, mermaidEnabled);
    expect(result.errors.some((e) => e.message.includes('graph TD'))).toBe(true);
  });
});

describe('validateContentBlocks - equations', () => {
  it('passes a valid display equation', () => {
    const md = '\\[E = mc^2\\]';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.filter((e) => e.type === 'equation')).toHaveLength(0);
  });

  it('fails on empty equation', () => {
    const md = '\\[\\]';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.type === 'equation' && e.message.includes('Empty'))).toBe(true);
  });

  it('fails on unbalanced braces', () => {
    const md = '\\[\\frac{a}{b\\]';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.message.includes('Unbalanced braces'))).toBe(true);
  });

  it('fails when equations are disabled but math is present', () => {
    const md = '\\(x + y\\)';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.errors.some((e) => e.message.includes('disabled'))).toBe(true);
  });
});

describe('validateContentBlocks - leak detection', () => {
  it('detects unmatched display math delimiters', () => {
    const md = 'Text \\[ E = mc^2 but no closing';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.type === 'markdown-leak' && e.message.includes('Unmatched display'))).toBe(true);
  });

  it('detects unmatched inline math delimiters', () => {
    const md = 'Text \\( x + y but no closing';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.type === 'markdown-leak' && e.message.includes('Unmatched inline'))).toBe(true);
  });

  it('detects unclosed fenced code blocks', () => {
    const md = 'Some text\n```\nThis is inside a fence that never closes';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.pass).toBe(false);
    expect(
      result.errors.some(
        (e) => e.type === 'markdown-leak' && e.message.includes('Unclosed fenced code block'),
      ),
    ).toBe(true);
  });
});

describe('validateContentBlocks - code fences', () => {
  it('fails on empty labeled non-mermaid fence', () => {
    const md = '```python\n\n```';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.errors.some((e) => e.type === 'code-fence' && e.message.includes('Empty'))).toBe(
      true,
    );
  });

  it('allows empty output fence', () => {
    const md = '```output\n\n```';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.errors.filter((e) => e.type === 'code-fence')).toHaveLength(0);
  });
});

describe('validateContentBlocks - quality warnings', () => {
  it('detects AI filler phrases', () => {
    const md = '## 1.1 Topic\n\nIn today\'s rapidly changing landscape, it is important to note that technology evolves.\n\nThis section will explore the fundamentals.';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.qualityWarnings.length).toBeGreaterThan(0);
    expect(result.qualityWarnings.some((w) => w.message.includes('AI-filler'))).toBe(true);
  });

  it('detects repetitive paragraph starters', () => {
    const paragraphs = Array(4).fill('The importance of this concept cannot be overstated. It drives many modern applications in various domains and continues to shape how we think about technology.');
    const md = paragraphs.join('\n\n');
    const result = validateContentBlocks(md, allDisabled);
    expect(result.qualityWarnings.some((w) => w.message.includes('paragraphs start with'))).toBe(true);
  });
});

describe('buildExportQualityReport', () => {
  it('produces a structured report', () => {
    const md = '## 1.1 Topic\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n\\[E = mc^2\\]\n\nSome prose text here.';
    const report = buildExportQualityReport(md, mathEnabled);
    expect(report.timestamp).toBeTruthy();
    expect(typeof report.totalBlocks).toBe('number');
    expect(typeof report.pass).toBe('boolean');
  });
});
