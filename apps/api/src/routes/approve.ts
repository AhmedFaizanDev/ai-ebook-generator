import { Router, Request, Response } from 'express';
import { getSession, saveSession } from '@/lib/session-store';
import { rebuildFinalMarkdown } from '@/orchestrator/build-markdown';
import { exportPDF } from '@/pdf/generate-pdf';

export default function registerApprove(router: Router): void {
  router.post('/api/approve', (req: Request, res: Response) => {
    const sid = (req.body as { sessionId?: string })?.sessionId;

    if (!sid || typeof sid !== 'string') {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const session = getSession(sid);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status !== 'markdown_ready') {
      res.status(409).json({
        error: `Session is not ready for PDF. Current status: ${session.status}`,
      });
      return;
    }

    if (!session.structure) {
      res.status(500).json({ error: 'Session structure is missing' });
      return;
    }

    try {
      session.finalMarkdown = rebuildFinalMarkdown(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[APPROVE] rebuildFinalMarkdown failed: ${msg}`);
      res.status(500).json({ error: 'Failed to rebuild markdown' });
      return;
    }

    if (!session.finalMarkdown || session.finalMarkdown.trim().length === 0) {
      res.status(500).json({ error: 'No markdown content available' });
      return;
    }

    session.status = 'exporting_pdf';
    session.phase = 'pdf';
    saveSession(session);

    exportPDF(session)
      .then(() => {
        session.progress = 100;
        session.status = 'completed';
        session.lastActivityAt = Date.now();
        console.log(`[PDF] Session ${sid} PDF export completed`);
        saveSession(session);
      })
      .catch((err) => {
        session.status = 'failed';
        session.error = err instanceof Error ? err.message : String(err);
        session.lastActivityAt = Date.now();
        console.error(`[PDF] Session ${sid} PDF export failed: ${session.error}`);
        saveSession(session);
      });

    res.status(202).json({ status: 'exporting_pdf' });
  });
}
