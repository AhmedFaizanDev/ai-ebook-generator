import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

export interface LLMCallResult {
  content: string;
  totalTokens: number;
}

let lastCallMs = 0;
const MIN_GAP_MS = 50;

/** Default LLM call timeout (ms). Set LLM_CALL_TIMEOUT_MS in env to override (e.g. 60000 for 60s). */
const DEFAULT_LLM_TIMEOUT_MS = process.env.LLM_CALL_TIMEOUT_MS
  ? parseInt(process.env.LLM_CALL_TIMEOUT_MS, 10)
  : 90_000;

export async function callLLM(params: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs?: number;
  callLabel?: string;
  /** Ebook title for console logs (e.g. session.topic) */
  bookTitle?: string;
  /** Batch book number for console logs (e.g. 1/6). Shown as [1/6] before book title when set. */
  bookIndex?: number;
  /** Batch total for console logs. Use with bookIndex for [1/6] style. */
  bookTotal?: number;
}): Promise<LLMCallResult> {
  const { model, systemPrompt, userPrompt, maxTokens, temperature, callLabel, bookTitle, bookIndex, bookTotal } = params;
  const timeoutMs = params.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const openai = getOpenAIClient();
  const label = callLabel ?? 'unlabeled';
  const numberPart = bookIndex != null && bookTotal != null ? `[${bookIndex}/${bookTotal}] ` : '';
  const titlePart = bookTitle ? `[${bookTitle.slice(0, 50)}${bookTitle.length > 50 ? '…' : ''}] ` : '';
  const bookPrefix = numberPart + titlePart;

  const now = Date.now();
  const gap = now - lastCallMs;
  if (gap < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
  }
  lastCallMs = Date.now();

  const startMs = Date.now();
  console.log(`[LLM] ${bookPrefix}Starting call: ${label} | model=${model}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error(`Empty response from OpenAI for ${label}`);
    }

    const totalTokens = completion.usage?.total_tokens ?? 0;
    const elapsed = Date.now() - startMs;

    console.log(`[LLM] ${bookPrefix}Completed call: ${label} | tokens=${totalTokens} | ${elapsed}ms`);

    return { content: content.trim(), totalTokens };
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
    if (isAbort) {
      console.warn(`[LLM] ${bookPrefix}Call aborted by timeout: ${label} (${timeoutMs}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
