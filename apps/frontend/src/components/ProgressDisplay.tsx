'use client';

import { useEffect, useState, useRef } from 'react';
import { ProgressEvent, SessionStatus } from '@/lib/types';

const STUCK_THRESHOLD_SEC = 90;

interface ProgressDisplayProps {
  sessionId: string;
  onComplete: () => void;
  onFailed: (error: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  init: 'Initializing...',
  structure: 'Generating book structure...',
  preface: 'Writing preface...',
  capstones: 'Writing capstone projects...',
  'case-studies': 'Writing case studies...',
  glossary: 'Generating glossary...',
  bibliography: 'Compiling bibliography...',
  assembly: 'Assembling final document...',
  pdf: 'Generating PDF...',
};

function getPhaseLabel(phase: string): string {
  if (phase.match(/^unit-\d+-intro$/)) {
    const num = phase.replace('unit-', '').replace('-intro', '');
    return `Writing Unit ${num} introduction...`;
  }
  if (phase.match(/^unit-\d+-summary$/)) {
    const num = phase.replace('unit-', '').replace('-summary', '');
    return `Writing Unit ${num} summary...`;
  }
  if (phase.match(/^unit-\d+-exercises$/)) {
    const num = phase.replace('unit-', '').replace('-exercises', '');
    return `Generating Unit ${num} exercises...`;
  }
  if (phase.startsWith('unit-')) {
    const num = phase.replace('unit-', '');
    return `Writing Unit ${num}...`;
  }
  return PHASE_LABELS[phase] ?? phase;
}

function formatLastActivity(lastActivityAt?: number): string {
  if (lastActivityAt == null) return '—';
  const sec = Math.floor((Date.now() - lastActivityAt) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s ago`;
}

export default function ProgressDisplay({ sessionId, onComplete, onFailed }: ProgressDisplayProps) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastPhaseRef = useRef<string>('');

  useEffect(() => {
    const es = new EventSource(`/api/progress?sid=${sessionId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setProgress(data);

        if (data.phase !== lastPhaseRef.current) {
          lastPhaseRef.current = data.phase;
          const label = getPhaseLabel(data.phase);
          setLogs((prev) => [...prev.slice(-20), `[${data.percent}%] ${label}`]);
        }

        if (data.status === 'completed') {
          es.close();
          onComplete();
        } else if (data.status === 'failed') {
          es.close();
          onFailed(data.error ?? 'Unknown error');
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [sessionId, onComplete, onFailed]);

  const percent = progress?.percent ?? 0;
  const phase = progress?.phase ?? 'init';
  const unit = progress?.unit ?? 0;
  const subtopic = progress?.subtopic ?? 0;
  const lastActivityAt = progress?.lastActivityAt;
  const callCount = progress?.callCount;
  const tokenCount = progress?.tokenCount;
  const status = progress?.status ?? '';

  const secondsSinceActivity =
    lastActivityAt != null ? Math.floor((Date.now() - lastActivityAt) / 1000) : 0;
  const isStuck =
    status === 'generating' && lastActivityAt != null && secondsSinceActivity >= STUCK_THRESHOLD_SEC;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'generating') return;
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [status]);

  return (
    <div className="w-full max-w-xl space-y-6">
      <div>
        <div className="flex justify-between text-sm text-zinc-400 mb-2">
          <span>{getPhaseLabel(phase)}</span>
          <span>{percent}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {unit > 0 && (
        <div className="flex gap-6 text-sm text-zinc-400">
          <span>
            Unit: <span className="text-white font-mono">{unit}</span>
          </span>
          <span>
            Subtopic: <span className="text-white font-mono">{subtopic}</span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        <span title="Server last reported progress at this time">
          Last activity: {formatLastActivity(lastActivityAt)}
        </span>
        {typeof callCount === 'number' && (
          <span>LLM calls: <span className="font-mono text-zinc-400">{callCount}</span></span>
        )}
        {typeof tokenCount === 'number' && (
          <span>Tokens: <span className="font-mono text-zinc-400">{tokenCount.toLocaleString()}</span></span>
        )}
      </div>

      {isStuck && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
          <strong>Generation may be stuck</strong> — no update for {Math.floor(secondsSinceActivity / 60)}m. Check server logs (phase, unit, subtopic) or try again later.
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-xs text-zinc-500 space-y-1">
        {logs.length === 0 && <p>Starting generation...</p>}
        {logs.map((log, i) => (
          <p key={i}>{log}</p>
        ))}
      </div>

      <p className="text-xs text-zinc-600 text-center">
        Estimated time: 4-8 minutes depending on rate limits
      </p>
    </div>
  );
}
