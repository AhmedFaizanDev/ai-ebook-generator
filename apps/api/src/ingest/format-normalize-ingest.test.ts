import { describe, it, expect } from 'vitest';
import { normalizeIngestMarkdownFormat } from '@/ingest/format-normalize-ingest';

describe('normalizeIngestMarkdownFormat', () => {
  it('merges hyphenated line breaks', () => {
    const md = 'exam-\nple';
    expect(normalizeIngestMarkdownFormat(md)).toContain('example');
  });

  it('removes soft hyphens between letters', () => {
    const md = 'south\u00ADwestern winds';
    expect(normalizeIngestMarkdownFormat(md)).toContain('southwestern');
  });

  it('normalizes common hydrology unit spellings', () => {
    const md = 'Peak flow 12 m3/s and area 4 km2.';
    const out = normalizeIngestMarkdownFormat(md);
    expect(out).toContain('m³/s');
    expect(out).toContain('km²');
  });
});
