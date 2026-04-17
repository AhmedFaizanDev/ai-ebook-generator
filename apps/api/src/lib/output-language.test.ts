import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildSystemPrompt } from '@/prompts/system';
import { resolveOutputLanguage, slugifyHeadingId } from '@/lib/output-language';

describe('resolveOutputLanguage', () => {
  const original = process.env.OUTPUT_LANGUAGE;

  afterEach(() => {
    if (original === undefined) delete process.env.OUTPUT_LANGUAGE;
    else process.env.OUTPUT_LANGUAGE = original;
  });

  it('defaults to en when unset', () => {
    delete process.env.OUTPUT_LANGUAGE;
    expect(resolveOutputLanguage()).toBe('en');
  });

  it('maps aliases and lowercases', () => {
    process.env.OUTPUT_LANGUAGE = ' FRA ';
    expect(resolveOutputLanguage()).toBe('fr');
    process.env.OUTPUT_LANGUAGE = 'English';
    expect(resolveOutputLanguage()).toBe('en');
    process.env.OUTPUT_LANGUAGE = ' deutsch ';
    expect(resolveOutputLanguage()).toBe('de');
    process.env.OUTPUT_LANGUAGE = 'hin';
    expect(resolveOutputLanguage()).toBe('hi');
  });

  it('warns and falls back for unknown codes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.OUTPUT_LANGUAGE = 'xx';
    expect(resolveOutputLanguage()).toBe('en');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('uses valid CSV override over OUTPUT_LANGUAGE', () => {
    process.env.OUTPUT_LANGUAGE = 'en';
    expect(resolveOutputLanguage('de')).toBe('de');
    expect(resolveOutputLanguage(' FRA ')).toBe('fr');
  });

  it('warns on invalid override then uses env', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.OUTPUT_LANGUAGE = 'hi';
    expect(resolveOutputLanguage('not-a-lang')).toBe('hi');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('slugifyHeadingId', () => {
  it('keeps Devanagari letters in slugs', () => {
    expect(slugifyHeadingId('शब्दावली')).toBe('शब्दावली');
  });
});

describe('buildSystemPrompt + language directive', () => {
  it('appends language directive for fr', () => {
    const p = buildSystemPrompt(true, undefined, 'fr');
    expect(p).toMatch(/French|français/i);
  });

  it('appends directive for de', () => {
    const p = buildSystemPrompt(true, undefined, 'de');
    expect(p).toMatch(/German|Deutsch/i);
  });

  it('appends directive for hi', () => {
    const p = buildSystemPrompt(false, undefined, 'hi');
    expect(p).toMatch(/Hindi|Devanagari/i);
  });

  it('does not append French-only directive for en', () => {
    const p = buildSystemPrompt(false, undefined, 'en');
    expect(p).not.toMatch(/Output language: Write the entire book in French/i);
  });
});
