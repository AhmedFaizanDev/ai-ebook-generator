import { clonePdfBytes, loadPdfJsModule } from '@/ingest/pdf-worker';

interface TextItem {
  x: number;
  yTop: number;
  fontSize: number;
  str: string;
  hasEOL: boolean;
}

function clusterLines(items: TextItem[], yTol: number): TextItem[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => (a.yTop !== b.yTop ? a.yTop - b.yTop : a.x - b.x));
  const lines: TextItem[][] = [];
  let current: TextItem[] = [sorted[0]!];
  let refY = sorted[0]!.yTop;
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]!;
    if (Math.abs(it.yTop - refY) <= yTol) {
      current.push(it);
    } else {
      lines.push(current);
      current = [it];
      refY = it.yTop;
    }
  }
  lines.push(current);
  return lines;
}

function lineToString(line: TextItem[]): string {
  line.sort((a, b) => a.x - b.x);
  return line.map((i) => i.str).join('');
}

/** Extract reading-ordered plain text per page (pdf.js). */
export async function extractPdfTextPerPage(bytes: Uint8Array): Promise<string[]> {
  const data = clonePdfBytes(bytes);
  const pdfjs = await loadPdfJsModule();
  const doc = await pdfjs
    .getDocument({
      data: data,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      verbosity: 0,
    })
    .promise;
  const pages: string[] = [];
  const yTol = 4;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const tc = await page.getTextContent();
    const items: TextItem[] = [];

    for (const raw of tc.items) {
      if (!raw || typeof raw !== 'object' || !('str' in raw)) continue;
      const o = raw as { str: string; transform: number[]; hasEOL?: boolean };
      const str = o.str;
      if (!str || str.trim().length === 0) continue;
      const tr = o.transform;
      const x = tr[4] ?? 0;
      const yPdf = tr[5] ?? 0;
      const yTop = pageHeight - yPdf;
      const fontSize = Math.max(6, Math.hypot(tr[2] ?? 0, tr[3] ?? 0) || 12);
      items.push({ x, yTop, fontSize, str, hasEOL: !!o.hasEOL });
    }

    const lineGroups = clusterLines(items, yTol);
    const lines = lineGroups.map(lineToString).filter((s) => s.trim().length > 0);
    pages.push(lines.join('\n\n'));
  }

  return pages;
}
