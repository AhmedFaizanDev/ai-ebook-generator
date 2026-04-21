import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '@/ingest/html-to-markdown';

describe('htmlToMarkdown', () => {
  it('converts headings and images', () => {
    const md = htmlToMarkdown('<h1>Title</h1><p>Hello</p><img src="data:image/png;base64,xx" alt="fig"/>');
    expect(md).toContain('# Title');
    expect(md).toContain('Hello');
    expect(md).toContain('![fig](data:image/png;base64,xx)');
  });
});
