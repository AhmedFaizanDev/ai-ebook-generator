import { describe, it, expect } from 'vitest';
import { stampExportAnchors, resolveRefPlaceholders, buildPrintIndexStubHtml } from '@/pdf/export-anchor-pass';

describe('stampExportAnchors', () => {
  it('adds ids to h2 without id', () => {
    const { html, manifest } = stampExportAnchors('<h2>Hello</h2><p>x</p>');
    expect(html).toMatch(/<h2 id="h2-/);
    expect(manifest.headings.length).toBe(1);
  });

  it('leaves existing id unchanged', () => {
    const { html } = stampExportAnchors('<h2 id="keep">Hello</h2>');
    expect(html).toContain('id="keep"');
  });
});

describe('resolveRefPlaceholders', () => {
  it('replaces REF markers with spans', () => {
    const html = resolveRefPlaceholders('<p>[[REF:fig:a1]]</p>', { headings: [], figures: [] });
    expect(html).toContain('xref-unresolved');
    expect(html).toContain('data-ref-slug');
  });
});

describe('buildPrintIndexStubHtml', () => {
  it('returns empty for no entries', () => {
    expect(buildPrintIndexStubHtml([])).toBe('');
  });
});
