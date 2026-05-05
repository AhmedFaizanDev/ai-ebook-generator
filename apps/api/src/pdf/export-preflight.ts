/**
 * Pre-export HTML audit: unrendered math only (when equations are enabled for the book).
 */
export interface PreflightError {
  type: string;
  message: string;
  sample: string;
}

export function auditExportHtml(html: string): PreflightError[] {
  const errors: PreflightError[] = [];

  const stripped = html
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, '')
    .replace(/<code[^>]*>[\s\S]*?<\/code>/gi, '')
    .replace(/<div class="mermaid-container">[\s\S]*?<\/div>/gi, '');

  const rawDisplayMath = /\\\[[\s\S]{2,}?\\\]/;
  if (rawDisplayMath.test(stripped)) {
    errors.push({
      type: 'math-leak',
      message: 'Unrendered display math \\[...\\] in export HTML',
      sample: (stripped.match(rawDisplayMath)?.[0] ?? '').slice(0, 100),
    });
  }
  const rawInlineMath = /\\\(.+?\\\)/;
  if (rawInlineMath.test(stripped)) {
    errors.push({
      type: 'math-leak',
      message: 'Unrendered inline math \\(...\\) in export HTML',
      sample: (stripped.match(rawInlineMath)?.[0] ?? '').slice(0, 100),
    });
  }
  const rawDollarMath = /\$\$[\s\S]{2,}?\$\$/;
  if (rawDollarMath.test(stripped)) {
    errors.push({ type: 'math-leak', message: 'Unrendered $$...$$ math in export HTML', sample: '' });
  }

  return errors;
}
