'use client';

import { useState, useEffect } from 'react';
import { BookStructure, SessionStatus } from '@/lib/types';

interface NavigatorProps {
  structure: BookStructure;
  currentUnit: number;
  currentSubtopic: number;
  generatedCount: number;
  selectedUnit: number | null;
  selectedSubtopic: number | null;
  onSelectSubtopic: (unit: number, subtopic: number) => void;
  status: SessionStatus | null;
  viewMode: 'editor' | 'preview';
  onToggleViewMode: () => void;
  editCount: number;
  onApprove: () => void;
  onExport: () => void;
  onTogglePanel: () => void;
  showPanel: boolean;
}

type SubtopicStatus = 'done' | 'generating' | 'pending';

function getSubtopicStatus(
  unitIdx: number,
  subIdx: number,
  currentUnit: number,
  currentSubtopic: number,
  generatedCount: number,
  subtopicsPerUnit: number,
): SubtopicStatus {
  const flatIdx = unitIdx * subtopicsPerUnit + subIdx;
  if (flatIdx < generatedCount) return 'done';
  if (unitIdx === currentUnit - 1 && subIdx === currentSubtopic - 1) return 'generating';
  return 'pending';
}

function StatusIcon({ status }: { status: SubtopicStatus }) {
  const size = 14;
  if (status === 'done') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        className="text-emerald-400"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'generating') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        className="text-blue-400 animate-spin"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className="text-zinc-600"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronRight({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={10}
      height={10}
      viewBox="0 0 12 12"
      fill="currentColor"
      style={{
        width: 10,
        height: 10,
        minWidth: 10,
        minHeight: 10,
        transition: 'transform 150ms',
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      <path d="M4 2l4 4-4 4z" />
    </svg>
  );
}

export default function Navigator({
  structure,
  currentUnit,
  currentSubtopic,
  generatedCount,
  selectedUnit,
  selectedSubtopic,
  onSelectSubtopic,
  status,
  viewMode,
  onToggleViewMode,
  editCount,
  onApprove,
  onExport,
  onTogglePanel,
  showPanel,
}: NavigatorProps) {
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (currentUnit > 0) s.add(currentUnit - 1);
    return s;
  });

  useEffect(() => {
    if (currentUnit > 0) {
      setExpandedUnits((prev) => {
        if (prev.has(currentUnit - 1)) return prev;
        const next = new Set(prev);
        next.add(currentUnit - 1);
        return next;
      });
    }
  }, [currentUnit]);

  const toggleUnit = (idx: number) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const totalSubtopics = structure.units.reduce((sum, u) => sum + u.subtopics.length, 0);
  const subtopicsPerUnit = structure.units[0]?.subtopics.length ?? 5;
  const progressPercent = totalSubtopics > 0 ? Math.round((generatedCount / totalSubtopics) * 100) : 0;
  const isMarkdownReady = status === 'markdown_ready';
  const canApprove = status === 'markdown_ready';
  const canExport = status === 'completed' || status === 'downloaded';
  const isExportingPdf = status === 'exporting_pdf';

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        maxWidth: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #27272a',
        background: '#18181b',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Progress bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#a1a1aa', marginBottom: 6 }}>
          <span>{generatedCount}/{totalSubtopics} Topics Generated</span>
          <span style={{ fontFamily: 'monospace' }}>{progressPercent}%</span>
        </div>
        <div style={{ width: '100%', background: '#27272a', borderRadius: 6, height: 6, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              borderRadius: 6,
              width: `${progressPercent}%`,
              background: isMarkdownReady ? '#10b981' : '#3b82f6',
              transition: 'width 700ms ease-out',
            }}
          />
        </div>
      </div>

      {/* Markdown ready banner */}
      {isMarkdownReady && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.08)' }}>
          <p style={{ fontSize: 12, color: '#34d399', fontWeight: 500, margin: 0 }}>All content generated. Review and approve.</p>
          {editCount > 0 && (
            <p style={{ fontSize: 11, color: 'rgba(16,185,129,0.6)', marginTop: 2 }}>{editCount} edit{editCount > 1 ? 's' : ''} made</p>
          )}
        </div>
      )}

      {/* View mode toggle */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid #27272a' }}>
        <button
          onClick={viewMode === 'editor' ? undefined : onToggleViewMode}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 12,
            borderRadius: 6,
            border: 'none',
            cursor: viewMode === 'editor' ? 'default' : 'pointer',
            background: viewMode === 'editor' ? '#27272a' : 'transparent',
            color: viewMode === 'editor' ? '#e4e4e7' : '#71717a',
            fontWeight: viewMode === 'editor' ? 500 : 400,
            transition: 'all 150ms',
          }}
        >
          Editor
        </button>
        <button
          onClick={viewMode === 'preview' ? undefined : onToggleViewMode}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 12,
            borderRadius: 6,
            border: 'none',
            cursor: viewMode === 'preview' ? 'default' : 'pointer',
            background: viewMode === 'preview' ? '#27272a' : 'transparent',
            color: viewMode === 'preview' ? '#e4e4e7' : '#71717a',
            fontWeight: viewMode === 'preview' ? 500 : 400,
            transition: 'all 150ms',
          }}
        >
          Preview
        </button>
      </div>

      {/* Tree view */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} className="scrollbar-thin">
        {structure.units.map((unit, uIdx) => {
          const isExpanded = expandedUnits.has(uIdx);
          const unitDone = generatedCount >= (uIdx + 1) * subtopicsPerUnit;
          const unitActive = currentUnit - 1 === uIdx;

          return (
            <div key={uIdx}>
              <button
                onClick={() => toggleUnit(uIdx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  lineHeight: 1.3,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                  color: unitActive ? '#93c5fd' : unitDone ? '#d4d4d8' : '#71717a',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(39,39,42,0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <ChevronRight expanded={isExpanded} />
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Unit {uIdx + 1}: {unit.unitTitle}
                </span>
              </button>

              {isExpanded && (
                <div style={{ paddingLeft: 20, paddingRight: 8 }}>
                  {unit.subtopics.map((sub, sIdx) => {
                    const subtopicStatus = getSubtopicStatus(uIdx, sIdx, currentUnit, currentSubtopic, generatedCount, subtopicsPerUnit);
                    const isSelected = selectedUnit === uIdx && selectedSubtopic === sIdx;

                    return (
                      <button
                        key={sIdx}
                        onClick={() => onSelectSubtopic(uIdx, sIdx)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '5px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          lineHeight: 1.4,
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          margin: '1px 0',
                          transition: 'all 150ms',
                          background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                          color: isSelected ? '#93c5fd' : '#a1a1aa',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(39,39,42,0.6)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <StatusIcon status={subtopicStatus} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {canApprove && (
          <button
            onClick={onApprove}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', background: '#2563eb', color: '#fff', transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            Approve &amp; Generate PDF
          </button>
        )}
        {isExportingPdf && (
          <div style={{
            width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
            textAlign: 'center', background: '#27272a', color: '#fbbf24',
          }} className="animate-pulse">
            Generating PDF&hellip;
          </div>
        )}
        {canExport && (
          <button
            onClick={onExport}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', background: '#059669', color: '#fff', transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#10b981'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#059669'; }}
          >
            Download PDF
          </button>
        )}
        <button
          onClick={onTogglePanel}
          style={{
            width: '100%', padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
            border: '1px solid #27272a', cursor: 'pointer', background: 'transparent',
            color: '#71717a', transition: 'all 150ms', textAlign: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#3f3f46'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#27272a'; }}
        >
          {showPanel ? 'Hide Stats' : 'Show Stats'}
        </button>
      </div>
    </aside>
  );
}
