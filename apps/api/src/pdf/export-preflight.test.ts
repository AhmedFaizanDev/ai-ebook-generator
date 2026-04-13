import { describe, it, expect } from 'vitest';
import { auditExportHtml } from './export-preflight';

describe('auditExportHtml', () => {
  it('returns no errors for clean HTML', () => {
    const html = '<h1>Chapter</h1><p>Text</p><table><tr><td>A</td></tr></table>';
    expect(auditExportHtml(html)).toHaveLength(0);
  });

  it('detects raw fenced code block markers in paragraphs', () => {
    const html = '<p>```python</p><p>print("hello")</p>';
    const errors = auditExportHtml(html);
    expect(errors.some((e) => e.type === 'markdown-leak')).toBe(true);
  });

  it('detects raw markdown headings in paragraphs', () => {
    const html = '<p>## This is a heading</p>';
    const errors = auditExportHtml(html);
    expect(errors.some((e) => e.type === 'markdown-leak')).toBe(true);
  });

  it('detects unrendered display math', () => {
    const html = '<p>Some text \\[E = mc^2\\] more text</p>';
    const errors = auditExportHtml(html);
    expect(errors.some((e) => e.type === 'math-leak')).toBe(true);
  });

  it('detects unrendered inline math', () => {
    const html = '<p>The value \\(x + y\\) is important.</p>';
    const errors = auditExportHtml(html);
    expect(errors.some((e) => e.type === 'math-leak')).toBe(true);
  });

  it('detects unrendered $$...$$ math', () => {
    const html = '<p>$$\\frac{a}{b}$$</p>';
    const errors = auditExportHtml(html);
    expect(errors.some((e) => e.type === 'math-leak')).toBe(true);
  });

  it('does not flag math inside mermaid containers', () => {
    const html = '<div class="mermaid-container"><pre class="mermaid">graph TD\nA["\\(x\\)"] --> B</pre></div>';
    const errors = auditExportHtml(html);
    expect(errors.filter((e) => e.type === 'math-leak')).toHaveLength(0);
  });

  it('does not flag rendered KaTeX output', () => {
    const html = '<div class="math-display"><span class="katex">rendered</span></div><p>Normal text</p>';
    expect(auditExportHtml(html)).toHaveLength(0);
  });

  it('detects raw mermaid fence not converted to container', () => {
    const html = '<pre><code class="language-mermaid">```mermaid\ngraph TD\nA-->B</code></pre>';
    const errors = auditExportHtml(html);
    expect(errors.some((e) => e.type === 'mermaid-leak')).toBe(true);
  });
});
