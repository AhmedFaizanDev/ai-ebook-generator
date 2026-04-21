import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import type { IngestResult } from '@/ingest/types';
import { htmlToMarkdown } from '@/ingest/html-to-markdown';
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
        const extension = image.contentType?.includes('png')
          ? 'png'
          : image.contentType?.includes('gif')
            ? 'gif'
            : image.contentType?.includes('webp')
              ? 'webp'
              : 'jpg';
        const id = `docx-img${imageCounter}`;
        const filename = `${id}.${extension}`;
        const absolutePath = path.join(imageDir, filename);
        const raw = await image.read('base64');
        fs.writeFileSync(absolutePath, raw, 'base64');
        const relativePath = path.relative(ingestRoot, absolutePath).replace(/\\/g, '/');
        imageAssets.push({
          id,
          filePath: absolutePath,
          relativePath,
          mimeType: image.contentType ?? `image/${extension}`,
          source: 'docx',
          alt: `Figure ${imageCounter}`,
        });
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

  return {
    markdown: markdown.trim(),
    metadata: { title: basenameTitle(filePath) },
    warnings,
    imageAssets,
  };
}
