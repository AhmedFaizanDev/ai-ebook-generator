/**
 * Pre-export HTML audit: detect raw markdown/math/mermaid that leaked
 * through the rendering pipeline. Returns errors; empty = clean.
 */
export interface PreflightError {
  type: string;
  message: string;
  sample: string;
}

export function auditExportHtml(html: string): PreflightError[] {
  const errors: PreflightError[] = [];

  // Raw fenced code block markers that were not consumed by the renderer
  const rawFence = /<p>\s*```/;
  if (rawFence.test(html)) {
    const m = html.match(rawFence);
    errors.push({ type: 'markdown-leak', message: 'Raw fenced code block marker in paragraph', sample: (m?.[0] ?? '').slice(0, 80) });
  }

  // Unrendered headings inside paragraphs
  if (/<p>\s*#{1,6}\s/.test(html)) {
    errors.push({ type: 'markdown-leak', message: 'Raw markdown heading inside <p>', sample: '' });
  }

  // Unrendered LaTeX math delimiters in text nodes (outside mermaid/code)
  const stripped = html
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, '')
    .replace(/<code[^>]*>[\s\S]*?<\/code>/gi, '')
    .replace(/<div class="mermaid-container">[\s\S]*?<\/div>/gi, '');

  const rawDisplayMath = /\\\[[\s\S]{2,}?\\\]/;
  if (rawDisplayMath.test(stripped)) {
    errors.push({ type: 'math-leak', message: 'Unrendered display math \\[...\\] in export HTML', sample: (stripped.match(rawDisplayMath)?.[0] ?? '').slice(0, 100) });
  }
  const rawInlineMath = /\\\(.+?\\\)/;
  if (rawInlineMath.test(stripped)) {
    errors.push({ type: 'math-leak', message: 'Unrendered inline math \\(...\\) in export HTML', sample: (stripped.match(rawInlineMath)?.[0] ?? '').slice(0, 100) });
  }
  const rawDollarMath = /\$\$[\s\S]{2,}?\$\$/;
  if (rawDollarMath.test(stripped)) {
    errors.push({ type: 'math-leak', message: 'Unrendered $$...$$ math in export HTML', sample: '' });
  }

  // Raw mermaid source text that was not turned into a mermaid-container
  if (/```mermaid/i.test(html) && !/<pre class="mermaid"/.test(html)) {
    errors.push({ type: 'mermaid-leak', message: 'Raw ```mermaid fence not converted to mermaid container', sample: '' });
  }

  return errors;
}
