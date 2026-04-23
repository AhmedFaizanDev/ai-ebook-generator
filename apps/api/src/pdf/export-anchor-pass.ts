/**
 * First pass of a two-pass export anchor system: stable ids for headings and figures,
 * plus a machine-readable manifest for future cross-refs / index (milestone).
 */

export interface ExportAnchorManifest {
  headings: Array<{ id: string; level: number; textSample: string }>;
  figures: Array<{ id: string; captionSample: string }>;
}

let exportAnchorSeq = 0;

function nextId(prefix: string): string {
  exportAnchorSeq += 1;
  return `${prefix}-${exportAnchorSeq}`;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Ensure h2/h3 and figure elements have ids; collect manifest for tooling / future ref pass.
 */
export function stampExportAnchors(html: string): { html: string; manifest: ExportAnchorManifest } {
  exportAnchorSeq = 0;
  const manifest: ExportAnchorManifest = { headings: [], figures: [] };

  let out = html.replace(/<h([23])(?![^>]*\bid\s*=)([^>]*)>/gi, (_full, level: string, rest: string) => {
    const id = nextId(`h${level}`);
    manifest.headings.push({ id, level: parseInt(level, 10), textSample: '' });
    const r = rest.trim();
    return `<h${level} id="${id}"${r ? ` ${r}` : ''}>`;
  });

  out = out.replace(/<figure(?![^>]*\bid\s*=)([^>]*)>/gi, (_full, rest: string) => {
    const id = nextId('fig');
    manifest.figures.push({ id, captionSample: '' });
    const r = rest.trim();
    return `<figure id="${id}"${r ? ` ${r}` : ''}>`;
  });

  for (const h of manifest.headings) {
    const re = new RegExp(
      `<h${h.level}[^>]*\\bid=["']${h.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)</h${h.level}>`,
      'i',
    );
    const m = out.match(re);
    if (m) h.textSample = stripTags(m[1]).slice(0, 120);
  }
  for (const f of manifest.figures) {
    const re = new RegExp(
      `<figure[^>]*\\bid=["']${f.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>[\\s\\S]*?<figcaption[^>]*>([\\s\\S]*?)</figcaption>`,
      'i',
    );
    const m = out.match(re);
    if (m) f.captionSample = stripTags(m[1]).slice(0, 160);
  }

  return { html: out, manifest };
}

/** Pass 2 stub: unresolved refs render as annotated spans until a resolver maps slugs to numbers. */
export function resolveRefPlaceholders(html: string, _manifest: ExportAnchorManifest): string {
  if (!html.includes('[[REF:')) return html;
  return html.replace(/\[\[REF:([^:]+):([^\]]+)\]\]/g, (_full, kind: string, slug: string) => {
    return `<span class="xref-unresolved" data-ref-kind="${escapeText(kind)}" data-ref-slug="${escapeText(slug)}">[${escapeText(kind)}:${escapeText(slug)}]</span>`;
  });
}

/** Stub index appendix HTML (milestone: page numbers require a second layout pass). */
export function buildPrintIndexStubHtml(entries: string[]): string {
  if (!entries.length) return '';
  const items = entries.map((e) => `<li>${escapeText(e)}</li>`).join('');
  return `<div class="print-index-stub"><h2 id="index-stub">Index</h2><p class="print-index-note">Stub index (full index is a separate milestone).</p><ul>${items}</ul></div>`;
}
