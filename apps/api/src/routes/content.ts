import { Router, Request, Response } from 'express';
import { getSession } from '@/lib/session-store';

function splitUnitMarkdownBySubtopic(unitMarkdown: string): string[] {
  const segments: string[] = [];
  const lines = unitMarkdown.split('\n');
  let current: string[] = [];

  for (const line of lines) {
    if (/^## /.test(line) && current.length > 0) {
      segments.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    segments.push(current.join('\n').trim());
  }

  return segments.filter((s) => s.length > 0);
}

export default function registerContent(router: Router): void {
  router.get('/api/content', (req: Request, res: Response) => {
    const sid = req.query.sid as string | undefined;
    const unitParam = req.query.unit as string | undefined;
    const subtopicParam = req.query.subtopic as string | undefined;

    if (!sid || unitParam == null || subtopicParam == null) {
      res.status(400).json({ error: 'Missing sid, unit, or subtopic' });
      return;
    }

    const unitIdx = parseInt(unitParam, 10);
    const subIdx = parseInt(subtopicParam, 10);

    if (isNaN(unitIdx) || isNaN(subIdx) || unitIdx < 0 || subIdx < 0) {
      res.status(400).json({ error: 'Invalid unit or subtopic index' });
      return;
    }

    const session = getSession(sid);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    session.lastActivityAt = Date.now();

    const structure = session.structure;
    if (structure) {
      if (unitIdx >= structure.units.length) {
        res.status(400).json({ error: 'Unit index out of range' });
        return;
      }
      const unit = structure.units[unitIdx];
      if (unit && subIdx >= unit.subtopics.length) {
        res.status(400).json({ error: 'Subtopic index out of range' });
        return;
      }
    }

    const key = `u${unitIdx}-s${subIdx}`;
    const versions = session.subtopicVersions.get(key);

    const directMd = session.subtopicMarkdowns.get(key);
    if (directMd) {
      res.json({
        markdown: directMd,
        versionsRemaining: versions?.length ?? 0,
      });
      return;
    }

    const unitMd = session.unitMarkdowns[unitIdx];
    if (!unitMd) {
      res.status(404).json({ error: 'Content not yet generated' });
      return;
    }

    const segments = splitUnitMarkdownBySubtopic(unitMd);
    if (subIdx >= segments.length) {
      res.status(404).json({ error: 'Subtopic segment not found' });
      return;
    }

    res.json({
      markdown: segments[subIdx],
      versionsRemaining: versions?.length ?? 0,
    });
  });
}
