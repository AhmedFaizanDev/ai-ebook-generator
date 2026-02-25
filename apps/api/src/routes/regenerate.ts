import { Router, Request, Response } from 'express';
import { getSession, saveSession } from '@/lib/session-store';
import { generateSubtopic } from '@/orchestrator/generate-subtopic';

const MAX_VERSIONS = 5;

export default function registerRegenerate(router: Router): void {
  router.post('/api/regenerate', async (req: Request, res: Response) => {
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
      res.status(409).json({ error: `Cannot regenerate in status: ${session.status}` });
      return;
    }

    const key = `u${unitIdx}-s${subtopicIdx}`;
    const currentMd = session.subtopicMarkdowns.get(key);

    if (!currentMd) {
      res.status(404).json({ error: 'Subtopic not found' });
      return;
    }

    const versions = session.subtopicVersions.get(key) ?? [];
    versions.push(currentMd);
    if (versions.length > MAX_VERSIONS) versions.shift();
    session.subtopicVersions.set(key, versions);

    if (!session.structure || !session.structure.units[unitIdx]) {
      res.status(500).json({ error: 'Session structure is missing or invalid' });
      return;
    }

    try {
      const unit = session.structure.units[unitIdx];
      const subtopicTitle = unit.subtopics[subtopicIdx];
      if (!subtopicTitle) {
        res.status(404).json({ error: 'Subtopic not found in structure' });
        return;
      }

      const newMd = await generateSubtopic(
        {
          topic: session.topic,
          unitTitle: unit.unitTitle,
          subtopicTitle,
          unitIndex: unitIdx,
          subtopicIndex: subtopicIdx,
          prevUnitSummary: null,
          prevSubtopicSummary: null,
          model: session.model,
        },
        session,
      );

      session.subtopicMarkdowns.set(key, newMd);
      session.finalMarkdown = null;
      session.editCount++;
      session.lastActivityAt = Date.now();
      saveSession(session);

      res.json({
        markdown: newMd,
        versionsRemaining: versions.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[REGEN] Failed for ${key}: ${msg}`);
      const restored = versions.pop();
      if (restored != null) {
        session.subtopicMarkdowns.set(key, restored);
        session.subtopicVersions.set(key, versions);
      }
      res.status(500).json({ error: msg });
    }
  });
}
