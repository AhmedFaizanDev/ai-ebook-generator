import { describe, it, expect, vi } from 'vitest';
import type { SourceBrief } from '@/ingest/source-seed/types';

vi.mock('@/lib/config', () => ({
  DEBUG_MODE: false,
  UNIT_COUNT: 2,
  SUBTOPICS_PER_UNIT: 3,
  TOTAL_SUBTOPICS: 6,
  CAPSTONE_COUNT: 1,
  CASE_STUDY_COUNT: 1,
  MIN_CALL_INTERVAL_MS: 0,
  LLM_CONCURRENCY: 3,
  LIGHT_MODEL: 'gpt-4o-mini',
}));

describe('buildSlotPlan', () => {
  it('returns exactly TOTAL_SUBTOPICS slots in document order', async () => {
    const { buildSlotPlan } = await import('@/ingest/source-seed/build-slot-plan');
    const brief: SourceBrief = {
      displayTitle: 'T',
      globalKeywords: ['k'],
      sections: [
        { heading: 'A', level: 1, bodyMarkdown: 'one two three', wordCount: 3 },
        { heading: 'B', level: 1, bodyMarkdown: 'four five six seven', wordCount: 4 },
        { heading: 'C', level: 2, bodyMarkdown: 'eight '.repeat(20).trim(), wordCount: 20 },
      ],
    };
    const slots = buildSlotPlan(brief);
    expect(slots).toHaveLength(6);
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i]!.unitIndex).toBe(Math.floor(i / 3));
      expect(slots[i]!.subtopicIndex).toBe(i % 3);
    }
    const joined = slots.map((s) => s.summary).join('\n');
    expect(joined).toContain('A');
    expect(joined).toContain('B');
    expect(joined).toContain('C');
  });

  it('handles empty sections with placeholder slots', async () => {
    const { buildSlotPlan } = await import('@/ingest/source-seed/build-slot-plan');
    const brief: SourceBrief = {
      displayTitle: 'Empty',
      globalKeywords: [],
      sections: [],
    };
    const slots = buildSlotPlan(brief);
    expect(slots).toHaveLength(6);
    expect(slots.every((s) => s.summary.length > 0)).toBe(true);
  });

  it('attaches rvimg markdown lines from section bodies onto slots', async () => {
    const { buildSlotPlan } = await import('@/ingest/source-seed/build-slot-plan');
    const body = `![Fig](rvimg://pdf-p1-img2)\n\n${'word '.repeat(30).trim()}`;
    const brief: SourceBrief = {
      displayTitle: 'Book',
      globalKeywords: [],
      sections: [{ heading: 'Sec', level: 2, bodyMarkdown: body, wordCount: 35 }],
    };
    const slots = buildSlotPlan(brief);
    const withImg = slots.filter((s) => (s.imageLines?.length ?? 0) > 0);
    expect(withImg.length).toBeGreaterThan(0);
    expect(withImg.some((s) => s.imageLines?.includes('![Fig](rvimg://pdf-p1-img2)'))).toBe(true);
  });
});
