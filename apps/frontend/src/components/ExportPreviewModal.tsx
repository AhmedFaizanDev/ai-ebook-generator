'use client';

import { BookStructure } from '@/lib/types';

interface ExportPreviewModalProps {
  structure: BookStructure;
  sessionId: string;
  onClose: () => void;
}

const PAGES_PER_SUBTOPIC = 4;
const FRONT_MATTER_PAGES = 4;
const CAPSTONE_PAGES = 12;
const CASE_STUDY_PAGES = 12;

export default function ExportPreviewModal({
  structure,
  sessionId,
  onClose,
}: ExportPreviewModalProps) {
  let runningPage = FRONT_MATTER_PAGES;

  const unitPages: { unitTitle: string; startPage: number; subtopics: { title: string; page: number }[] }[] =
    structure.units.map((unit, uIdx) => {
      const unitStart = runningPage + 1;
      const subtopics = unit.subtopics.map((sub, sIdx) => {
        const page = unitStart + sIdx * PAGES_PER_SUBTOPIC;
        return { title: sub, page };
      });
      runningPage = unitStart + unit.subtopics.length * PAGES_PER_SUBTOPIC - 1;
      return { unitTitle: `Unit ${uIdx + 1}: ${unit.unitTitle}`, startPage: unitStart, subtopics };
    });

  const capstoneStart = runningPage + 1;
  const caseStudyStart = capstoneStart + CAPSTONE_PAGES;
  const totalPages = caseStudyStart + CASE_STUDY_PAGES - 1;

  const handleDownload = () => {
    window.open(`/api/download?sid=${sessionId}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">{structure.title}</h2>
            <p className="text-xs text-zinc-500 mt-1">~{totalPages} pages estimated</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Table of Contents
          </h3>

          <div className="space-y-3 text-sm">
            <TocRow label="Title Page &amp; Table of Contents" page={1} bold />

            {unitPages.map((u) => (
              <div key={u.unitTitle}>
                <TocRow label={u.unitTitle} page={u.startPage} bold />
                {u.subtopics.map((s) => (
                  <TocRow key={s.title} label={s.title} page={s.page} indent />
                ))}
              </div>
            ))}

            <TocRow label="Capstone Projects" page={capstoneStart} bold />
            {structure.capstoneTopics.map((t, i) => (
              <TocRow key={t} label={`Capstone ${i + 1}: ${t}`} page={capstoneStart + i * 6} indent />
            ))}

            <TocRow label="Case Studies" page={caseStudyStart} bold />
            {structure.caseStudyTopics.map((t, i) => (
              <TocRow key={t} label={`Case Study ${i + 1}: ${t}`} page={caseStudyStart + i * 6} indent />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/20"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function TocRow({
  label,
  page,
  bold,
  indent,
}: {
  label: string;
  page: number;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2 ${indent ? 'pl-5' : ''} ${
        bold ? 'text-zinc-200' : 'text-zinc-400'
      }`}
    >
      <span className={`truncate ${bold ? 'font-medium' : ''}`}>{label}</span>
      <span className="flex-1 border-b border-dotted border-zinc-700 min-w-[2rem] translate-y-[-3px]" />
      <span className="font-mono text-xs text-zinc-500 shrink-0">{page}</span>
    </div>
  );
}
