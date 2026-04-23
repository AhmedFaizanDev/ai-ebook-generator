import type { SourceSeed, SourceSlot } from '@/ingest/source-seed/types';

export interface VisualConfig {
  equations: { enabled: boolean };
  mermaid: { enabled: boolean };
  /** When true, export hard-fails on any unresolved math/diagram block. */
  strictMode: boolean;
  /** Number of auto-fix attempts before hard-fail (default 1). */
  autoFixAttempts: number;
}

export const DEFAULT_VISUAL_CONFIG: VisualConfig = {
  equations: { enabled: false },
  mermaid: { enabled: false },
  strictMode: true,
  autoFixAttempts: 1,
};

export interface BookStructure {
  title: string;
  units: UnitStructure[];
  capstoneTopics: string[];
  caseStudyTopics: string[];
}

export interface UnitStructure {
  unitTitle: string;
  subtopics: string[];
}

export type SessionStatus =
  | 'queued'
  | 'generating'
  | 'markdown_ready'
  | 'exporting_pdf'
  | 'completed'
  | 'failed'
  | 'downloaded';

export interface SessionState {
  id: string;
  status: SessionStatus;
  topic: string;
  /** True when the topic is classified as technical (programming, engineering, sciences, etc.);
   *  false for non-technical topics (fiction, history, philosophy, arts, etc.).
   *  Controls whether code blocks are included in generated content. */
  isTechnical: boolean;
  /** Per-book toggle for equation / Mermaid rendering in exports. */
  visuals: VisualConfig;
  /** Optional author for cover; if not set, a random author is chosen from a fixed list. */
  author?: string;
  /** Optional ISBN from batch upload CSV (column C); shown on copyright page. */
  isbn?: string;
  /** Batch position (1-based) for LLM log prefix, e.g. [1/6]. Set by batch CLI. */
  batchIndex?: number;
  /** Batch size for LLM log prefix. Set by batch CLI. */
  batchTotal?: number;
  model: string;
  phase: string;
  progress: number;
  currentUnit: number;
  currentSubtopic: number;
  structure: BookStructure | null;
  unitMarkdowns: (string | null)[];
  microSummaries: (string[] | null)[];
  unitSummaries: string[];
  prefaceMarkdown: string | null;
  unitIntroductions: (string | null)[];
  unitEndSummaries: (string | null)[];
  unitExercises: (string | null)[];
  capstonesMarkdown: string | null;
  caseStudiesMarkdown: string | null;
  glossaryMarkdown: string | null;
  bibliographyMarkdown: string | null;
  finalMarkdown: string | null;
  pdfBuffer: Buffer | null;
  error: string | null;
  callCount: number;
  tokenCount: number;
  createdAt: number;
  lastActivityAt: number;
  subtopicMarkdowns: Map<string, string>;
  subtopicVersions: Map<string, string[]>;
  editCount: number;
  /** When true, exports skip strict preflight (legacy ingest HTML/markdown). */
  ingestMode?: boolean;
  /** Ingest CLI: adds preface, objectives, recaps, and optional per-section page breaks. */
  ingestPremium?: boolean;
  /** Original file path for ingest jobs (informational / logs). */
  sourcePath?: string;
  /** Non-fatal ingest messages (persisted with session). */
  ingestWarnings?: string[];
  /** Structured sections synthesized from ingest markdown for ebook-style exports. */
  ingestSections?: Array<{
    id: string;
    title: string;
    level: 1 | 2 | 3;
    markdown: string;
    unitIndex: number;
    subtopicIndex: number;
    containsTable: boolean;
    containsMermaid: boolean;
  }>;
  /** Last merged PDF page count from exportPDF (diagnostics / future tuning). */
  lastExportPageCount?: number;
  /** Image manifest extracted from source docs/PDFs and referenced via rvimg:// IDs. */
  ingestImageAssets?: Array<{
    id: string;
    filePath: string;
    relativePath: string;
    mimeType: string;
    source: 'pdf' | 'docx';
    page?: number;
    alt?: string;
  }>;
  /** When set, `generateSubtopic` / structure use anchors from imported source (orchestrator-seeded path). */
  sourceSeed?: SourceSeed;
}

export interface SubtopicContext {
  topic: string;
  unitTitle: string;
  subtopicTitle: string;
  unitIndex: number;
  subtopicIndex: number;
  prevUnitSummary: string | null;
  prevSubtopicSummary: string | null;
  model: string;
  /** Mirrors session.isTechnical — controls whether code blocks are included in the subtopic prompt. */
  isTechnical: boolean;
  /** Per-book visual rendering config for equations and diagrams. */
  visuals: VisualConfig;
  /** Per-slot source anchor when generating from an imported document. */
  sourceSlot?: SourceSlot;
}

export interface ContentBlockError {
  type: 'mermaid' | 'equation' | 'markdown-leak' | 'code-fence';
  message: string;
  /** Zero-based index of the block within the markdown (for targeted retry prompts). */
  blockIndex: number;
  /** Raw source of the failing block. */
  source: string;
}

export interface VisualValidationResult {
  hasTable: boolean;
  hasAsciiDiagram: boolean;
  hasRequiredSubsection: boolean;
  pass: boolean;
  /** Per-block errors found by content validator (empty when pass is true). */
  errors: ContentBlockError[];
}

export interface ProgressEvent {
  phase: string;
  unit: number;
  subtopic: number;
  percent: number;
  status: SessionStatus;
  error?: string;
  lastActivityAt?: number;
  callCount?: number;
  tokenCount?: number;
  structure?: BookStructure;
  generatedCount?: number;
  editCount?: number;
}
