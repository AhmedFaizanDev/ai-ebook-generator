import fs from 'fs';
import path from 'path';
import type { IngestResult } from '@/ingest/types';
import { classifyPdf } from '@/ingest/pdf-classify';
import { extractPdfTextPerPage } from '@/ingest/pdf-text';
import { extractPdfImagesPng, listPdfImages, pdfimagesAvailable, type PdfImageListRow } from '@/ingest/pdf-poppler';
import { getIngestAssetsDir } from '@/lib/session-store';
import { ocrPdfToText, ocrToolchainAvailable } from '@/ingest/ocr';
import { clonePdfBytes, loadPdfJsModule } from '@/ingest/pdf-worker';

function basenameTitle(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[-_]+/g, ' ').trim() || 'Imported book';
}

function groupImagesByPage(rows: PdfImageListRow[], imagePaths: string[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (let i = 0; i < rows.length && i < imagePaths.length; i++) {
    const page = rows[i]!.page;
    const fp = imagePaths[i]!;
    const arr = map.get(page) ?? [];
    arr.push(fp);
    map.set(page, arr);
  }
  return map;
}

export interface IngestPdfOptions {
  /** When true, try Tesseract path if the PDF looks scanned (or text is very sparse). */
  ocr?: boolean;
}

export async function ingestPdf(
  filePath: string,
  sessionId: string,
  options: IngestPdfOptions = {},
): Promise<IngestResult> {
  const warnings: string[] = [];
  const imageAssets: NonNullable<IngestResult['imageAssets']> = [];
  const bytes = clonePdfBytes(fs.readFileSync(filePath));

  const classification = await classifyPdf(bytes);
  warnings.push(
    `[ingest] PDF: ${classification.pageCount} pages, ${classification.totalChars} chars total; likelyScanned=${classification.likelyScanned}. ${classification.recommendation}`,
  );

  const pdfjsLib = await loadPdfJsModule();
  const doc = await pdfjsLib
    .getDocument({
      data: clonePdfBytes(bytes),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      verbosity: 0,
    })
    .promise;

  const meta = await doc.getMetadata().catch(() => null);
  const metaInfo = meta?.info as Record<string, unknown> | undefined;
  const metaTitle =
    typeof metaInfo?.Title === 'string' && metaInfo.Title.trim()
      ? String(metaInfo.Title).trim()
      : typeof metaInfo?.Subject === 'string' && metaInfo.Subject.trim()
        ? String(metaInfo.Subject).trim()
        : undefined;
  const metaAuthor =
    typeof metaInfo?.Author === 'string' && metaInfo.Author.trim() ? String(metaInfo.Author).trim() : undefined;

  const title = metaTitle ?? basenameTitle(filePath);

  const ingestRoot = getIngestAssetsDir(sessionId);
  const assetsDir = path.join(ingestRoot, 'pdf-images');
  const tools = ocrToolchainAvailable();
  const shouldTryOcr =
    !!options.ocr && tools.pdftoppm && tools.tesseract && (classification.likelyScanned || classification.totalChars < 400);

  if (options.ocr && !tools.pdftoppm) {
    warnings.push('[ingest] --ocr requested but pdftoppm not on PATH.');
  }
  if (options.ocr && !tools.tesseract) {
    warnings.push('[ingest] --ocr requested but tesseract not on PATH.');
  }

  let usedOcr = false;
  let ocrMarkdown = '';
  if (shouldTryOcr) {
    const workDir = path.join(getIngestAssetsDir(sessionId), 'ocr-work');
    ocrMarkdown = await ocrPdfToText(filePath, workDir);
    usedOcr = ocrMarkdown.trim().length > 0;
    if (usedOcr) {
      warnings.push('[ingest] Used Tesseract OCR for body text.');
    }
  }

  const textByPage = usedOcr ? [] : await extractPdfTextPerPage(bytes);

  let imagesByPage = new Map<number, string[]>();
  if (pdfimagesAvailable()) {
    try {
      const rows = await listPdfImages(filePath);
      const extracted = await extractPdfImagesPng(filePath, assetsDir, 'fig');
      if (rows.length > 0 && extracted.length > 0) {
        imagesByPage = groupImagesByPage(rows, extracted);
        warnings.push(`[ingest] Extracted ${extracted.length} embedded raster image(s) via pdfimages.`);
      } else if (extracted.length > 0) {
        for (let i = 0; i < extracted.length; i++) {
          const p = Math.min(
            classification.pageCount,
            Math.max(1, 1 + Math.floor((i * classification.pageCount) / Math.max(1, extracted.length))),
          );
          const arr = imagesByPage.get(p) ?? [];
          arr.push(extracted[i]!);
          imagesByPage.set(p, arr);
        }
        warnings.push(
          `[ingest] pdfimages -list returned no rows; distributed ${extracted.length} image(s) across pages heuristically.`,
        );
      }
    } catch (e) {
      warnings.push(
        `[ingest] pdfimages failed (${e instanceof Error ? e.message : String(e)}); continuing without extracted images.`,
      );
    }
  } else {
    warnings.push('[ingest] pdfimages not on PATH — embedded images not extracted (install Poppler).');
  }

  const parts: string[] = [`# ${title}`];
  if (metaAuthor) {
    parts.push(`\n*Source author (PDF metadata): ${metaAuthor}*\n`);
  }

  if (usedOcr) {
    parts.push('\n\n', ocrMarkdown.trim());
    parts.push('\n');
    for (let p = 1; p <= classification.pageCount; p++) {
      const imgs = imagesByPage.get(p);
      if (!imgs?.length) continue;
      parts.push(`\n\n### Figures page ${p}\n`);
      for (const fp of imgs) {
        try {
          const id = `pdf-p${p}-img${imageAssets.length + 1}`;
          const relativePath = path.relative(ingestRoot, fp).replace(/\\/g, '/');
          imageAssets.push({
            id,
            filePath: fp,
            relativePath,
            mimeType: 'image/png',
            source: 'pdf',
            page: p,
            alt: `Figure page ${p}`,
          });
          parts.push(`\n\n![Figure page ${p}](rvimg://${id})\n`);
        } catch {
          warnings.push(`[ingest] Could not read image ${fp}`);
        }
      }
    }
  } else {
    const nPages = Math.max(classification.pageCount, textByPage.length, 1);
    for (let p = 1; p <= nPages; p++) {
      const body = textByPage[p - 1] ?? '';
      parts.push(`\n\n## Page ${p}\n\n${body.trim().length > 0 ? body : '_No text on this page._'}\n`);
      const imgs = imagesByPage.get(p);
      if (imgs && imgs.length > 0) {
        for (const fp of imgs) {
          try {
            const id = `pdf-p${p}-img${imageAssets.length + 1}`;
            const relativePath = path.relative(ingestRoot, fp).replace(/\\/g, '/');
            imageAssets.push({
              id,
              filePath: fp,
              relativePath,
              mimeType: 'image/png',
              source: 'pdf',
              page: p,
              alt: `Figure page ${p}`,
            });
            parts.push(`\n\n![Figure page ${p}](rvimg://${id})\n`);
          } catch {
            warnings.push(`[ingest] Could not read image ${fp}`);
          }
        }
      }
    }
  }

  const markdown = parts.join('').trim();
  return {
    markdown,
    metadata: { title, author: metaAuthor },
    warnings,
    imageAssets,
    estimatedSourcePages: classification.pageCount,
  };
}
