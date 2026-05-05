import { describe, it, expect } from 'vitest';
import { validateContentBlocks, extractContentBlocks, buildExportQualityReport } from './content-validator';
import type { VisualConfig } from '@/lib/types';

const mathEnabled: VisualConfig = {
  equations: { enabled: true },
  mermaid: { enabled: false },
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
  it('does not extract mermaid fenced blocks (equation-only extractor)', () => {
    const md = '# Title\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nSome text';
    const blocks = extractContentBlocks(md);
    expect(blocks).toHaveLength(0);
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

describe('validateContentBlocks — equations disabled', () => {
  it('always passes regardless of markdown', () => {
    const md = '\\(x+y\\)\\[a\\]\n```mermaid\nsequenceDiagram\n```';
    const result = validateContentBlocks(md, allDisabled);
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateContentBlocks — equations enabled', () => {
  it('passes a valid display equation', () => {
    const md = '\\[E = mc^2\\]';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.filter((e) => e.type === 'equation')).toHaveLength(0);
    expect(result.pass).toBe(true);
  });

  it('fails on empty equation', () => {
    const md = '\\[\\]';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.message.includes('Empty'))).toBe(true);
  });

  it('fails on unbalanced braces', () => {
    const md = '\\[\\frac{a}{b\\]';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.message.includes('Unbalanced braces'))).toBe(true);
  });

  it('detects unmatched display math delimiters', () => {
    const md = 'Text \\[ E = mc^2 but no closing';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.message.includes('Unmatched display'))).toBe(true);
  });

  it('detects unmatched inline math delimiters', () => {
    const md = 'Text \\( x + y but no closing';
    const result = validateContentBlocks(md, mathEnabled);
    expect(result.errors.some((e) => e.message.includes('Unmatched inline'))).toBe(true);
  });
});

describe('buildExportQualityReport', () => {
  it('produces a structured report', () => {
    const md = '## Topic\n\\[E = mc^2\\]';
    const report = buildExportQualityReport(md, mathEnabled);
    expect(report.timestamp).toBeTruthy();
    expect(typeof report.totalBlocks).toBe('number');
    expect(typeof report.pass).toBe('boolean');
  });
});
