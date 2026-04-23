import { describe, it, expect, vi, afterEach } from 'vitest';

describe('logPhase ORCH_QUIET', () => {
  afterEach(() => {
    delete process.env.ORCH_QUIET;
    vi.restoreAllMocks();
  });

  it('suppresses routine logs when ORCH_QUIET=1', async () => {
    process.env.ORCH_QUIET = '1';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logPhase } = await import('@/orchestrator/debug');
    logPhase('session-uuid-here', 'phase: structure');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('still logs failures when ORCH_QUIET=1', async () => {
    process.env.ORCH_QUIET = '1';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logPhase } = await import('@/orchestrator/debug');
    logPhase('session-uuid-here', 'orchestrate failed', { error: 'x' });
    expect(console.log).toHaveBeenCalled();
  });
});
