import { Router, Request, Response } from 'express';
import { createSession, saveSession } from '@/lib/session-store';
import { orchestrate } from '@/orchestrator/index';

export default function registerGenerate(router: Router): void {
  router.post('/api/generate', (req: Request, res: Response) => {
    const body = req.body as { topic?: string; model?: string } | undefined;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }

    const topic = body.topic?.trim();
    if (!topic || topic.length < 3) {
      res.status(400).json({
        error: 'invalid_topic',
        message: 'Topic must be at least 3 characters.',
      });
      return;
    }

    const model = body.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const session = createSession(topic, model);

    if (!session) {
      res.status(503).set('Retry-After', '60').json({
        error: 'server_busy',
        message: 'Max concurrent generations reached. Try again shortly.',
      });
      return;
    }

    orchestrate(session).catch((err) => {
      console.error(`[orchestrate] session ${session.id} fatal:`, err);
      if (session.status !== 'failed') {
        session.status = 'failed';
        session.error = err instanceof Error ? err.message : String(err);
        saveSession(session);
      }
    });

    res.status(202).json({ sessionId: session.id });
  });
}
