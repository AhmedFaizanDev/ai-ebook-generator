import { Router, Request, Response } from 'express';
import { getSession } from '@/lib/session-store';
import { TOTAL_SUBTOPICS, SUBTOPICS_PER_UNIT, UNIT_COUNT } from '@/lib/config';
import { ProgressEvent } from '@/lib/types';

function computeGeneratedCount(session: {
  currentUnit: number;
  currentSubtopic: number;
  unitMarkdowns: (string | null)[];
  status: string;
}): number {
  if (
    session.status === 'completed' ||
    session.status === 'downloaded' ||
    session.status === 'markdown_ready' ||
    session.status === 'exporting_pdf'
  ) return TOTAL_SUBTOPICS;

  let count = 0;
  for (let u = 0; u < session.unitMarkdowns.length; u++) {
    if (session.unitMarkdowns[u] != null) {
      count += SUBTOPICS_PER_UNIT;
    }
  }

  const inProgressUnit = session.currentUnit - 1;
  if (inProgressUnit >= 0 && inProgressUnit < UNIT_COUNT && session.unitMarkdowns[inProgressUnit] == null) {
    count += Math.max(0, session.currentSubtopic - 1);
  }

  return Math.min(count, TOTAL_SUBTOPICS);
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
