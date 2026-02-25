import { Router, Request, Response } from 'express';
import { getSession, saveSession } from '@/lib/session-store';
import { LIGHT_MODEL } from '@/lib/config';
import { callLLM } from '@/lib/openai-client';
import { incrementCounters } from '@/lib/counters';
import { SYSTEM_PROMPT } from '@/prompts/system';
import { buildEditSectionPrompt, EditAction } from '@/prompts/edit-section';

const VALID_ACTIONS: EditAction[] = ['expand', 'rewrite', 'add_example', 'add_table', 'shorten'];
const MAX_VERSIONS = 5;

/**
 * Build a character-level mapping from raw Markdown to its plain-text
 * representation (stripping inline formatting tokens).
 *
 * Returns { plain, map } where:
 *   plain = the stripped text
 *   map[i] = the index in the original Markdown that produced plain[i]
 */
function buildPlainTextMap(md: string): { plain: string; map: number[] } {
  const plain: string[] = [];
  const map: number[] = [];
  let i = 0;
  while (i < md.length) {
    // Skip fenced code block delimiters but keep content
    if (md.startsWith('```', i)) {
      const endFence = md.indexOf('\n', i);
      if (endFence === -1) break;
      i = endFence + 1;
      const closingFence = md.indexOf('```', i);
      if (closingFence === -1) {
        for (; i < md.length; i++) {
          plain.push(md[i]);
          map.push(i);
        }
      } else {
        for (; i < closingFence; i++) {
          plain.push(md[i]);
          map.push(i);
        }
        const endLine = md.indexOf('\n', closingFence);
        i = endLine === -1 ? md.length : endLine + 1;
      }
      continue;
    }

    // Bold+italic (***), bold (**/__), italic (*/_)
    if (md.startsWith('***', i) || md.startsWith('___', i)) { i += 3; continue; }
    if (md.startsWith('**', i) || md.startsWith('__', i)) { i += 2; continue; }
    if ((md[i] === '*' || md[i] === '_') && i + 1 < md.length && /\S/.test(md[i + 1])) {
      i++;
      continue;
    }
    // Closing single emphasis: non-space followed by * or _
    if ((md[i] === '*' || md[i] === '_') && i > 0 && /\S/.test(md[i - 1])) {
      i++;
      continue;
    }

    // Inline code backtick (not fenced)
    if (md[i] === '`' && !md.startsWith('```', i)) {
      i++;
      continue;
    }

    // Heading markers at start of line
    if ((i === 0 || md[i - 1] === '\n') && md[i] === '#') {
      while (i < md.length && md[i] === '#') i++;
      if (i < md.length && md[i] === ' ') i++;
      continue;
    }

    plain.push(md[i]);
    map.push(i);
    i++;
  }
  return { plain: plain.join(''), map };
}

/**
 * Normalize whitespace: collapse runs of whitespace into a single space and trim.
 */
function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Build a normalized-whitespace version of `input` along with a positional map
 * from each character in the normalized string back to an index in `input`.
 */
function buildNormalizedMap(input: string): { str: string; posMap: number[] } {
  const chars: string[] = [];
  const posMap: number[] = [];
  for (let j = 0; j < input.length; j++) {
    if (/\s/.test(input[j])) {
      if (chars.length > 0 && chars[chars.length - 1] !== ' ') {
        chars.push(' ');
        posMap.push(j);
      }
    } else {
      chars.push(input[j]);
      posMap.push(j);
    }
  }
  return { str: chars.join(''), posMap };
}

/**
 * Given raw Markdown and the plain-text the user selected in the browser,
 * find the corresponding span in the raw Markdown (including formatting tokens).
 *
 * Returns { mdSpan, startIdx, endIdx } or null if not found.
 */
function findMarkdownSpan(
  md: string,
  selectedPlain: string,
): { mdSpan: string; startIdx: number; endIdx: number } | null {
  // Fast path: exact match (works when selection has no formatting)
  const directIdx = md.indexOf(selectedPlain);
  if (directIdx !== -1) {
    return { mdSpan: selectedPlain, startIdx: directIdx, endIdx: directIdx + selectedPlain.length };
  }

  // Whitespace-normalized direct match
  const normalizedSel = normalizeWs(selectedPlain);
  const { str: normMd, posMap: normMdMap } = buildNormalizedMap(md);
  const normDirectIdx = normMd.indexOf(normalizedSel);
  if (normDirectIdx !== -1) {
    const mStart = normMdMap[normDirectIdx];
    const mEnd = normMdMap[normDirectIdx + normalizedSel.length - 1] + 1;
    return { mdSpan: md.slice(mStart, mEnd), startIdx: mStart, endIdx: mEnd };
  }

  // Full plain-text mapping (strip formatting tokens)
  const { plain, map } = buildPlainTextMap(md);
  const { str: npStr, posMap: npMap } = buildNormalizedMap(plain);

  const matchIdx = npStr.indexOf(normalizedSel);
  if (matchIdx === -1) return null;

  const plainStart = npMap[matchIdx];
  const plainEnd = npMap[matchIdx + normalizedSel.length - 1];

  if (plainStart >= map.length || plainEnd >= map.length) return null;

  const mdStart = map[plainStart];
  const mdEnd = map[plainEnd] + 1;

  // Expand to cover any trailing formatting tokens (closing ** etc.)
  let expandedEnd = mdEnd;
  while (expandedEnd < md.length && (md[expandedEnd] === '*' || md[expandedEnd] === '_' || md[expandedEnd] === '`')) {
    expandedEnd++;
  }
  // Also expand backwards to capture leading formatting tokens
  let expandedStart = mdStart;
  while (expandedStart > 0 && (md[expandedStart - 1] === '*' || md[expandedStart - 1] === '_' || md[expandedStart - 1] === '`')) {
    expandedStart--;
  }

  return { mdSpan: md.slice(expandedStart, expandedEnd), startIdx: expandedStart, endIdx: expandedEnd };
}

export default function registerEditSection(router: Router): void {
  router.post('/api/edit-section', async (req: Request, res: Response) => {
    const { sessionId, unitIdx, subtopicIdx, selectedText, action } = req.body ?? {};

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }
    if (unitIdx == null || subtopicIdx == null || unitIdx < 0 || subtopicIdx < 0) {
      res.status(400).json({ error: 'Invalid unit or subtopic index' });
      return;
    }
    if (!selectedText || typeof selectedText !== 'string' || selectedText.trim().length < 10) {
      res.status(400).json({ error: 'Selected text too short (min 10 chars)' });
      return;
    }
    if (!VALID_ACTIONS.includes(action)) {
      res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
      return;
    }

    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'markdown_ready') {
      res.status(409).json({ error: `Cannot edit in status: ${session.status}` });
      return;
    }

    const key = `u${unitIdx}-s${subtopicIdx}`;
    const currentMd = session.subtopicMarkdowns.get(key);

    if (!currentMd) {
      res.status(404).json({ error: 'Subtopic not found' });
      return;
    }

    const spanResult = findMarkdownSpan(currentMd, selectedText.trim());
    if (!spanResult) {
      res.status(400).json({ error: 'Selected text not found in subtopic' });
      return;
    }

    const { mdSpan, startIdx, endIdx } = spanResult;

    const versions = session.subtopicVersions.get(key) ?? [];
    versions.push(currentMd);
    if (versions.length > MAX_VERSIONS) versions.shift();
    session.subtopicVersions.set(key, versions);

    try {
      const userPrompt = buildEditSectionPrompt(currentMd, mdSpan, action as EditAction);

      const result = await callLLM({
        model: LIGHT_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 2200,
        temperature: 0.4,
        callLabel: `edit-section ${action} ${key}`,
      });

      incrementCounters(session, result.totalTokens);

      const replacement = result.content.trim();
      const updatedMd = currentMd.slice(0, startIdx) + replacement + currentMd.slice(endIdx);

      session.subtopicMarkdowns.set(key, updatedMd);
      session.finalMarkdown = null;
      session.editCount++;
      session.lastActivityAt = Date.now();
      saveSession(session);

      res.json({
        markdown: updatedMd,
        versionsRemaining: versions.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[EDIT] Failed for ${key} action=${action}: ${msg}`);
      const restored = versions.pop();
      if (restored != null) {
        session.subtopicMarkdowns.set(key, restored);
        session.subtopicVersions.set(key, versions);
      }
      res.status(500).json({ error: msg });
    }
  });
}
