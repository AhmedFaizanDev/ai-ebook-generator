import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runWithContentValidationRetries,
  formatContentErrorsForRepairPrompt,
  isMarkdownFullyValidForSession,
} from './section-enforce';
import { ContentValidationError } from './content-validation-error';
import type { SessionState } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { LIGHT_MODEL } from '@/lib/config';

function mockSession(overrides: Partial<SessionState['visuals']> = {}): SessionState {
  return {
    id: 't',
    status: 'generating',
    topic: 'Topic',
    isTechnical: true,
    visuals: { ...DEFAULT_VISUAL_CONFIG, strictMode: true, autoFixAttempts: 1, ...overrides },
    model: LIGHT_MODEL,
    phase: 'test',
    progress: 0,
    currentUnit: 1,
    currentSubtopic: 1,
    structure: null,
    unitMarkdowns: [],
    microSummaries: [],
    unitSummaries: [],
    prefaceMarkdown: null,
    unitIntroductions: [],
    unitEndSummaries: [],
    unitExercises: [],
    capstonesMarkdown: null,
    caseStudiesMarkdown: null,
    glossaryMarkdown: null,
    bibliographyMarkdown: null,
    finalMarkdown: null,
    pdfBuffer: null,
    error: null,
    callCount: 0,
    tokenCount: 0,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    subtopicMarkdowns: new Map(),
    subtopicVersions: new Map(),
    editCount: 0,
  } as SessionState;
}

describe('formatContentErrorsForRepairPrompt', () => {
  it('formats errors as a numbered list', () => {
    const s = formatContentErrorsForRepairPrompt([
      { type: 'mermaid', message: 'bad', blockIndex: 0, source: 'x' },
    ]);
    expect(s).toContain('1. [mermaid]');
    expect(s).toContain('bad');
  });
});

describe('runWithContentValidationRetries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns on first successful validation', async () => {
    const session = mockSession();
    const gen = vi.fn().mockResolvedValueOnce('ok');
    const out = await runWithContentValidationRetries(
      session,
      'test',
      () => ({ pass: true, errors: [] }),
      gen,
    );
    expect(out).toBe('ok');
    expect(gen).toHaveBeenCalledTimes(1);
    expect(gen.mock.calls[0][0]).toEqual({ attempt: 1, repairSuffix: null });
  });

  it('regenerates once with repair suffix then succeeds', async () => {
    const session = mockSession({ autoFixAttempts: 1 });
    const gen = vi
      .fn()
      .mockResolvedValueOnce('bad')
      .mockResolvedValueOnce('fixed');
    const validate = vi
      .fn()
      .mockReturnValueOnce({ pass: false, errors: [{ type: 'equation', message: 'x', blockIndex: 0, source: 'y' }] })
      .mockReturnValueOnce({ pass: true, errors: [] });

    const out = await runWithContentValidationRetries(session, 'test', validate, gen);
    expect(out).toBe('fixed');
    expect(gen).toHaveBeenCalledTimes(2);
    expect(gen.mock.calls[1][0].repairSuffix).toContain('Issues:');
    expect(gen.mock.calls[1][0].repairSuffix).toContain('[equation]');
  });

  it('throws ContentValidationError in strictMode after exhausting attempts', async () => {
    const session = mockSession({ autoFixAttempts: 0 });
    const gen = vi.fn().mockResolvedValue('always bad');
    await expect(
      runWithContentValidationRetries(session, 'lab', () => ({ pass: false, errors: [{ type: 'mermaid', message: 'e', blockIndex: 0, source: '' }] }), gen),
    ).rejects.toThrow(ContentValidationError);
    expect(gen).toHaveBeenCalledTimes(1);
  });
});

describe('isMarkdownFullyValidForSession', () => {
  it('returns true for plain prose when visuals off', () => {
    const session = mockSession({
      equations: { enabled: false },
      mermaid: { enabled: false },
      strictMode: true,
    });
    expect(isMarkdownFullyValidForSession(session, 'Hello world.')).toBe(true);
  });
});
