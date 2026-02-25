import { Router, Request, Response } from 'express';
import { getSession, saveSession } from '@/lib/session-store';

export default function registerUndo(router: Router): void {
  router.post('/api/undo', (req: Request, res: Response) => {
    const { sessionId, unitIdx, subtopicIdx } = req.body ?? {};

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }
    if (unitIdx == null || subtopicIdx == null || unitIdx < 0 || subtopicIdx < 0) {
      res.status(400).json({ error: 'Invalid unit or subtopic index' });
      return;
    }

    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'markdown_ready') {
      res.status(409).json({ error: `Cannot undo in status: ${session.status}` });
      return;
    }

    const key = `u${unitIdx}-s${subtopicIdx}`;
    const versions = session.subtopicVersions.get(key);

    if (!versions || versions.length === 0) {
      res.status(404).json({ error: 'No previous versions available' });
      return;
    }

    const restored = versions.pop();
    if (!restored) {
      res.status(404).json({ error: 'No previous versions available' });
      return;
    }
    session.subtopicVersions.set(key, versions);
    session.subtopicMarkdowns.set(key, restored);
    session.finalMarkdown = null;
    session.lastActivityAt = Date.now();
    saveSession(session);

    res.json({
      markdown: restored,
      versionsRemaining: versions.length,
    });
  });
}
