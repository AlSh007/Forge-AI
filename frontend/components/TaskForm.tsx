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

export function TaskForm({ onSubmit, submitting, error }: TaskFormProps) {
  const [prompt, setPrompt] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await onSubmit({
        prompt: prompt.trim(),
        repositoryUrl: repositoryUrl.trim(),
      });
      setPrompt('');
      setRepositoryUrl('');
    } catch {
      // Parent component owns the visible error state.
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-2">Create Task</h2>
      <p className="text-slate-300 mb-6">
        Submit a repository task and ForgeAI will plan and execute the first demo workflow.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Development Task
          </label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="e.g., Add JWT authentication to the API"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            rows={4}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Repository URL
          </label>
          <input
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/user/repo"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition"
        >
          {submitting ? 'Creating And Executing...' : 'Create And Execute Task'}
        </button>
      </form>
    </div>
  );
}
