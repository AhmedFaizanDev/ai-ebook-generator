import { SessionState } from '@/lib/types';

const MAX_CALLS = 250;
const MAX_TOKENS = 400_000;

export function incrementCounters(session: SessionState, tokensUsed: number): void {
  session.callCount++;
  session.tokenCount += tokensUsed;
}

export function checkLimits(session: SessionState): void {
  if (session.callCount > MAX_CALLS) {
    throw new Error(`ABORT: Call limit exceeded (${session.callCount}/${MAX_CALLS})`);
  }
  if (session.tokenCount > MAX_TOKENS) {
    throw new Error(`ABORT: Token limit exceeded (${session.tokenCount}/${MAX_TOKENS})`);
  }
}
