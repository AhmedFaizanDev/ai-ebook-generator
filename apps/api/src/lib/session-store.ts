import { SessionState } from '@/lib/types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const sessionMap = new Map<string, SessionState>();

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '3', 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS ?? '1800000', 10);

const SESSIONS_DIR = path.resolve(process.cwd(), '.sessions');

function ensureDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionFilePath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

interface SerializedSession extends Omit<SessionState, 'subtopicMarkdowns' | 'subtopicVersions' | 'pdfBuffer'> {
  subtopicMarkdowns: [string, string][];
  subtopicVersions: [string, string[]][];
  pdfBufferBase64: string | null;
}

function serialize(session: SessionState): string {
  const { subtopicMarkdowns, subtopicVersions, pdfBuffer, ...rest } = session;
  const obj = {
    ...rest,
    subtopicMarkdowns: Array.from(subtopicMarkdowns.entries()),
    subtopicVersions: Array.from(subtopicVersions.entries()),
    pdfBufferBase64: pdfBuffer ? pdfBuffer.toString('base64') : null,
  };
  return JSON.stringify(obj);
}

function deserialize(raw: string): SessionState {
  const obj = JSON.parse(raw) as Partial<SerializedSession>;
  const subtopicMarkdowns = Array.isArray(obj.subtopicMarkdowns) ? obj.subtopicMarkdowns : [];
  const subtopicVersions = Array.isArray(obj.subtopicVersions) ? obj.subtopicVersions : [];
  const pdfBufferBase64 = typeof obj.pdfBufferBase64 === 'string' ? obj.pdfBufferBase64 : null;
  const { subtopicMarkdowns: _m, subtopicVersions: _v, pdfBufferBase64: _b, ...rest } = obj as SerializedSession;
  const session = {
    ...rest,
    unitIntroductions: Array.isArray(rest.unitIntroductions) ? rest.unitIntroductions : [],
    unitEndSummaries: Array.isArray(rest.unitEndSummaries) ? rest.unitEndSummaries : [],
    unitExercises: Array.isArray(rest.unitExercises) ? rest.unitExercises : [],
    glossaryMarkdown: rest.glossaryMarkdown ?? null,
    subtopicMarkdowns: new Map(subtopicMarkdowns),
    subtopicVersions: new Map(subtopicVersions),
    pdfBuffer: pdfBufferBase64 ? Buffer.from(pdfBufferBase64, 'base64') : null,
  } as SessionState;
  return session;
}

function persistSession(session: SessionState): void {
  try {
    ensureDir();
    fs.writeFileSync(sessionFilePath(session.id), serialize(session), 'utf-8');
  } catch (err) {
    console.error(`[session-store] Failed to persist session ${session.id}:`, err);
  }
}

function removePersisted(id: string): void {
  try {
    const fp = sessionFilePath(id);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    // ignore cleanup errors
  }
}

function loadPersistedSessions(): void {
  try {
    ensureDir();
    const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    let loaded = 0;
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
        const session = deserialize(raw);

        if (session.status === 'generating' || session.status === 'queued') {
          session.status = 'failed';
          session.error = 'Server restarted during generation';
        }

        session.lastActivityAt = Date.now();
        sessionMap.set(session.id, session);
        loaded++;
      } catch (err) {
        console.error(`[session-store] Failed to load ${file}:`, err);
      }
    }
    if (loaded > 0) {
      console.log(`[session-store] Restored ${loaded} session(s) from disk`);
    }
  } catch {
    // fresh start
  }
}

loadPersistedSessions();

function canAcceptSession(): boolean {
  let active = 0;
  sessionMap.forEach((s) => {
    if (s.status === 'generating' || s.status === 'queued') active++;
  });
  return active < MAX_CONCURRENT;
}

export function createSession(topic: string, model: string): SessionState | null {
  if (!canAcceptSession()) return null;

  const session: SessionState = {
    id: crypto.randomUUID(),
    status: 'queued',
    topic,
    model,
    phase: 'init',
    progress: 0,
    currentUnit: 0,
    currentSubtopic: 0,
    structure: null,
    unitMarkdowns: [],
    microSummaries: [],
    unitSummaries: [],
    prefaceMarkdown: null,
    unitIntroductions: [],
    unitEndSummaries: [],
    unitExercises: [],
    capstonesMarkdown: null,
    caseStudiesMarkdown: null,
    glossaryMarkdown: null,
    bibliographyMarkdown: null,
    finalMarkdown: null,
    pdfBuffer: null,
    error: null,
    callCount: 0,
    tokenCount: 0,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    subtopicMarkdowns: new Map(),
    subtopicVersions: new Map(),
    editCount: 0,
  };

  sessionMap.set(session.id, session);
  persistSession(session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessionMap.get(id);
}

export function saveSession(session: SessionState): void {
  persistSession(session);
}

export function deleteSession(id: string): void {
  const session = sessionMap.get(id);
  if (session) {
    session.pdfBuffer = null;
    session.finalMarkdown = null;
    session.unitMarkdowns = [];
    session.microSummaries = [];
    session.unitSummaries = [];
    session.prefaceMarkdown = null;
    session.unitIntroductions = [];
    session.unitEndSummaries = [];
    session.unitExercises = [];
    session.capstonesMarkdown = null;
    session.caseStudiesMarkdown = null;
    session.glossaryMarkdown = null;
    session.bibliographyMarkdown = null;
    session.structure = null;
    session.subtopicMarkdowns.clear();
    session.subtopicVersions.clear();
  }
  sessionMap.delete(id);
  removePersisted(id);
}

export function scheduleCleanup(id: string, delayMs: number = 300_000): void {
  setTimeout(() => deleteSession(id), delayMs);
}

function sweepStaleSessions(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  sessionMap.forEach((session, id) => {
    if (session.status === 'generating' || session.status === 'queued') return;

    const age = now - session.lastActivityAt;
    if (age > SESSION_TTL_MS) {
      toDelete.push(id);
    }
  });
  toDelete.forEach((id) => deleteSession(id));
}

setInterval(sweepStaleSessions, 60_000);
