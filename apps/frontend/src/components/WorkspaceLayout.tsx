'use client';

import { useState, useCallback } from 'react';
import { BookStructure, SessionStatus } from '@/lib/types';
import { useSubtopicContent } from '@/hooks/useSubtopicContent';
import Navigator from './Navigator';
import ContentViewer from './ContentViewer';
import BookPreview from './BookPreview';
import MetadataPanel from './MetadataPanel';
import ExportPreviewModal from './ExportPreviewModal';

interface WorkspaceLayoutProps {
  sessionId: string;
  structure: BookStructure;
  currentUnit: number;
  currentSubtopic: number;
  generatedCount: number;
  status: SessionStatus | null;
  callCount: number;
  tokenCount: number;
  lastActivityAt: number | null;
  editCount: number;
}

export default function WorkspaceLayout({
  sessionId,
  structure,
  currentUnit,
  currentSubtopic,
  generatedCount,
  status,
  callCount,
  tokenCount,
  lastActivityAt,
  editCount,
}: WorkspaceLayoutProps) {
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [showPanel, setShowPanel] = useState(false);

  const totalSubtopics = structure.units.reduce((sum, u) => sum + u.subtopics.length, 0);

  const flatIdx =
    selectedUnit != null && selectedSubtopic != null
      ? structure.units.slice(0, selectedUnit).reduce((sum, u) => sum + u.subtopics.length, 0) + selectedSubtopic
      : -1;
  const isGenerated = flatIdx >= 0 && flatIdx < generatedCount;
  const isCurrentlyGenerating =
    selectedUnit != null &&
    selectedSubtopic != null &&
    selectedUnit === currentUnit - 1 &&
    selectedSubtopic === currentSubtopic - 1;

  const { markdown, loading, error, versionsRemaining, updateContent } = useSubtopicContent(
    sessionId,
    selectedUnit,
    selectedSubtopic,
    isGenerated,
  );

  const subtopicTitle =
    selectedUnit != null && selectedSubtopic != null
      ? structure.units[selectedUnit]?.subtopics[selectedSubtopic] ?? null
      : null;

  const unitTitle =
    selectedUnit != null && structure.units[selectedUnit]
      ? `Unit ${selectedUnit + 1}: ${structure.units[selectedUnit].unitTitle}`
      : null;

  const handleSelect = useCallback((u: number, s: number) => {
    setSelectedUnit(u);
    setSelectedSubtopic(s);
    if (viewMode === 'preview') setViewMode('editor');
  }, [viewMode]);

  const handleApprove = useCallback(async () => {
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Approve failed:', data.error ?? res.status);
      }
    } catch (err) {
      console.error('Approve request error:', err);
    }
  }, [sessionId]);

  const handleJumpToEditor = useCallback((unitIdx: number, subtopicIdx: number) => {
    setSelectedUnit(unitIdx);
    setSelectedSubtopic(subtopicIdx);
    setViewMode('editor');
  }, []);

  const handleContentUpdate = useCallback((newMarkdown: string, newVersionsRemaining: number) => {
    updateContent(newMarkdown, newVersionsRemaining);
  }, [updateContent]);

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#09090b',
      }}
    >
      <Navigator
        structure={structure}
        currentUnit={currentUnit}
        currentSubtopic={currentSubtopic}
        generatedCount={generatedCount}
        selectedUnit={selectedUnit}
        selectedSubtopic={selectedSubtopic}
        onSelectSubtopic={handleSelect}
        status={status}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((v) => v === 'editor' ? 'preview' : 'editor')}
        editCount={editCount}
        onApprove={handleApprove}
        onExport={() => setShowExport(true)}
        onTogglePanel={() => setShowPanel((v) => !v)}
        showPanel={showPanel}
      />

      {viewMode === 'editor' ? (
        <ContentViewer
          bookTitle={structure.title}
          subtopicTitle={subtopicTitle}
          unitTitle={unitTitle}
          unitIndex={selectedUnit}
          subtopicIndex={selectedSubtopic}
          markdown={markdown}
          loading={loading}
          error={error}
          isGenerated={isGenerated}
          isGenerating={isCurrentlyGenerating}
          status={status}
          sessionId={sessionId}
          versionsRemaining={versionsRemaining}
          onContentUpdate={handleContentUpdate}
        />
      ) : (
        <BookPreview
          sessionId={sessionId}
          structure={structure}
          generatedCount={generatedCount}
          onJumpToEditor={handleJumpToEditor}
        />
      )}

      {showPanel && (
        <MetadataPanel
          generatedCount={generatedCount}
          totalSubtopics={totalSubtopics}
          status={status}
          callCount={callCount}
          tokenCount={tokenCount}
          lastActivityAt={lastActivityAt}
          onExport={() => setShowExport(true)}
          onApprove={handleApprove}
          editCount={editCount}
        />
      )}

      {showExport && (
        <ExportPreviewModal
          structure={structure}
          sessionId={sessionId}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
