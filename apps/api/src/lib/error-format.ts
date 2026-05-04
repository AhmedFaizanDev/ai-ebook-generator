/**
 * Puppeteer and some libraries reject with plain objects or Errors whose `message`
 * is empty; `${err}` or String(err) then becomes useless ("Object", "[object Object]").
 */
/** CDP / minified layers sometimes set Error.message to the literal "Object" — stack still has the real fault. */
function isOpaqueErrorMessage(message: string): boolean {
  const m = message.trim();
  if (!m) return true;
  const lower = m.toLowerCase();
  return lower === 'object' || lower === '[object object]' || /^object:\s*object$/i.test(m.trim());
}

export function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message?.trim() ?? '';
    if (!isOpaqueErrorMessage(m)) return m;
    const st = err.stack?.trim();
    if (st) return st.slice(0, 4000);
    return err.name || 'Error (opaque message, no stack)';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim() && !isOpaqueErrorMessage(o.message)) {
      return o.message.trim();
    }
    if (typeof o.stack === 'string' && o.stack.trim()) return o.stack.trim().slice(0, 4000);
    if (typeof o.msg === 'string' && o.msg.trim()) return o.msg.trim();
    if (typeof o.description === 'string' && o.description.trim()) return o.description.trim();
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}
