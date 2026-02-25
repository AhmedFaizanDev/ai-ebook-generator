'use client';

interface DownloadButtonProps {
  sessionId: string;
  onReset: () => void;
}

export default function DownloadButton({ sessionId, onReset }: DownloadButtonProps) {
  const handleDownload = () => {
    window.open(`/api/download?sid=${sessionId}`, '_blank');
  };

  return (
    <div className="w-full max-w-xl space-y-4 text-center">
      <div className="p-6 bg-zinc-900 border border-green-800 rounded-lg">
        <svg
          className="mx-auto mb-4 w-12 h-12 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">Ebook Ready</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Your ~250-page technical ebook has been generated and is ready for download.
        </p>
        <button
          onClick={handleDownload}
          className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors"
        >
          Download PDF
        </button>
      </div>

      <button
        onClick={onReset}
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Generate another book
      </button>
    </div>
  );
}
