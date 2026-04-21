export interface IngestImageAsset {
  id: string;
  /** Absolute on-disk path inside ingest assets dir. */
  filePath: string;
  /** Relative path from ingest assets dir (portable for persisted sessions). */
  relativePath: string;
  mimeType: string;
  source: 'pdf' | 'docx';
  page?: number;
  alt?: string;
}

export interface IngestSection {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  markdown: string;
  unitIndex: number;
  subtopicIndex: number;
  containsTable: boolean;
  containsMermaid: boolean;
}

export interface IngestSectionTree {
  title: string;
  units: Array<{
    title: string;
    subtopics: string[];
  }>;
}

export interface IngestResult {
  markdown: string;
  metadata: { title?: string; author?: string };
  warnings: string[];
  imageAssets?: IngestImageAsset[];
  sections?: IngestSection[];
  sectionTree?: IngestSectionTree;
}

/** Heuristic PDF quality signals (logged + returned to caller). */
export interface PdfClassification {
  pageCount: number;
  charsPerPage: number[];
  totalChars: number;
  /** True when average text per page is very low (likely scan or image-only). */
  likelyScanned: boolean;
  recommendation: string;
}
