'use client';

interface SyllabusPhaseProps {
  topic: string;
  phase?: string;
  percent?: number;
}

function getPhaseLabel(phase: string | undefined, percent: number | undefined): string {
  if (!phase || phase === 'init') return 'Analyzing topic structure\u2026';
  if (phase === 'structure') return 'Generating book structure\u2026';
  if (phase === 'preface') return 'Writing preface\u2026';
  if (phase.match(/^unit-\d+-intro$/)) {
    const num = phase.replace('unit-', '').replace('-intro', '');
    return `Writing Unit ${num} introduction\u2026`;
  }
  if (phase.match(/^unit-\d+-summary$/)) {
    const num = phase.replace('unit-', '').replace('-summary', '');
    return `Writing Unit ${num} summary\u2026`;
  }
  if (phase.match(/^unit-\d+-exercises$/)) {
    const num = phase.replace('unit-', '').replace('-exercises', '');
    return `Generating Unit ${num} exercises\u2026`;
  }
  if (phase.startsWith('unit-')) {
    const num = phase.replace('unit-', '');
    return `Generating Unit ${num}\u2026`;
  }
  if (phase === 'capstones') return 'Writing capstone projects\u2026';
  if (phase === 'case-studies') return 'Writing case studies\u2026';
  if (phase === 'glossary') return 'Generating glossary\u2026';
  if (phase === 'bibliography') return 'Compiling bibliography\u2026';
  if (phase === 'assembly') return 'Assembling final document\u2026';
  if (phase === 'markdown_ready') return 'Almost ready \u2014 loading workspace\u2026';
  if (percent != null && percent > 0) return `Generating content (${percent}%)\u2026`;
  return 'Analyzing topic structure\u2026';
}

export default function SyllabusPhase({ topic, phase, percent }: SyllabusPhaseProps) {
  const label = getPhaseLabel(phase, percent);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-8 py-10 max-w-md w-full text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-6 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ width: 28, height: 28 }}
            className="text-blue-400 animate-pulse"
          >
            <path
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Architecting Syllabus</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Generating the blueprint for{' '}
          <span className="text-zinc-200 font-medium">&ldquo;{topic}&rdquo;</span>
        </p>
        <div className="flex items-center justify-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-6">
          {label}
        </p>
      </div>
    </div>
  );
}
