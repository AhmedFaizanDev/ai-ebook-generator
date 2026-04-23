import { describe, it, expect } from 'vitest';
import { maskIngestForLlm, restoreIngestLlmBlocks } from '@/ingest/ingest-llm-mask';

describe('maskIngestForLlm', () => {
  it('round-trips visuals and display math when includeMath is true', () => {
    const md = `## Sec\n\n$$x^2$$\n\n![](rvimg://a)\n`;
    const { masked, masks } = maskIngestForLlm(md, true);
    expect(masked).toContain('<<<INGEST_MATH_DISP_');
    expect(masked).toContain('<<<INGEST_IMG_');
    const back = restoreIngestLlmBlocks(masked, masks);
    expect(back).toContain('$$x^2$$');
    expect(back).toContain('![](rvimg://a)');
  });

  it('does not mask $ currency when includeMath is true', () => {
    const md = 'Price is $12 and $3.50 today.';
    const { masked, masks } = maskIngestForLlm(md, true);
    expect(masked).toBe(md);
    expect(masks.mathInline).toHaveLength(0);
  });

  it('masks inline math when it looks like math', () => {
    const md = 'Let $\\alpha + \\beta = 1$.';
    const { masked, masks } = maskIngestForLlm(md, true);
    expect(masked).toContain('<<<INGEST_MATH_INLINE_');
    const back = restoreIngestLlmBlocks(masked, masks);
    expect(back).toContain('$\\alpha');
  });
});
