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

export async function callLLM(params: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs?: number;
  callLabel?: string;
}): Promise<LLMCallResult> {
  const { model, systemPrompt, userPrompt, maxTokens, temperature, timeoutMs = 120_000, callLabel } = params;
  const openai = getOpenAIClient();
  const label = callLabel ?? 'unlabeled';

  const now = Date.now();
  const gap = now - lastCallMs;
  if (gap < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
  }
  lastCallMs = Date.now();

  const startMs = Date.now();
  console.log(`[LLM] Starting call: ${label} | model=${model}`);

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

    console.log(`[LLM] Completed call: ${label} | tokens=${totalTokens} | ${elapsed}ms`);

    return { content: content.trim(), totalTokens };
  } finally {
    clearTimeout(timer);
  }
}
