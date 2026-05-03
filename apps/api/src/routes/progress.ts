import { Router, Request, Response } from 'express';
import { getSession } from '@/lib/session-store';
import { TOTAL_SUBTOPICS, SUBTOPICS_PER_UNIT, UNIT_COUNT } from '@/lib/config';
import { ProgressEvent, SessionState, BookStructure } from '@/lib/types';

/**
 * Returns the number of subtopics whose generation has finished. When a real
 * `BookStructure` is present (CSV-driven batch or completed AI-driven web flow),
 * we walk the actual per-unit subtopic counts. We fall back to the legacy fixed
 * 10×6 math only when no structure is available yet (early in the web flow).
 */
function computeGeneratedCount(session: Pick<SessionState,
  'currentUnit' | 'currentSubtopic' | 'unitMarkdowns' | 'status' | 'structure'
>): number {
  const structure = session.structure ?? null;
  const totalSubs = computeTotalSubtopics(structure);

  if (
    session.status === 'completed' ||
    session.status === 'downloaded' ||
    session.status === 'markdown_ready' ||
    session.status === 'exporting_pdf'
  ) return totalSubs;

  let count = 0;
  for (let u = 0; u < session.unitMarkdowns.length; u++) {
    if (session.unitMarkdowns[u] != null) {
      count += subtopicCountForUnit(structure, u);
    }
  }

  const inProgressUnit = session.currentUnit - 1;
  const unitCount = structure?.units.length ?? UNIT_COUNT;
  if (inProgressUnit >= 0 && inProgressUnit < unitCount && session.unitMarkdowns[inProgressUnit] == null) {
    count += Math.max(0, session.currentSubtopic - 1);
  }

  return Math.min(count, totalSubs);
}

function computeTotalSubtopics(structure: BookStructure | null): number {
  if (!structure || !Array.isArray(structure.units) || structure.units.length === 0) {
    return TOTAL_SUBTOPICS;
  }
  let n = 0;
  for (const u of structure.units) n += u.subtopics?.length ?? 0;
  return Math.max(1, n);
}

function subtopicCountForUnit(structure: BookStructure | null, unitIdx: number): number {
  const u = structure?.units[unitIdx];
  if (u && Array.isArray(u.subtopics) && u.subtopics.length > 0) return u.subtopics.length;
  return SUBTOPICS_PER_UNIT;
}

export default function registerProgress(router: Router): void {
  // SSE stream endpoint
  router.get('/api/progress', (req: Request, res: Response) => {
    const sid = req.query.sid as string | undefined;
    if (!sid) {
      res.status(400).send('Missing sid parameter');
      return;
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.flushHeaders();

    let structureSent = false;
    let closed = false;

    const intervalId = setInterval(() => {
      if (closed) return;

      const session = getSession(sid);

      if (session) {
        session.lastActivityAt = Date.now();
      }

      if (!session) {
        const data: ProgressEvent = {
          phase: 'error',
          unit: 0,
          subtopic: 0,
          percent: 0,
          status: 'failed',
          error: 'Session not found',
        };
        try {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
          res.end();
        } catch { /* client disconnected */ }
        closed = true;
        clearInterval(intervalId);
        return;
      }

      const data: ProgressEvent = {
        phase: session.phase,
        unit: session.currentUnit,
        subtopic: session.currentSubtopic,
        percent: Math.round(session.progress),
        status: session.status,
        error: session.error ?? undefined,
        lastActivityAt: session.lastActivityAt,
        callCount: session.callCount,
        tokenCount: session.tokenCount,
        generatedCount: computeGeneratedCount(session),
        editCount: session.editCount,
      };

      if (session.structure && !structureSent) {
        data.structure = session.structure;
        structureSent = true;
      }

      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        closed = true;
        clearInterval(intervalId);
        return;
      }

      if (session.status === 'completed' || session.status === 'failed' || session.status === 'downloaded') {
        closed = true;
        clearInterval(intervalId);
        try { res.end(); } catch { /* already closed */ }
      }
    }, 500);

    req.on('close', () => {
      closed = true;
      clearInterval(intervalId);
    });
  });

  // Polling endpoint
  router.get('/api/progress/poll', (req: Request, res: Response) => {
    const sid = req.query.sid as string | undefined;
    if (!sid) {
      res.status(400).json({ error: 'Missing sid' });
      return;
    }

    const session = getSession(sid);
    if (!session) {
      const data: ProgressEvent = {
        phase: 'error',
        unit: 0,
        subtopic: 0,
        percent: 0,
        status: 'failed',
        error: 'Session not found',
      };
      res.json(data);
      return;
    }

    session.lastActivityAt = Date.now();

    const data: ProgressEvent = {
      phase: session.phase,
      unit: session.currentUnit,
      subtopic: session.currentSubtopic,
      percent: Math.round(session.progress),
      status: session.status,
      error: session.error ?? undefined,
      lastActivityAt: session.lastActivityAt,
      callCount: session.callCount,
      tokenCount: session.tokenCount,
      generatedCount: computeGeneratedCount(session),
      editCount: session.editCount,
      structure: session.structure ?? undefined,
    };

    res.json(data);
  });
}
