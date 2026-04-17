import { inspect } from 'node:util';

/** Messages that are too generic to surface alone (often from CDP / bad wrappers). */
function isUnhelpfulErrorMessage(message: string): boolean {
  const m = message.trim().toLowerCase();
  return (
    m.length === 0 ||
    m === 'object' ||
    m === '[object object]' ||
    m === 'error' ||
    m === 'unknown error'
  );
}

/**
 * Stable, log-friendly description for thrown values (including Puppeteer rejects
 * where `message` is literally "Object" or empty).
 */
export function describeThrowable(err: unknown, maxLen = 2500): string {
  if (err instanceof Error) {
    const rawMsg = err.message?.trim() ?? '';
    if (!isUnhelpfulErrorMessage(rawMsg)) {
      return rawMsg.length > maxLen ? `${rawMsg.slice(0, maxLen)}…` : rawMsg;
    }
    const name = err.name || 'Error';
    const extras: string[] = [];
    const rec = err as Error & Record<string, unknown>;
    for (const key of ['code', 'errno', 'syscall', 'path'] as const) {
      if (rec[key] != null && String(rec[key]).length > 0) {
        extras.push(`${key}=${String(rec[key])}`);
      }
    }
    let body = extras.length > 0 ? `${extras.join(', ')} — ` : '';
    body += inspect(err, { depth: 8, breakLength: 120, maxStringLength: 400 });
    if (err.cause !== undefined) {
      body += `\ncause: ${describeThrowable(err.cause, Math.min(800, maxLen))}`;
    }
    const combined = `${name}: ${body}`;
    return combined.length > maxLen ? `${combined.slice(0, maxLen)}…` : combined;
  }
  if (typeof err === 'string') {
    return err.length > maxLen ? `${err.slice(0, maxLen)}…` : err;
  }
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const nested = o.error;
    if (nested && typeof nested === 'object') {
      const ne = nested as Record<string, unknown>;
      if (typeof ne.message === 'string' && ne.message.trim() && !isUnhelpfulErrorMessage(ne.message)) {
        return ne.message.trim();
      }
    }
    if (typeof o.message === 'string' && o.message.trim() && !isUnhelpfulErrorMessage(o.message)) {
      return o.message.trim();
    }
    if (typeof o.description === 'string' && o.description.trim()) {
      return o.description.trim();
    }
    try {
      const s = JSON.stringify(err);
      if (s && s !== '{}') {
        return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
      }
    } catch {
      /* ignore */
    }
    const ins = inspect(err, { depth: 6, breakLength: 120 });
    return ins.length > maxLen ? `${ins.slice(0, maxLen)}…` : ins;
  }
  const s = String(err);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}
