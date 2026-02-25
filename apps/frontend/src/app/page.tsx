'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import GeneratorForm from '@/components/GeneratorForm';
import SyllabusPhase from '@/components/SyllabusPhase';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { useProgressStream } from '@/hooks/useProgressStream';

type AppState = 'idle' | 'generating' | 'failed';

function HomeFallback() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">AI Ebook Generator</h1>
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    </main>
  );
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const invalidSessionIdRef = useRef<string | null>(null);

  const [appState, setAppState] = useState<AppState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const progress = useProgressStream(sessionId);

  if (!sessionId) invalidSessionIdRef.current = null;

  // Restore session from URL when you return to the page (refresh, bookmark, or same tab later)
  useEffect(() => {
    const sidFromUrl = searchParams.get('sid');
    if (!sidFromUrl?.trim() || sessionId) return;
    if (sidFromUrl.trim() === invalidSessionIdRef.current) return;
    setSessionId(sidFromUrl.trim());
    setAppState('generating');
  }, [searchParams, sessionId]);

  // Keep URL in sync with session so the link is shareable and survives refresh
  useEffect(() => {
    if (!sessionId) return;
    const currentSid = searchParams.get('sid');
    if (currentSid === sessionId) return;
    router.replace(`${pathname}?sid=${encodeURIComponent(sessionId)}`, { scroll: false });
  }, [sessionId, pathname, router, searchParams]);

  // When restoring from URL, fill in topic from structure once we have it
  useEffect(() => {
    if (sessionId && progress.structure?.title && !topic) {
      setTopic(progress.structure.title);
    }
  }, [sessionId, progress.structure?.title, topic]);

  // If we restored from URL but the session is gone on the server, go back to home
  useEffect(() => {
    if (!sessionId) return;
    if (progress.status === 'failed' && progress.error === 'Session not found') {
      invalidSessionIdRef.current = sessionId;
      setSessionId(null);
      setAppState('idle');
      setError('Session expired or not found. Start a new book below.');
      progress.reset();
      if (searchParams.get('sid')) router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, progress.status, progress.error, pathname, router, searchParams]);

  const handleGenerate = useCallback(async (inputTopic: string, model: string) => {
    setAppState('generating');
    setError(null);
    setTopic(inputTopic);
    setSessionId(null);
    progress.reset();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: inputTopic, model }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error: ${res.status}`);
      }

      const result = await res.json();
      const sid = result?.sessionId;
      if (!sid || typeof sid !== 'string') {
        throw new Error('Server returned invalid session ID');
      }
      setSessionId(sid);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setAppState('failed');
    }
  }, [progress]);

  const handleReset = useCallback(() => {
    setAppState('idle');
    setSessionId(null);
    setTopic('');
    setError(null);
    progress.reset();
    if (searchParams.get('sid')) {
      router.replace(pathname, { scroll: false });
    }
  }, [progress, pathname, router, searchParams]);

  const hasStructure = progress.structure != null;
  const isActive = appState === 'generating' && sessionId != null;
  const showWorkspace = isActive && hasStructure;

  // A real failure is either a local fetch error or a backend failure that isn't just
  // a stale "Session not found" from a reconnecting SSE after server restart.
  const hasRealFailure =
    appState === 'failed' ||
    (isActive && progress.status === 'failed' && progress.error !== 'Session not found');

  // Show syllabus whenever we're active but don't have the workspace yet and haven't truly failed
  const showSyllabus = isActive && !hasStructure && !hasRealFailure;

  if (showWorkspace && progress.structure) {
    return (
      <>
        <WorkspaceLayout
          sessionId={sessionId!}
          structure={progress.structure}
          currentUnit={progress.unit}
          currentSubtopic={progress.subtopic}
          generatedCount={progress.generatedCount}
          status={progress.status}
          callCount={progress.callCount}
          tokenCount={progress.tokenCount}
          lastActivityAt={progress.lastActivityAt}
          editCount={progress.editCount}
        />
        {progress.status === 'failed' && (
          <FailedOverlay
            error={progress.error}
            sessionId={sessionId}
            onReset={handleReset}
          />
        )}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">AI Ebook Generator</h1>
        <p className="text-zinc-500 text-sm">
          Generate ~250-page structured technical ebooks using AI
        </p>
      </div>

      {appState === 'idle' && error && (
        <div className="mb-4 max-w-xl w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm text-center">
          {error}
        </div>
      )}
      {appState === 'idle' && (
        <GeneratorForm onGenerate={handleGenerate} disabled={false} />
      )}

      {showSyllabus && <SyllabusPhase topic={topic} phase={progress.phase} percent={progress.percent} />}

      {appState === 'generating' && !sessionId && (
        <div className="text-zinc-400 text-sm">Starting generation...</div>
      )}

      {hasRealFailure && !showWorkspace && (
        <div className="w-full max-w-xl text-center space-y-4">
          <div className="p-6 bg-zinc-900 border border-red-800 rounded-lg">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Generation Failed</h2>
            <p className="text-sm text-zinc-400 mb-4">
              {error ?? progress.error ?? 'An unknown error occurred.'}
            </p>
            {sessionId && (
              <button
                onClick={() => window.open(`/api/download?sid=${sessionId}&partial=true`, '_blank')}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors mb-4 block mx-auto"
              >
                Download partial content (if available)
              </button>
            )}
          </div>
          <button
            onClick={handleReset}
            className="py-3 px-6 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

function FailedOverlay({
  error,
  sessionId,
  onReset,
}: {
  error: string | null;
  sessionId: string | null;
  onReset: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-red-800 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        <h2 className="text-xl font-semibold text-red-400 mb-3">Generation Failed</h2>
        <p className="text-sm text-zinc-400 mb-5">{error ?? 'An unknown error occurred.'}</p>
        <div className="flex items-center justify-center gap-3">
          {sessionId && (
            <button
              onClick={() => window.open(`/api/download?sid=${sessionId}&partial=true`, '_blank')}
              className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 border border-zinc-700 rounded-lg transition-colors"
            >
              Download Partial
            </button>
          )}
          <button
            onClick={onReset}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
