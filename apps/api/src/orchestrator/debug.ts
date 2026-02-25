const DEBUG = process.env.DEBUG_ORCHESTRATOR === '1' || process.env.DEBUG_ORCHESTRATOR === 'true';

export function logPhase(sessionId: string, message: string, detail?: Record<string, unknown>): void {
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
