import fs from 'fs';
import path from 'path';
import { ingestDocx } from '@/ingest/docx';
import { ingestPdf, type IngestPdfOptions } from '@/ingest/pdf';
import { getTableReconstructionMode } from '@/ingest/ingest-config';
import { applyVisualFidelityMarkdown } from '@/ingest/visual-fidelity';
import { normalizeIngestMarkdownFormat } from '@/ingest/format-normalize-ingest';
import { looksTechnicalForIngest } from '@/ingest/premium-ingest';
import { splitMarkdownToFlatSections } from '@/ingest/source-seed/flat-sections';
import { extractGlobalKeywords } from '@/ingest/source-seed/keywords-heuristic';
import { buildSlotPlan } from '@/ingest/source-seed/build-slot-plan';
import type { IngestResult } from '@/ingest/types';
import type { SourceBrief, SourceSeed } from '@/ingest/source-seed/types';

export interface BuildSourceSeedResult {
  seed: SourceSeed;
  imageAssets: NonNullable<IngestResult['imageAssets']>;
  warnings: string[];
}

/**
 * Read DOCX/PDF, produce markdown + flat brief + 60 slots for orchestrator-seeded generation.
 * Does not sectionize into ingest book shape or run page-fit.
 */
export async function buildSourceSeedFromFile(
  filePath: string,
  sessionId: string,
  options: IngestPdfOptions & { displayTitle?: string } = {},
): Promise<BuildSourceSeedResult> {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  const ext = path.extname(abs).toLowerCase();
  const warnings: string[] = [];

  let result: Awaited<ReturnType<typeof ingestDocx>>;
  if (ext === '.docx') {
    result = await ingestDocx(abs, sessionId);
  } else if (ext === '.pdf') {
    result = await ingestPdf(abs, sessionId, { ocr: options.ocr });
  } else {
    throw new Error(`Unsupported format: ${ext}`);
  }
  warnings.push(...result.warnings);

  const tableMode = getTableReconstructionMode();
  const vf = applyVisualFidelityMarkdown(result.markdown, tableMode);
  warnings.push(...vf.warnings);
  let md = normalizeIngestMarkdownFormat(vf.markdown);

  const displayTitle =
    options.displayTitle?.trim() ||
    result.metadata.title?.trim() ||
    path.basename(abs, ext).replace(/[-_]+/g, ' ').trim() ||
    'Imported document';

  const sections = splitMarkdownToFlatSections(md, displayTitle);
  const globalKeywords = extractGlobalKeywords(sections, 48);

  const brief: SourceBrief = {
    displayTitle,
    globalKeywords,
    sections,
  };

  const slots = buildSlotPlan(brief);

  const seed: SourceSeed = {
    brief,
    slots,
    estimatedSourcePages: result.estimatedSourcePages,
  };

  return { seed, imageAssets: result.imageAssets ?? [], warnings };
}

export function writeSourceSeedJson(outPath: string, seed: SourceSeed): void {
  fs.writeFileSync(outPath, JSON.stringify(seed, null, 2), 'utf-8');
}

/** Visuals hint for orchestrator session (equations on for technical / docx). */
export function visualsHintForSourceSeed(topic: string, filePath: string, ext: string): { equations: boolean } {
  const technical = looksTechnicalForIngest(topic, filePath);
  const eqEnv = (process.env.INGEST_EQUATIONS || '').toLowerCase();
  const forceOff = eqEnv === '0' || eqEnv === 'false' || eqEnv === 'no';
  const forceOn = eqEnv === '1' || eqEnv === 'true' || eqEnv === 'yes';
  const docx = ext.toLowerCase() === '.docx';
  return {
    equations: !forceOff && (forceOn || technical || docx || process.env.INGEST_UNICODE_MATH_WRAP === '1'),
  };
}
