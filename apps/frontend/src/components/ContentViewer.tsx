'use client';

import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, memo } from 'react';
import { SessionStatus } from '@/lib/types';
import { renderMarkdown } from '@/lib/markdownRenderer';

interface ContentViewerProps {
  bookTitle: string | null;
  subtopicTitle: string | null;
  unitTitle: string | null;
  unitIndex: number | null;
  subtopicIndex: number | null;
  markdown: string | null;
  loading: boolean;
  error: string | null;
  isGenerated: boolean;
  isGenerating: boolean;
  status: SessionStatus | null;
  sessionId: string;
  versionsRemaining: number;
  onContentUpdate: (markdown: string, versionsRemaining: number) => void;
}

type EditAction = 'expand' | 'rewrite' | 'add_example' | 'add_table' | 'shorten';

const SELECTION_ACTIONS: { label: string; icon: string; action: EditAction }[] = [
  { label: 'Expand', icon: '⤢', action: 'expand' },
  { label: 'Shorten', icon: '⤡', action: 'shorten' },
  { label: 'Rewrite', icon: '↻', action: 'rewrite' },
  { label: 'Add Example', icon: '{ }', action: 'add_example' },
  { label: 'Add Table', icon: '⊞', action: 'add_table' },
];

function BreadcrumbChevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      style={{ width: 12, height: 12, minWidth: 12, minHeight: 12 }}
      className="text-zinc-600"
    >
      <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className="animate-spin"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="36" strokeDashoffset="9" strokeLinecap="round" />
    </svg>
  );
}

export default function ContentViewer({
  bookTitle,
  subtopicTitle,
  unitTitle,
  unitIndex,
  subtopicIndex,
  markdown,
  loading,
  error,
  isGenerated,
  isGenerating,
  status,
  sessionId,
  versionsRemaining,
  onContentUpdate,
}: ContentViewerProps) {
  const hasContent = markdown != null && markdown.length > 0;
  const isReviewMode = status === 'markdown_ready';

  const [regenerating, setRegenerating] = useState(false);
  const [editingAction, setEditingAction] = useState<EditAction | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const pendingActionRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (pendingActionRef.current) return;
      if (!isReviewMode || !articleRef.current) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!articleRef.current.contains(range.commonAncestorContainer)) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 10) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      setSelectedText(text);
      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current?.getBoundingClientRect();
      if (containerRect) {
        setSelectionRect({
          top: rect.top - containerRect.top - 44,
          left: rect.left - containerRect.left + rect.width / 2,
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [isReviewMode]);

  const handleRegenerate = useCallback(async () => {
    if (unitIndex == null || subtopicIndex == null || regenerating) return;
    setRegenerating(true);
    setActionError(null);
    try {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, unitIdx: unitIndex, subtopicIdx: subtopicIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onContentUpdate(data.markdown, data.versionsRemaining);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Regenerate failed:', msg);
      setActionError(`Regeneration failed: ${msg}`);
    } finally {
      setRegenerating(false);
    }
  }, [sessionId, unitIndex, subtopicIndex, regenerating, onContentUpdate]);

  const handleEditSection = useCallback(async (action: EditAction) => {
    const textToEdit = selectedText ?? pendingActionRef.current;
    if (unitIndex == null || subtopicIndex == null || !textToEdit || editingAction) return;
    pendingActionRef.current = textToEdit;
    setEditingAction(action);
    setActionError(null);
    try {
      const res = await fetch('/api/edit-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          unitIdx: unitIndex,
          subtopicIdx: subtopicIndex,
          selectedText: textToEdit,
          action,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onContentUpdate(data.markdown, data.versionsRemaining);
      window.getSelection()?.removeAllRanges();
      setSelectedText(null);
      setSelectionRect(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Edit section (${action}) failed:`, msg);
      setActionError(`Edit failed: ${msg}`);
    } finally {
      pendingActionRef.current = null;
      setEditingAction(null);
    }
  }, [sessionId, unitIndex, subtopicIndex, selectedText, editingAction, onContentUpdate]);

  const handleUndo = useCallback(async () => {
    if (unitIndex == null || subtopicIndex == null || undoing || versionsRemaining <= 0) return;
    setUndoing(true);
    setActionError(null);
    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, unitIdx: unitIndex, subtopicIdx: subtopicIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onContentUpdate(data.markdown, data.versionsRemaining);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Undo failed:', msg);
      setActionError(`Undo failed: ${msg}`);
    } finally {
      setUndoing(false);
    }
  }, [sessionId, unitIndex, subtopicIndex, undoing, versionsRemaining, onContentUpdate]);

  if (!subtopicTitle) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '64px 32px',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(39,39,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={32}
            height={32}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ width: 32, height: 32, color: '#71717a' }}
          >
            <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#d4d4d8', marginBottom: 8 }}>Getting Started</h2>
        <p style={{ fontSize: 14, color: '#71717a', maxWidth: 420 }}>
          Select a subtopic from the navigator to view its content. Content will appear here as it is generated.
        </p>
      </div>
    );
  }

  const isBusy = regenerating || editingAction != null || undoing;

  return (
    <div
      ref={contentRef}
      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* Breadcrumbs */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: '1px solid #27272a',
          background: 'rgba(24,24,27,0.5)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: '#71717a',
        }}
      >
        {bookTitle && (
          <>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={bookTitle}>{bookTitle}</span>
            <BreadcrumbChevron />
          </>
        )}
        {unitTitle && (
          <>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={unitTitle}>{unitTitle}</span>
            <BreadcrumbChevron />
          </>
        )}
        <span style={{ color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }} title={subtopicTitle}>{subtopicTitle}</span>

        {isReviewMode && versionsRemaining > 0 && (
          <button
            onClick={handleUndo}
            disabled={undoing}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              color: '#a1a1aa',
              cursor: undoing ? 'not-allowed' : 'pointer',
              opacity: undoing ? 0.4 : 1,
              transition: 'all 150ms',
            }}
            title={`Undo (${versionsRemaining} version${versionsRemaining > 1 ? 's' : ''} available)`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 14, height: 14 }}
            >
              <path d="M3 7h7a3 3 0 010 6H8" />
              <path d="M6 4L3 7l3 3" />
            </svg>
            <span>{versionsRemaining}</span>
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Floating selection toolbar */}
        {isReviewMode && selectedText && selectionRect && !isBusy && (
          <div
            style={{
              position: 'absolute',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 4,
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              top: selectionRect.top,
              left: Math.max(8, selectionRect.left - 120),
            }}
          >
            {SELECTION_ACTIONS.map((a) => (
              <button
                key={a.action}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (selectedText) pendingActionRef.current = selectedText;
                }}
                onClick={() => handleEditSection(a.action)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#d4d4d8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#3f3f46'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 32px' }}>
          {actionError && !isBusy && (
            <div style={{
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#f87171',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              padding: '12px 16px',
            }}>
              <span style={{ fontSize: 14 }}>{actionError}</span>
              <button onClick={() => setActionError(null)} style={{ color: '#f87171', fontSize: 12, marginLeft: 12, border: 'none', background: 'none', cursor: 'pointer' }}>Dismiss</button>
            </div>
          )}

          {isBusy && (
            <div style={{
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#60a5fa',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 8,
              padding: '12px 16px',
            }}>
              <SpinnerIcon size={16} />
              <span style={{ fontSize: 14 }}>
                {regenerating ? 'Regenerating section...' : undoing ? 'Restoring previous version...' : `Applying ${editingAction}...`}
              </span>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#a1a1aa', padding: '48px 0' }}>
              <SpinnerIcon size={20} />
              <span style={{ fontSize: 14 }}>Loading content...</span>
            </div>
          )}

          {error && !loading && (
            <div style={{ borderRadius: 8, border: '1px solid #3f3f46', background: 'rgba(39,39,42,0.5)', padding: 16, fontSize: 14, color: '#a1a1aa' }}>
              {isGenerating
                ? 'This section is currently being generated. It will appear shortly.'
                : !isGenerated
                  ? 'This section has not been generated yet. Please wait until the generator reaches it.'
                  : `Could not load content: ${error}`}
            </div>
          )}

          {hasContent && !loading && markdown && (
            <RenderedArticle
              ref={articleRef}
              markdown={markdown}
              isBusy={isBusy}
            />
          )}
        </div>
      </div>

      {/* Sticky bottom toolbar */}
      {hasContent && (
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid #27272a',
            background: 'rgba(24,24,27,0.8)',
            backdropFilter: 'blur(8px)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <ToolbarButton
            disabled={!isReviewMode || isBusy}
            onClick={handleRegenerate}
            icon="↻"
            label="Regenerate"
          />

          {SELECTION_ACTIONS.filter(a => a.action !== 'rewrite').map((btn) => (
            <ToolbarButton
              key={btn.action}
              disabled={!isReviewMode || !selectedText || isBusy}
              onMouseDown={() => { if (selectedText) pendingActionRef.current = selectedText; }}
              onClick={() => handleEditSection(btn.action)}
              icon={btn.icon}
              label={btn.label}
              title={isReviewMode && !selectedText ? 'Select text first' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  disabled,
  onClick,
  onMouseDown,
  icon,
  label,
  title,
}: {
  disabled: boolean;
  onClick: () => void;
  onMouseDown?: () => void;
  icon: string;
  label: string;
  title?: string;
}) {
  return (
    <button
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title={title}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        borderRadius: 6,
        border: '1px solid',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 150ms',
        background: '#27272a',
        borderColor: disabled ? '#3f3f46' : '#52525b',
        color: disabled ? '#52525b' : '#d4d4d8',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const RenderedArticle = memo(forwardRef<HTMLElement, { markdown: string; isBusy: boolean }>(
  function RenderedArticle({ markdown, isBusy }, ref) {
    const html = useMemo(() => renderMarkdown(markdown), [markdown]);
    return (
      <article
        ref={ref}
        className={`prose-content ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
));
