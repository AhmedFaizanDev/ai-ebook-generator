'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { BookStructure } from '@/lib/types';
import { renderMarkdown } from '@/lib/markdownRenderer';

interface BookPreviewProps {
  sessionId: string;
  structure: BookStructure;
  generatedCount: number;
  onJumpToEditor: (unitIdx: number, subtopicIdx: number) => void;
}

interface SubtopicEntry {
  unitIdx: number;
  subtopicIdx: number;
  unitTitle: string;
  subtopicTitle: string;
  markdown: string | null;
  loading: boolean;
}

export default function BookPreview({
  sessionId,
  structure,
  generatedCount,
  onJumpToEditor,
}: BookPreviewProps) {
  const [entries, setEntries] = useState<SubtopicEntry[]>([]);

  const subtopicsPerUnit = structure.units[0]?.subtopics.length ?? 5;

  useEffect(() => {
    const controller = new AbortController();

    const flat: SubtopicEntry[] = [];
    for (let u = 0; u < structure.units.length; u++) {
      const unit = structure.units[u];
      if (!unit) continue;
      for (let s = 0; s < unit.subtopics.length; s++) {
        flat.push({
          unitIdx: u,
          subtopicIdx: s,
          unitTitle: unit.unitTitle,
          subtopicTitle: unit.subtopics[s] ?? `Subtopic ${s + 1}`,
          markdown: null,
          loading: false,
        });
      }
    }
    setEntries(flat);

    flat.forEach((entry, idx) => {
      const flatIdx = entry.unitIdx * subtopicsPerUnit + entry.subtopicIdx;
      if (flatIdx >= generatedCount) return;

      setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, loading: true } : e));

      fetch(`/api/content?sid=${sessionId}&unit=${entry.unitIdx}&subtopic=${entry.subtopicIdx}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const data = await res.json();
          return data.markdown as string;
        })
        .then((md) => {
          if (!controller.signal.aborted) {
            setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, markdown: md, loading: false } : e));
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, loading: false } : e));
          }
        });
    });

    return () => controller.abort();
  }, [sessionId, structure, generatedCount, subtopicsPerUnit]);

  const handleClick = useCallback((unitIdx: number, subtopicIdx: number) => {
    onJumpToEditor(unitIdx, subtopicIdx);
  }, [onJumpToEditor]);

  let currentUnitIdx = -1;

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 32px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{structure.title}</h1>
        <p style={{ fontSize: 14, color: '#71717a', marginBottom: 32 }}>Book Preview &mdash; Click any section to edit</p>

        {entries.map((entry, idx) => {
          const showUnitHeader = entry.unitIdx !== currentUnitIdx;
          if (showUnitHeader) currentUnitIdx = entry.unitIdx;
          const flatIdx = entry.unitIdx * subtopicsPerUnit + entry.subtopicIdx;
          const isGenerated = flatIdx < generatedCount;

          return (
            <div key={`${entry.unitIdx}-${entry.subtopicIdx}`}>
              {showUnitHeader && (
                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e4e4e7', marginTop: 40, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #27272a' }}>
                  Unit {entry.unitIdx + 1}: {entry.unitTitle}
                </h2>
              )}

              <div
                onClick={() => handleClick(entry.unitIdx, entry.subtopicIdx)}
                style={{
                  marginBottom: 24,
                  borderRadius: 8,
                  border: '1px solid #27272a',
                  background: 'rgba(24,24,27,0.5)',
                  cursor: 'pointer',
                  transition: 'border-color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; }}
              >
                <div style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid rgba(39,39,42,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: '#d4d4d8', margin: 0 }}>
                    {entry.subtopicTitle}
                  </h3>
                  <span style={{ fontSize: 12, color: '#71717a' }}>
                    Edit &rarr;
                  </span>
                </div>

                <div style={{ padding: '16px 20px', position: 'relative' }}>
                  {entry.loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#71717a', fontSize: 12 }}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={14}
                        height={14}
                        viewBox="0 0 20 20"
                        fill="none"
                        style={{ width: 14, height: 14 }}
                        className="animate-spin"
                      >
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="36" strokeDashoffset="9" strokeLinecap="round" />
                      </svg>
                      Loading...
                    </div>
                  )}

                  {!isGenerated && !entry.loading && (
                    <p style={{ fontSize: 12, color: '#52525b', fontStyle: 'italic', margin: 0 }}>Not yet generated</p>
                  )}

                  {entry.markdown && !entry.loading && (
                    <>
                      <PreviewArticle markdown={entry.markdown} />
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 48,
                        background: 'linear-gradient(to top, rgba(24,24,27,0.9), transparent)',
                        pointerEvents: 'none',
                      }} />
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PreviewArticle = memo(function PreviewArticle({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  return (
    <article
      className="prose-content"
      style={{ fontSize: 14, maxHeight: 192, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
