'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface SubtopicContentState {
  markdown: string | null;
  loading: boolean;
  error: string | null;
  versionsRemaining: number;
}

const contentCache = new Map<string, { markdown: string; versionsRemaining: number }>();

function cacheKey(sid: string, unit: number, subtopic: number): string {
  return `${sid}:u${unit}-s${subtopic}`;
}

export function useSubtopicContent(
  sessionId: string | null,
  unit: number | null,
  subtopic: number | null,
  enabled: boolean,
) {
  const [state, setState] = useState<SubtopicContentState>({
    markdown: null,
    loading: false,
    error: null,
    versionsRemaining: 0,
  });

  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => {
    if (!sessionId || unit == null || subtopic == null || !enabled) {
      setState((prev) => (prev.loading ? { markdown: null, loading: false, error: null, versionsRemaining: 0 } : prev));
      return;
    }

    const key = cacheKey(sessionId, unit, subtopic);
    const cached = contentCache.get(key);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (cached) {
      setState({ markdown: cached.markdown, loading: false, error: null, versionsRemaining: cached.versionsRemaining });
    } else {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    fetch(`/api/content?sid=${sessionId}&unit=${unit}&subtopic=${subtopic}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: { markdown: string; versionsRemaining?: number }) => {
        if (controller.signal.aborted) return;
        const entry = { markdown: data.markdown, versionsRemaining: data.versionsRemaining ?? 0 };
        contentCache.set(key, entry);
        setState({
          markdown: entry.markdown,
          loading: false,
          error: null,
          versionsRemaining: entry.versionsRemaining,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (cached) return;
        setState({
          markdown: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          versionsRemaining: 0,
        });
      });
  }, [sessionId, unit, subtopic, enabled]);

  useEffect(() => {
    refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  const updateContent = useCallback((markdown: string, versionsRemaining: number) => {
    setState((prev) => ({ ...prev, markdown, versionsRemaining }));
    if (sessionId && unit != null && subtopic != null) {
      contentCache.set(cacheKey(sessionId, unit, subtopic), { markdown, versionsRemaining });
    }
  }, [sessionId, unit, subtopic]);

  return { ...state, refetch, updateContent };
}
