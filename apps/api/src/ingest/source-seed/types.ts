/**
 * Source-grounded orchestrator seeding: brief + 60 slots (see plan source-grounded ingest v2).
 */

export interface SourceFlatSection {
  heading: string;
  level: 1 | 2 | 3;
  bodyMarkdown: string;
  wordCount: number;
}

export interface SourceBrief {
  displayTitle: string;
  globalKeywords: string[];
  sections: SourceFlatSection[];
}

export interface SourceSlot {
  unitIndex: number;
  subtopicIndex: number;
  summary: string;
  keywords: string[];
  equations: string[];
  sourceHeadingRefs: string[];
  /** Verbatim `![](rvimg://…)` lines from mapped source bodies (resolved at PDF/DOCX export). */
  imageLines?: string[];
}

export interface SourceSeed {
  brief: SourceBrief;
  slots: SourceSlot[];
  estimatedSourcePages?: number;
}
