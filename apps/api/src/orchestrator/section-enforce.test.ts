import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runWithContentValidationRetries,
  formatContentErrorsForRepairPrompt,
  isMarkdownFullyValidForSession,
} from './section-enforce';
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

  it('returns generated markdown on first attempt', async () => {
    const session = mockSession();
    const gen = vi.fn().mockResolvedValueOnce('ok  ');
    const validate = vi.fn().mockReturnValue({ pass: false, errors: [{ type: 'mermaid', message: 'x', blockIndex: 0, source: '' }] });
    const out = await runWithContentValidationRetries(
      session,
      'test',
      validate,
      gen,
    );
    expect(out).toBe('ok');
    expect(gen).toHaveBeenCalledTimes(1);
    expect(gen.mock.calls[0][0]).toEqual({ attempt: 1, repairSuffix: null });
    expect(validate).not.toHaveBeenCalled();
  });
});

describe('isMarkdownFullyValidForSession', () => {
  it('always returns true when validation gate is disabled', () => {
    const session = mockSession({
      equations: { enabled: false },
      mermaid: { enabled: false },
      strictMode: true,
    });
    expect(isMarkdownFullyValidForSession(session, 'Hello world.')).toBe(true);
    expect(isMarkdownFullyValidForSession(session, '```mermaid\ngraph LR\nA-->B\n')).toBe(true);
  });
});
