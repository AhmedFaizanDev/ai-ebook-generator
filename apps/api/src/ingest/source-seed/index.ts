export type { SourceBrief, SourceFlatSection, SourceSeed, SourceSlot } from '@/ingest/source-seed/types';
export { splitMarkdownToFlatSections } from '@/ingest/source-seed/flat-sections';
export { extractEquationSnippets } from '@/ingest/source-seed/extract-math-lines';
export { extractRvimgMarkdownLines } from '@/ingest/source-seed/extract-rvimg-lines';
export { extractGlobalKeywords, keywordsForText } from '@/ingest/source-seed/keywords-heuristic';
export { buildSlotPlan } from '@/ingest/source-seed/build-slot-plan';
export {
  buildSourceSeedFromFile,
  writeSourceSeedJson,
  visualsHintForSourceSeed,
  type BuildSourceSeedResult,
} from '@/ingest/source-seed/pipeline';
