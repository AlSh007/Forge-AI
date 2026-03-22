import React, { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [repository, setRepository] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // TODO: Call API to create task
    console.log('Submitting task:', { prompt, repository });
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">ForgeAI</h1>
          <p className="text-xl text-slate-300">
            Autonomous AI Coding Agents for Your Repository
          </p>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-12">
          {/* Task Submission */}
          <div className="bg-slate-800 rounded-lg p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">Create Task</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Development Task
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Add JWT authentication to the API"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
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
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {loading ? 'Processing...' : 'Start Agent Execution'}
              </button>
            </form>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Features</h2>
            
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">🤖 Multi-Agent System</h3>
              <p className="text-slate-300">
                Specialized agents for architecture, backend, frontend, database, and DevOps.
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">📦 Sandbox Execution</h3>
              <p className="text-slate-300">
                Isolated Docker environments for safe code generation and testing.
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">✅ Automated Validation</h3>
              <p className="text-slate-300">
                Built-in testing, linting, and type-checking before PR creation.
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">🔀 Pull Requests</h3>
              <p className="text-slate-300">
                Automatic PR generation with detailed summaries and validations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
