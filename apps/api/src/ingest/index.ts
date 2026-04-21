import fs from 'fs';
import path from 'path';
import type { SessionState } from '@/lib/types';
import type { IngestResult } from '@/ingest/types';
import { ingestDocx } from '@/ingest/docx';
import { ingestPdf, type IngestPdfOptions } from '@/ingest/pdf';
import { polishIngestedMarkdownBySubtopic } from '@/ingest/polish-markdown';
import { getIngestAssetsDir } from '@/lib/session-store';
import { sectionizeIngestMarkdown } from '@/ingest/ingest-structure';
import { applyPremiumIngest, looksTechnicalForIngest } from '@/ingest/premium-ingest';
import { rebuildFinalMarkdown } from '@/orchestrator/build-markdown';

export type { IngestResult, PdfClassification } from '@/ingest/types';
export { classifyPdf } from '@/ingest/pdf-classify';
export { polishIngestedMarkdown, polishIngestedMarkdownBySubtopic, splitByTopLevelHeading } from '@/ingest/polish-markdown';
export { sectionizeIngestMarkdown } from '@/ingest/ingest-structure';

export interface IngestToSessionOptions extends IngestPdfOptions {
  polish?: boolean;
  /** Adds preface, learning objectives, unit recaps, and per-section page breaks in exports. Use `--polish` separately for LLM prose editing (large books may need a high LLM timeout). */
  premium?: boolean;
}

function ensureIngestDir(sessionId: string): void {
  const dir = getIngestAssetsDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Ingest a PDF/DOCX, optionally polish prose, then build a real ebook structure (units/subtopics),
 * premium scaffolding, and synchronized `finalMarkdown` for exports.
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
  session.ingestPremium = !!options.premium;
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

  session.finalMarkdown = result.markdown;
  session.topic = result.metadata.title ?? session.topic;

  const technical = looksTechnicalForIngest(session.topic, abs);
  session.visuals = {
    ...session.visuals,
    equations: { enabled: technical },
    mermaid: { enabled: true },
    strictMode: false,
  };

  if (options.polish && !process.env.OPENAI_API_KEY) {
    throw new Error('--polish requires OPENAI_API_KEY');
  }

  const sectionized = sectionizeIngestMarkdown(session.finalMarkdown ?? '', session.topic);
  session.structure = sectionized.structure;
  session.ingestSections = result.sections ?? sectionized.sections;
  session.ingestImageAssets = result.imageAssets ?? [];
  session.subtopicMarkdowns.clear();
  session.unitMarkdowns = sectionized.structure.units.map(() => null);

  for (const sec of session.ingestSections) {
    session.subtopicMarkdowns.set(`u${sec.unitIndex}-s${sec.subtopicIndex}`, sec.markdown);
  }

  if (options.polish) {
    await polishIngestedMarkdownBySubtopic(session);
  }

  if (options.premium) {
    applyPremiumIngest(session);
  }

  if (result.metadata.author) {
    session.author = result.metadata.author;
  }
  session.ingestWarnings = [...(session.ingestWarnings ?? []), ...result.warnings];

  session.finalMarkdown = rebuildFinalMarkdown(session);

  return result;
}
