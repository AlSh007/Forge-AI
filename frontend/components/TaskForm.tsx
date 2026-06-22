import React, { useState } from 'react';

export interface TaskFormValues {
  prompt: string;
  repositoryUrl: string;
}

interface TaskFormProps {
  onSubmit: (values: TaskFormValues) => Promise<void>;
  submitting: boolean;
  error?: string | null;
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TaskForm({ onSubmit, submitting, error }: TaskFormProps) {
  const [prompt, setPrompt] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');

  const promptLen = prompt.trim().length;
  const isReady = promptLen > 0 && repositoryUrl.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await onSubmit({ prompt: prompt.trim(), repositoryUrl: repositoryUrl.trim() });
      setPrompt('');
      setRepositoryUrl('');
    } catch {
      // Parent owns error state
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-500 select-none">
          New task
        </span>
        <span className="text-[10px] font-mono text-slate-700 select-none">6 agents · ~2 min</span>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        {/* Prompt */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the change — e.g. add rate limiting to the /api/users endpoint"
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10 resize-none transition leading-relaxed"
            rows={4}
            required
          />
          {promptLen > 0 && (
            <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-slate-700 select-none pointer-events-none">
              {promptLen}
            </span>
          )}
        </div>

        {/* Repository URL */}
        <input
          type="url"
          value={repositoryUrl}
          onChange={(e) => setRepositoryUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10 transition"
          required
        />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-950/30 px-4 py-3">
            <span className="text-rose-400 text-xs mt-px flex-shrink-0 font-mono">!</span>
            <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !isReady}
          className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all
            bg-blue-600 hover:bg-blue-500 active:bg-blue-700
            disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed
            text-white shadow-lg shadow-blue-900/20"
        >
          {submitting ? (
            <>
              <SpinnerIcon />
              <span>Dispatching agents…</span>
            </>
          ) : (
            <>
              <span>Run agents</span>
              <span className="ml-auto flex-shrink-0 opacity-60">
                <ArrowRightIcon />
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
