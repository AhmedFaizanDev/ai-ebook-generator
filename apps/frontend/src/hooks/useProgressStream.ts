'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BookStructure, ProgressEvent, SessionStatus } from '@/lib/types';

export interface ProgressState {
  phase: string;
  unit: number;
  subtopic: number;
  percent: number;
  status: SessionStatus | null;
  error: string | null;
  lastActivityAt: number | null;
  callCount: number;
  tokenCount: number;
  structure: BookStructure | null;
  generatedCount: number;
  editCount: number;
}

const INITIAL: ProgressState = {
  phase: 'init',
  unit: 0,
  subtopic: 0,
  percent: 0,
  status: null,
  error: null,
  lastActivityAt: null,
  callCount: 0,
  tokenCount: 0,
  structure: null,
  generatedCount: 0,
  editCount: 0,
};

const POLL_INTERVAL_MS = 2000;
const TERMINAL_POLL_INTERVAL_MS = 10000;

function isRealTerminal(data: ProgressEvent): boolean {
  if (data.status === 'completed' || data.status === 'downloaded') return true;
  if (data.status === 'failed' && data.error !== 'Session not found') return true;
  return false;
}

function hasStateChanged(prev: ProgressState, data: ProgressEvent): boolean {
  if (data.status !== prev.status) return true;
  if (data.phase !== prev.phase) return true;
  if (data.unit !== prev.unit) return true;
  if (data.subtopic !== prev.subtopic) return true;
  if (data.percent !== prev.percent) return true;
  if ((data.generatedCount ?? prev.generatedCount) !== prev.generatedCount) return true;
  if ((data.callCount ?? prev.callCount) !== prev.callCount) return true;
  if ((data.tokenCount ?? prev.tokenCount) !== prev.tokenCount) return true;
  if ((data.editCount ?? prev.editCount) !== prev.editCount) return true;
  if (data.structure && !prev.structure) return true;
  if (data.error && data.error !== prev.error) return true;
  return false;
}

function applyEvent(prev: ProgressState, data: ProgressEvent): ProgressState {
  if (!hasStateChanged(prev, data)) {
    return prev;
  }
  return {
    phase: data.phase,
    unit: data.unit,
    subtopic: data.subtopic,
    percent: data.percent,
    status: data.status,
    error: data.error ?? null,
    lastActivityAt: data.lastActivityAt ?? prev.lastActivityAt,
    callCount: data.callCount ?? prev.callCount,
    tokenCount: data.tokenCount ?? prev.tokenCount,
    structure: data.structure ?? prev.structure,
    generatedCount: data.generatedCount ?? prev.generatedCount,
    editCount: data.editCount ?? prev.editCount,
  };
}

export function useProgressStream(sessionId: string | null) {
  const [state, setState] = useState<ProgressState>(INITIAL);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => {
    setState(INITIAL);
    terminalRef.current = false;
    stateRef.current = INITIAL;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    terminalRef.current = false;

    const es = new EventSource(`/api/progress?sid=${sessionId}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setState((prev) => applyEvent(prev, data));

        if (isRealTerminal(data)) {
          terminalRef.current = true;
          es.close();
          esRef.current = null;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    async function doPoll() {
      if (terminalRef.current) return;

      try {
        const url = `/api/progress/poll?sid=${sessionId}&_=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data: ProgressEvent = await res.json();

        setState((prev) => applyEvent(prev, data));

        if (isRealTerminal(data)) {
          terminalRef.current = true;
          if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
          }
          return;
        }
      } catch {
        // polling fetch failed — will retry next interval
      }

      const isSettled =
        stateRef.current.status === 'markdown_ready' ||
        stateRef.current.status === 'completed' ||
        stateRef.current.status === 'downloaded';
      const nextInterval = isSettled ? TERMINAL_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
      pollRef.current = setTimeout(doPoll, nextInterval);
    }

    doPoll();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sessionId]);

  return { ...state, reset };
}
