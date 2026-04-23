import { describe, it, expect, afterEach } from 'vitest';
import { applyOptionalFinalMarkdownWordTrim } from '@/orchestrator/final-markdown-trim';

describe('applyOptionalFinalMarkdownWordTrim', () => {
  afterEach(() => {
    delete process.env.ORCH_FINAL_TRIM_MAX_WORDS;
  });

  it('returns input unchanged when env unset', () => {
    const md = 'a b c\n\nd e f';
    expect(applyOptionalFinalMarkdownWordTrim(md)).toBe(md);
  });

  it('keeps full markdown when under cap', () => {
    process.env.ORCH_FINAL_TRIM_MAX_WORDS = '6000';
    const md = 'a b c\n\nd e f';
    expect(applyOptionalFinalMarkdownWordTrim(md)).toBe(md);
  });

  it('drops tail paragraphs and annotates when over cap', () => {
    process.env.ORCH_FINAL_TRIM_MAX_WORDS = '4000';
    const para = (n: number) => Array.from({ length: n }, () => 'tok').join(' ');
    const md = `${para(2500)}\n\nSECOND_BLOCK_ONLY ${para(2500)}`;
    const out = applyOptionalFinalMarkdownWordTrim(md);
    expect(out).toContain('ORCH_FINAL_TRIM_MAX_WORDS');
    expect(out).not.toContain('SECOND_BLOCK_ONLY');
  });
});
