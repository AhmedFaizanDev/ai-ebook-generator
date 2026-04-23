import { describe, it, expect, vi } from 'vitest';
import { buildSubtopicPrompt } from '@/prompts/subtopic';
import { DEFAULT_VISUAL_CONFIG, type SubtopicContext } from '@/lib/types';
import type { SourceSlot } from '@/ingest/source-seed/types';

vi.mock('@/lib/config', () => ({
  DEBUG_MODE: false,
  UNIT_COUNT: 10,
  SUBTOPICS_PER_UNIT: 6,
  TOTAL_SUBTOPICS: 60,
  CAPSTONE_COUNT: 1,
  CASE_STUDY_COUNT: 1,
  MIN_CALL_INTERVAL_MS: 0,
  LLM_CONCURRENCY: 3,
  LIGHT_MODEL: 'gpt-4o-mini',
}));

function baseCtx(over: Partial<SubtopicContext> = {}): SubtopicContext {
  return {
    topic: 'Book',
    unitTitle: 'Unit',
    subtopicTitle: 'Sub',
    unitIndex: 0,
    subtopicIndex: 0,
    prevUnitSummary: null,
    prevSubtopicSummary: null,
    model: 'gpt-4o-mini',
    isTechnical: false,
    visuals: { ...DEFAULT_VISUAL_CONFIG, equations: { enabled: false }, mermaid: { enabled: true }, strictMode: false },
    ...over,
  };
}

describe('buildSubtopicPrompt source anchor', () => {
  it('includes Source anchor when sourceSlot is set', () => {
    const slot: SourceSlot = {
      unitIndex: 0,
      subtopicIndex: 0,
      summary: 'Alpha beta',
      keywords: ['kw1', 'kw2'],
      equations: ['E = mc^2'],
      sourceHeadingRefs: ['Intro'],
      imageLines: ['![Fig](rvimg://docx-img9)'],
    };
    const prompt = buildSubtopicPrompt(baseCtx({ sourceSlot: slot }));
    expect(prompt).toContain('--- Source anchor');
    expect(prompt).toContain('Alpha beta');
    expect(prompt).toContain('kw1');
    expect(prompt).toContain('E = mc^2');
    expect(prompt).toContain('Intro');
    expect(prompt).toContain('![Fig](rvimg://docx-img9)');
    expect(prompt).toContain('SOURCE FIGURES');
    expect(prompt).toContain('SOURCE FIGURES: If the anchor lists');
  });

  it('omits anchor block when sourceSlot is absent', () => {
    const prompt = buildSubtopicPrompt(baseCtx());
    expect(prompt).not.toContain('--- Source anchor');
  });
});
