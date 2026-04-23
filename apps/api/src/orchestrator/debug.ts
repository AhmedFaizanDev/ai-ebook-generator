const DEBUG = process.env.DEBUG_ORCHESTRATOR === '1' || process.env.DEBUG_ORCHESTRATOR === 'true';

function orchQuiet(): boolean {
  return process.env.ORCH_QUIET === '1' || process.env.ORCH_QUIET === 'true';
}

/** High-signal events that should print even when ORCH_QUIET is set. */
function alwaysLogPhase(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('fail') || m.includes('error');
}

export function logPhase(sessionId: string, message: string, detail?: Record<string, unknown>): void {
  if (orchQuiet() && !alwaysLogPhase(message)) return;
  const ts = new Date().toISOString();
  const extra = detail ? ` ${JSON.stringify(detail)}` : '';
  console.log(`[${ts}] [${sessionId.slice(0, 8)}] ${message}${extra}`);
}

export function logVerbose(sessionId: string, message: string, detail?: Record<string, unknown>): void {
  if (!DEBUG) return;
  const ts = new Date().toISOString();
  const extra = detail ? ` ${JSON.stringify(detail)}` : '';
  console.log(`[${ts}] [${sessionId.slice(0, 8)}] [verbose] ${message}${extra}`);
}
