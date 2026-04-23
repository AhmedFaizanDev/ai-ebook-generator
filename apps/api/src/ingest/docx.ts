import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import type { IngestResult } from '@/ingest/types';
import { htmlToMarkdown } from '@/ingest/html-to-markdown';
import { appendMammothRvimgFigures, pandocDocxToMarkdown } from '@/ingest/docx-pandoc';
import { getIngestAssetsDir } from '@/lib/session-store';

function basenameTitle(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[-_]+/g, ' ').trim() || 'Imported book';
}

const DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='heading 4'] => h4:fresh",
];

function sniffImageType(rawBase64: string, fallbackContentType?: string): { extension: string; mimeType: string } {
  const buf = Buffer.from(rawBase64, 'base64');
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (b.length >= 6 && b.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return { extension: 'gif', mimeType: 'image/gif' };
  }
  if (b.length >= 6 && b.subarray(0, 6).toString('ascii') === 'GIF87a') {
    return { extension: 'gif', mimeType: 'image/gif' };
  }
  if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  const c = (fallbackContentType || '').toLowerCase();
  if (c.includes('png')) return { extension: 'png', mimeType: 'image/png' };
  if (c.includes('gif')) return { extension: 'gif', mimeType: 'image/gif' };
  if (c.includes('webp')) return { extension: 'webp', mimeType: 'image/webp' };
  if (c.includes('jpeg') || c.includes('jpg')) return { extension: 'jpg', mimeType: 'image/jpeg' };
  return { extension: 'bin', mimeType: fallbackContentType || 'application/octet-stream' };
}

export async function ingestDocx(filePath: string, sessionId: string): Promise<IngestResult> {
  const warnings: string[] = [];
  const imageAssets: NonNullable<IngestResult['imageAssets']> = [];
  const buffer = fs.readFileSync(filePath);
  const ingestRoot = getIngestAssetsDir(sessionId);
  const imageDir = path.join(ingestRoot, 'docx-images');
  fs.mkdirSync(imageDir, { recursive: true });
  let imageCounter = 0;

  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: DOCX_STYLE_MAP,
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.imgElement(async (image) => {
        imageCounter += 1;
        const raw = await image.read('base64');
        const detected = sniffImageType(raw, image.contentType ?? undefined);
        const extension = detected.extension;
        const id = `docx-img${imageCounter}`;
        const filename = `${id}.${extension}`;
        const absolutePath = path.join(imageDir, filename);
        fs.writeFileSync(absolutePath, raw, 'base64');
        const relativePath = path.relative(ingestRoot, absolutePath).replace(/\\/g, '/');
        imageAssets.push({
          id,
          filePath: absolutePath,
          relativePath,
          mimeType: detected.mimeType,
          source: 'docx',
          alt: `Figure ${imageCounter}`,
        });
        if (detected.mimeType === 'application/octet-stream' || extension === 'bin') {
          warnings.push(`[ingest] Unsupported embedded image format for ${id}; preserved as binary placeholder.`);
        }
        return { src: `rvimg://${id}` };
      }),
    },
  );

  for (const m of messages) {
    warnings.push(`[mammoth] ${m.type}: ${m.message}`);
  }

  let markdown = htmlToMarkdown(html);
  if (!markdown.startsWith('#')) {
    markdown = `# ${basenameTitle(filePath)}\n\n${markdown}`;
  }

  const trimmedMammothMd = markdown.trim();
  let trimmedMd = trimmedMammothMd;
  if ((process.env.INGEST_DOCX_MATH || '').toLowerCase() === 'pandoc') {
    const pandoc = await pandocDocxToMarkdown(filePath);
    if (pandoc.ok && pandoc.markdown.length > 200) {
      trimmedMd = appendMammothRvimgFigures(pandoc.markdown, trimmedMammothMd);
      warnings.push(
        '[ingest] INGEST_DOCX_MATH=pandoc: using Pandoc for body text; Mammoth `rvimg` figure lines appended under “Figures from source”.',
      );
    } else if (!pandoc.ok) {
      warnings.push(`[ingest] Pandoc not used (${pandoc.error}); Mammoth markdown only.`);
    }
  }

  const trimmedMdFinal = trimmedMd;
  const words = trimmedMdFinal ? trimmedMdFinal.split(/\s+/).length : 0;
  const wpp = parseInt(process.env.INGEST_WORDS_PER_PAGE || '275', 10);
  const wordsPerPage = Number.isFinite(wpp) && wpp > 0 ? wpp : 275;
  const estimatedSourcePages = Math.max(1, Math.round(words / wordsPerPage));

  return {
    markdown: trimmedMdFinal,
    metadata: { title: basenameTitle(filePath) },
    warnings,
    imageAssets,
    estimatedSourcePages,
  };
}
