import { describe, it, expect } from 'vitest';
import { extractRvimgMarkdownLines } from '@/ingest/source-seed/extract-rvimg-lines';

describe('extractRvimgMarkdownLines', () => {
  it('collects unique rvimg markdown lines in order', () => {
    const md = `x\n\n![a](rvimg://docx-img1)\n![b](rvimg://docx-img2)\n![a](rvimg://docx-img1)\n`;
    expect(extractRvimgMarkdownLines(md, 10)).toEqual(['![a](rvimg://docx-img1)', '![b](rvimg://docx-img2)']);
  });

  it('respects max cap', () => {
    const md = '![1](rvimg://a) ![2](rvimg://b) ![3](rvimg://c)';
    expect(extractRvimgMarkdownLines(md, 2)).toHaveLength(2);
  });
});
