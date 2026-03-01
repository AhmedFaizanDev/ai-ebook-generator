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
  /** Optional author for cover; if not set, a random author is chosen from a fixed list. */
  author?: string;
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
}

export interface VisualValidationResult {
  hasTable: boolean;
  hasAsciiDiagram: boolean;
  hasRequiredSubsection: boolean;
  pass: boolean;
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
