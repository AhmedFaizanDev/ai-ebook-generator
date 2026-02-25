export interface RetryOpts {
  max: number;
  baseDelay?: number;
  label?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.3);
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  const { max, baseDelay = 2000, label = '' } = opts;

  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err as Record<string, unknown>;
      const msg = error.message && typeof error.message === 'string' ? error.message : String(err);

      if (msg.includes('ABORT')) {
        throw err;
      }

      if (attempt === max) {
        console.error(`[retry] ${label} exhausted after ${max + 1} attempts: ${msg}`);
        throw err;
      }

      let delayMs: number;

      if (error.status === 429) {
        const headers = error.headers as Record<string, string> | undefined;
        const retryAfter = parseInt(headers?.['retry-after'] ?? '60', 10);
        delayMs = retryAfter * 1000;
        console.warn(`[retry] ${label} attempt ${attempt + 1}/${max + 1}: 429 rate limited, waiting ${retryAfter}s`);
      } else if (typeof error.status === 'number' && error.status >= 500) {
        delayMs = jitter(baseDelay * Math.pow(2, attempt));
        console.warn(`[retry] ${label} attempt ${attempt + 1}/${max + 1}: server ${error.status}, waiting ${Math.round(delayMs / 1000)}s`);
      } else if (msg.includes('aborted') || msg.includes('AbortError') || msg.includes('timeout')) {
        delayMs = jitter(baseDelay * Math.pow(2, attempt));
        console.warn(`[retry] ${label} attempt ${attempt + 1}/${max + 1}: timeout/abort, waiting ${Math.round(delayMs / 1000)}s`);
      } else if (msg.includes('Connection error') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')) {
        delayMs = jitter(5000 * Math.pow(2, attempt));
        console.warn(`[retry] ${label} attempt ${attempt + 1}/${max + 1}: connection error, waiting ${Math.round(delayMs / 1000)}s`);
      } else {
        delayMs = jitter(baseDelay * Math.pow(2, attempt));
        console.warn(`[retry] ${label} attempt ${attempt + 1}/${max + 1}: ${msg}, waiting ${Math.round(delayMs / 1000)}s`);
      }

      await sleep(delayMs);
    }
  }

  throw new Error('Retry exhausted');
}
