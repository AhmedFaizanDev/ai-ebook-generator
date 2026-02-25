import { Router, Request, Response } from 'express';
import { getSession, saveSession, scheduleCleanup } from '@/lib/session-store';

export default function registerDownload(router: Router): void {
  router.get('/api/download', (req: Request, res: Response) => {
    const sid = req.query.sid as string | undefined;
    if (!sid) {
      res.status(400).json({ error: 'Missing sid parameter' });
      return;
    }

    const session = getSession(sid);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const isPartial = req.query.partial === 'true';

    if (!isPartial && session.status !== 'completed' && session.status !== 'downloaded') {
      res.status(409).json({
        error: 'not_ready',
        message: `Session status: ${session.status}`,
      });
      return;
    }

    if (!session.pdfBuffer) {
      res.status(404).json({ error: 'no_pdf', message: 'PDF not available' });
      return;
    }

    session.status = 'downloaded';
    saveSession(session);

    const title = session.structure?.title ?? 'ebook';
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);

    scheduleCleanup(sid, 300_000);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      'Content-Length': String(session.pdfBuffer.length),
    });
    res.send(session.pdfBuffer);
  });
}
