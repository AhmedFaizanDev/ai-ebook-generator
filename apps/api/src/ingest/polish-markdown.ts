import { callLLM } from '@/lib/openai-client';
import type { SessionState } from '@/lib/types';

interface VisualMasks {
  imageLines: string[];
  mermaidBlocks: string[];
  tableBlocks: string[];
}

function maskVisualBlocks(md: string): { masked: string; masks: VisualMasks } {
  const imageLines: string[] = [];
  let masked = md.replace(/^!\[[^\n]*\]\([^)]+\)\s*$/gm, (line) => {
    const i = imageLines.push(line.trimEnd()) - 1;
    return `\n<<<INGEST_IMG_${i}>>>\n`;
  });

  const mermaidBlocks: string[] = [];
  masked = masked.replace(/```mermaid[\s\S]*?```/gi, (block) => {
    const i = mermaidBlocks.push(block.trimEnd()) - 1;
    return `\n<<<INGEST_MERMAID_${i}>>>\n`;
  });

  const tableBlocks: string[] = [];
  masked = masked.replace(/(?:^|\n)((?:\|[^\n]+\|\n?){2,})/g, (_m, block: string) => {
    const i = tableBlocks.push(block.trimEnd()) - 1;
    return `\n<<<INGEST_TABLE_${i}>>>\n`;
  });

  return {
    masked,
    masks: { imageLines, mermaidBlocks, tableBlocks },
  };
}

function restoreVisualBlocks(merged: string, masks: VisualMasks): string {
  let out = merged;
  out = out.replace(/<<<INGEST_TABLE_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.tableBlocks[idx] ?? `<!-- missing table ${idx} -->`;
  });
  out = out.replace(/<<<INGEST_MERMAID_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.mermaidBlocks[idx] ?? `<!-- missing mermaid ${idx} -->`;
  });
  out = out.replace(/<<<INGEST_IMG_(\d+)>>>/g, (_, n) => {
    const idx = parseInt(n, 10);
    return masks.imageLines[idx] ?? `<!-- missing image ${idx} -->`;
  });
  return out.trim();
}

const INGEST_POLISH_SYSTEM = `You are an editor improving textbook prose for clarity and consistency.
Rules:
- Output Markdown only. No HTML wrapper.
- Preserve every line that matches <<<INGEST_IMG_N>>> exactly (same markers, same order).
- Preserve every line that matches <<<INGEST_MERMAID_N>>> exactly (same markers, same order).
- Preserve every line that matches <<<INGEST_TABLE_N>>> exactly (same markers, same order).
- Do not add new image lines or change numbering of placeholders.
- Keep heading hierarchy (# ## ###) meaningful.
- Preserve technical notation and math-looking fragments when unsure.`;

/**
 * Replace markdown image lines with placeholders, run LLM polish per `#` chapter,
 * then restore placeholders. Preserves every `![](...)` line exactly.
 */
export async function polishIngestedMarkdown(session: SessionState): Promise<void> {
  const md = session.finalMarkdown?.trim();
  if (!md) throw new Error('No finalMarkdown to polish');

  const { masked, masks } = maskVisualBlocks(md);

  const model = session.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const chunks = splitByTopLevelHeading(masked);
  const outParts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!.trim();
    if (!chunk) continue;
    const { content, totalTokens } = await callLLM({
      model,
      systemPrompt: INGEST_POLISH_SYSTEM,
      userPrompt: `Edit the following Markdown:\n\n${chunk}`,
      maxTokens: 8192,
      temperature: 0.25,
      callLabel: `ingest-polish-${i + 1}/${chunks.length}`,
      bookTitle: session.topic,
    });
    session.callCount += 1;
    session.tokenCount += totalTokens;
    outParts.push(content);
  }

  session.finalMarkdown = restoreVisualBlocks(outParts.join('\n\n'), masks);
}

/**
 * Polish each unit subtopic independently (after structure is built). Scales better for large imports.
 */
export async function polishIngestedMarkdownBySubtopic(session: SessionState): Promise<void> {
  const keys = Array.from(session.subtopicMarkdowns.keys()).sort((a, b) => {
    const pa = a.match(/^u(\d+)-s(\d+)$/);
    const pb = b.match(/^u(\d+)-s(\d+)$/);
    if (!pa || !pb) return a.localeCompare(b);
    const ua = parseInt(pa[1]!, 10);
    const ub = parseInt(pb[1]!, 10);
    if (ua !== ub) return ua - ub;
    return parseInt(pa[2]!, 10) - parseInt(pb[2]!, 10);
  });

  const model = session.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const timeoutMs = process.env.LLM_CALL_TIMEOUT_MS
    ? parseInt(process.env.LLM_CALL_TIMEOUT_MS, 10)
    : 180_000;

  const systemPrompt = `${INGEST_POLISH_SYSTEM}
This chunk is one section of a larger book; keep the opening ## line as the section title unless you are clearly fixing a typo.`;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const md = session.subtopicMarkdowns.get(key);
    if (!md?.trim()) continue;

    const { masked, masks } = maskVisualBlocks(md);
    const { content, totalTokens } = await callLLM({
      model,
      systemPrompt,
      userPrompt: `Edit the following Markdown section:\n\n${masked}`,
      maxTokens: 8192,
      temperature: 0.25,
      timeoutMs,
      callLabel: `ingest-polish-${key}-${i + 1}/${keys.length}`,
      bookTitle: session.topic,
    });
    session.callCount += 1;
    session.tokenCount += totalTokens;

    const restored = restoreVisualBlocks(content, masks);
    session.subtopicMarkdowns.set(key, restored);

    if (session.ingestSections?.length) {
      const m = key.match(/^u(\d+)-s(\d+)$/);
      if (m) {
        const u = parseInt(m[1]!, 10);
        const s = parseInt(m[2]!, 10);
        const sec = session.ingestSections.find((x) => x.unitIndex === u && x.subtopicIndex === s);
        if (sec) sec.markdown = restored;
      }
    }
  }
}

/** Split on lines that start with "# " but not "## " (ATX H1 only). */
export function splitByTopLevelHeading(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (/^# [^#]/.test(line) && cur.length > 0) {
      chunks.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks.map((c) => c.join('\n')).filter((s) => s.trim().length > 0);
}
