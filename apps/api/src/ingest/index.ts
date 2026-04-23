import fs from 'fs';
import path from 'path';
import type { SessionState } from '@/lib/types';
import type { IngestResult } from '@/ingest/types';
import { ingestDocx } from '@/ingest/docx';
import { ingestPdf, type IngestPdfOptions } from '@/ingest/pdf';
import { getIngestAssetsDir } from '@/lib/session-store';
import { sectionizeIngestMarkdown } from '@/ingest/ingest-structure';
import { applyPremiumIngest, looksTechnicalForIngest } from '@/ingest/premium-ingest';
import { getTableReconstructionMode } from '@/ingest/ingest-config';
import { applyVisualFidelityMarkdown } from '@/ingest/visual-fidelity';
import {
  applyDeterministicNormalize,
  applyIngestDeterministicPostProcess,
} from '@/ingest/ingest-post-process';

export type { IngestResult, PdfClassification } from '@/ingest/types';
export { classifyPdf } from '@/ingest/pdf-classify';
export { splitByTopLevelHeading } from '@/ingest/polish-markdown';

export type { SourceBrief, SourceFlatSection, SourceSeed, SourceSlot } from '@/ingest/source-seed';
export {
  splitMarkdownToFlatSections,
  extractEquationSnippets,
  extractRvimgMarkdownLines,
  extractGlobalKeywords,
  keywordsForText,
  buildSlotPlan,
  buildSourceSeedFromFile,
  writeSourceSeedJson,
  visualsHintForSourceSeed,
  type BuildSourceSeedResult,
} from '@/ingest/source-seed';

export {
  applyDeterministicNormalize,
  applyIngestDeterministicPostProcess,
} from '@/ingest/ingest-post-process';
export {
  buildBaselineManifest,
  writeBaselineManifest,
  readBaselineManifest,
  hydrateSessionFromBaselineMarkdown,
  snapshotIngestImageAssetsForBaseline,
  type IngestBaselineManifest,
} from '@/ingest/ingest-baseline-manifest';
export { sectionizeIngestMarkdown } from '@/ingest/ingest-structure';

export interface IngestToSessionOptions extends IngestPdfOptions {
  /** Phase 1: extract, sectionize, normalize only — no OpenAI, no premium wrappers. */
  deterministicOnly?: boolean;
  /** Adds preface, learning objectives, unit recaps, and per-section page breaks in exports. */
  premium?: boolean;
}

/**
 * Phase 2 only: optional premium scaffolding + deterministic normalize.
 * Session must already contain `structure`, `ingestSections`, `subtopicMarkdowns`, and `ingestImageAssets` (e.g. after hydrate).
 */
export async function runIngestEnhancePhase(
  session: SessionState,
  options: { premium?: boolean } = {},
): Promise<void> {
  if (options.premium) {
    session.ingestPremium = true;
    applyPremiumIngest(session);
  } else {
    session.ingestPremium = false;
  }
  applyIngestDeterministicPostProcess(session);
}

function ensureIngestDir(sessionId: string): void {
  const dir = getIngestAssetsDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Ingest a PDF/DOCX into ingest-mode session (sectionized structure + synchronized markdown for legacy export).
 */
export async function ingestFileToSession(
  session: SessionState,
  filePath: string,
  options: IngestToSessionOptions = {},
): Promise<IngestResult> {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }

  ensureIngestDir(session.id);
  session.ingestMode = true;
  session.sourcePath = abs;
  session.structure = null;
  session.ingestPremium = !!options.premium && !options.deterministicOnly;
  session.ingestSections = [];
  session.ingestImageAssets = [];
  session.subtopicMarkdowns.clear();
  session.unitMarkdowns = [];
  session.unitIntroductions = [];
  session.unitEndSummaries = [];
  session.unitExercises = [];
  session.unitSummaries = [];
  session.microSummaries = [];
  session.prefaceMarkdown = null;
  session.capstonesMarkdown = null;
  session.caseStudiesMarkdown = null;
  session.glossaryMarkdown = null;
  session.bibliographyMarkdown = null;

  session.visuals = {
    ...session.visuals,
    equations: { enabled: false },
    mermaid: { enabled: true },
    strictMode: false,
  };

  const ext = path.extname(abs).toLowerCase();
  let result: IngestResult;

  if (ext === '.docx') {
    result = await ingestDocx(abs, session.id);
  } else if (ext === '.pdf') {
    result = await ingestPdf(abs, session.id, { ocr: options.ocr });
  } else {
    throw new Error(`Unsupported ingest format: ${ext} (use .pdf or .docx)`);
  }

  const tableMode = getTableReconstructionMode();
  const vfInitial = applyVisualFidelityMarkdown(result.markdown, tableMode);
  result.markdown = vfInitial.markdown;
  result.warnings.push(...vfInitial.warnings);

  session.finalMarkdown = result.markdown;
  session.topic = result.metadata.title ?? session.topic;

  const technical = looksTechnicalForIngest(session.topic, abs);
  const eqEnv = (process.env.INGEST_EQUATIONS || '').toLowerCase();
  const forceEquations = eqEnv === '1' || eqEnv === 'true' || eqEnv === 'yes';
  const forceEquationsOff = eqEnv === '0' || eqEnv === 'false' || eqEnv === 'no';
  const unicodeMathWrap = process.env.INGEST_UNICODE_MATH_WRAP === '1';
  const docxIngest = ext === '.docx';
  session.visuals = {
    ...session.visuals,
    equations: {
      enabled: !forceEquationsOff && (forceEquations || technical || unicodeMathWrap || docxIngest),
    },
    mermaid: { enabled: true },
    strictMode: false,
  };
  if (unicodeMathWrap) {
    session.ingestWarnings = [
      ...(session.ingestWarnings ?? []),
      '[ingest] INGEST_UNICODE_MATH_WRAP=1: unicode lines may be wrapped as $…$; equations export enabled.',
    ];
  }

  const deterministic = !!options.deterministicOnly;

  const sectionized = sectionizeIngestMarkdown(session.finalMarkdown ?? '', session.topic);
  session.structure = sectionized.structure;
  session.ingestSections = result.sections ?? sectionized.sections;
  session.ingestImageAssets = result.imageAssets ?? [];
  session.subtopicMarkdowns.clear();
  session.unitMarkdowns = sectionized.structure.units.map(() => null);

  for (const sec of session.ingestSections) {
    session.subtopicMarkdowns.set(`u${sec.unitIndex}-s${sec.subtopicIndex}`, sec.markdown);
  }

  if (!deterministic && options.premium) {
    applyPremiumIngest(session);
  }

  if (result.metadata.author) {
    session.author = result.metadata.author;
  }
  session.ingestWarnings = [...(session.ingestWarnings ?? []), ...result.warnings];

  applyDeterministicNormalize(session);

  return result;
}
