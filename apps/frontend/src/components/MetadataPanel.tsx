'use client';

import { useState, useEffect, useRef } from 'react';
import { SessionStatus } from '@/lib/types';

interface MetadataPanelProps {
  generatedCount: number;
  totalSubtopics: number;
  status: SessionStatus | null;
  callCount: number;
  tokenCount: number;
  lastActivityAt: number | null;
  onExport: () => void;
  onApprove: () => void;
  editCount: number;
}

const WORDS_PER_SUBTOPIC = 1200;
const CAPSTONE_WORDS = 1750 * 2;
const CASE_STUDY_WORDS = 1750 * 2;
const WORDS_PER_PAGE = 400;

function LastActivityDisplay({ timestamp }: { timestamp: number | null }) {
  const [display, setDisplay] = useState('\u2014');
  const tsRef = useRef(timestamp);
  tsRef.current = timestamp;

  useEffect(() => {
    function update() {
      const ts = tsRef.current;
      if (ts == null) { setDisplay('\u2014'); return; }
      const sec = Math.floor((Date.now() - ts) / 1000);
      if (sec < 10) setDisplay('Just now');
      else if (sec < 60) setDisplay(`${sec}s ago`);
      else {
        const min = Math.floor(sec / 60);
        setDisplay(`${min}m ${sec % 60}s ago`);
      }
    }
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (timestamp == null) return;
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 10) setDisplay('Just now');
    else if (sec < 60) setDisplay(`${sec}s ago`);
    else {
      const min = Math.floor(sec / 60);
      setDisplay(`${min}m ${sec % 60}s ago`);
    }
  }, [timestamp]);

  return <>{display}</>;
}

export default function MetadataPanel({
  generatedCount,
  totalSubtopics,
  status,
  callCount,
  tokenCount,
  lastActivityAt,
  onExport,
  onApprove,
  editCount,
}: MetadataPanelProps) {
  const estimatedWords = generatedCount * WORDS_PER_SUBTOPIC +
    (status === 'completed' || status === 'markdown_ready' || status === 'exporting_pdf'
      ? CAPSTONE_WORDS + CASE_STUDY_WORDS
      : 0);
  const estimatedPages = Math.round(estimatedWords / WORDS_PER_PAGE);

  const canExport = status === 'completed' || status === 'downloaded';
  const canApprove = status === 'markdown_ready';
  const isExportingPdf = status === 'exporting_pdf';
  const isGenerating = status === 'generating' || status === 'queued';

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        maxWidth: 240,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #27272a',
        background: '#18181b',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '16px 16px', borderBottom: '1px solid #27272a' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Book Stats</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StatRow label="Est. Pages" value={`~${estimatedPages}`} />
          <StatRow label="Est. Words" value={estimatedWords.toLocaleString()} />
          <StatRow label="Generated" value={`${generatedCount}/${totalSubtopics}`} />
          <StatRow label="LLM Calls" value={String(callCount)} />
          <StatRow label="Tokens Used" value={tokenCount.toLocaleString()} />
          {editCount > 0 && <StatRow label="Edits" value={String(editCount)} highlight />}
        </div>
      </div>

      <div style={{ padding: '16px 16px', borderBottom: '1px solid #27272a' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Status</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <span
            style={{
              width: 8,
              height: 8,
              minWidth: 8,
              minHeight: 8,
              borderRadius: '50%',
              background:
                status === 'completed' || status === 'downloaded'
                  ? '#34d399'
                  : status === 'markdown_ready'
                    ? '#34d399'
                    : status === 'failed'
                      ? '#f87171'
                      : isGenerating
                        ? '#60a5fa'
                        : isExportingPdf
                          ? '#fbbf24'
                          : '#52525b',
            }}
          />
          <span style={{ color: '#d4d4d8', textTransform: 'capitalize' }}>
            {status === 'markdown_ready' ? 'Ready for Review' : status === 'exporting_pdf' ? 'Generating PDF' : status ?? 'Initializing'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#71717a', marginTop: 8 }}>
          Last activity: <LastActivityDisplay timestamp={lastActivityAt} />
        </p>
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canApprove && (
          <button
            onClick={onApprove}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: '#2563eb',
              color: '#fff',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            Approve &amp; Generate PDF
          </button>
        )}
        {isExportingPdf && (
          <div style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            background: '#27272a',
            color: '#fbbf24',
          }} className="animate-pulse">
            Generating PDF&hellip;
          </div>
        )}
        <button
          onClick={onExport}
          disabled={!canExport}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: canExport ? 'pointer' : 'not-allowed',
            background: canExport ? '#059669' : '#27272a',
            color: canExport ? '#fff' : '#52525b',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => { if (canExport) e.currentTarget.style.background = '#10b981'; }}
          onMouseLeave={(e) => { if (canExport) e.currentTarget.style.background = '#059669'; }}
        >
          {canExport ? 'Download PDF' : isGenerating ? 'Generating Markdown...' : isExportingPdf ? 'PDF in progress...' : 'Download PDF'}
        </button>
      </div>
    </aside>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#71717a' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', color: highlight ? '#60a5fa' : '#d4d4d8' }}>{value}</span>
    </div>
  );
}
