'use client';

import { useState } from 'react';

interface GeneratorFormProps {
  onGenerate: (topic: string, model: string) => void;
  disabled: boolean;
}

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cost-Effective)' },
  { value: 'gpt-4o', label: 'GPT-4o (Best Quality)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

export default function GeneratorForm({ onGenerate, disabled }: GeneratorFormProps) {
  const [topic, setTopic] = useState('');
  const [model, setModel] = useState(MODELS[0].value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (trimmed.length < 3) return;
    onGenerate(trimmed, model);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-5">
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-zinc-300 mb-2">
          Book Topic
        </label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Distributed Systems Architecture"
          disabled={disabled}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all"
        />
      </div>

      <div>
        <label htmlFor="model" className="block text-sm font-medium text-zinc-300 mb-2">
          LLM Model
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={disabled || topic.trim().length < 3}
        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
      >
        {disabled ? 'Generating...' : 'Generate Ebook'}
      </button>

      <p className="text-xs text-zinc-500 text-center">
        Multi-unit structured ebook with capstones and case studies
      </p>
    </form>
  );
}
