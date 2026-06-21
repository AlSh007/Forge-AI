import React, { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { TaskForm, TaskFormValues } from '../components/TaskForm';
import { AgentExecutionRecord, AgentType, TaskDetails, TaskStatus, executionApi, taskApi } from '../lib/api';
import { useTaskStore } from '../lib/store';

const ACTIVE_STATUSES: TaskStatus[] = ['PENDING', 'PLANNING', 'IN_PROGRESS', 'VALIDATING'];

const statusClasses: Record<TaskStatus, string> = {
  PENDING: 'bg-slate-500/20 text-slate-200 border-slate-400/30',
  PLANNING: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  VALIDATING: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  FAILED: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  CANCELLED: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
};

const PIPELINE_AGENTS: { type: AgentType; label: string; desc: string }[] = [
  { type: 'PRODUCT_MANAGER', label: 'Product Manager', desc: 'Task planning & requirements' },
  { type: 'ARCHITECT', label: 'Architect', desc: 'Technical design & structure' },
  { type: 'DATABASE', label: 'Database', desc: 'Schema & migration changes' },
  { type: 'BACKEND', label: 'Backend', desc: 'Server-side code generation' },
  { type: 'FRONTEND', label: 'Frontend', desc: 'UI component generation' },
  { type: 'DEVOPS', label: 'DevOps', desc: 'Validation & quality review' },
];

type AgentPipelineStatus = 'pending' | 'running' | 'done' | 'failed';

function getAgentStatus(agentType: AgentType, executions: AgentExecutionRecord[]): AgentPipelineStatus {
  const exec = executions.find((e) => e.agentType === agentType);
  if (!exec) return 'pending';
  if (exec.status === 'RUNNING') return 'running';
  if (exec.status === 'SUCCESS') return 'done';
  if (exec.status === 'FAILED') return 'failed';
  return 'pending';
}

function getOutputPreview(output: string): string {
  try {
    const parsed = JSON.parse(output) as { files?: { path: string }[]; description?: string };
    if (parsed.files && parsed.files.length > 0) {
      const count = parsed.files.length;
      const paths = parsed.files
        .slice(0, 3)
        .map((f) => f.path)
        .join(', ');
      return `${count} file${count === 1 ? '' : 's'}: ${paths}${count > 3 ? ', ...' : ''}`;
    }
    if (parsed.description) return parsed.description;
  } catch {
    // plain text output
  }
  return output.replace(/\n/g, ' ').slice(0, 120);
}

function formatStatus(status: TaskStatus): string {
  return status.replace(/_/g, ' ');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return (error.response?.data as { error?: string })?.error ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the API.';
}

function AgentPipeline({ task }: { task: TaskDetails }) {
  const isActive = ACTIVE_STATUSES.includes(task.status);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-sm text-slate-400">Agent Pipeline</p>
        {isActive && (
          <span className="flex items-center gap-1.5 text-xs text-blue-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Live
          </span>
        )}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 divide-y divide-slate-800/60">
        {PIPELINE_AGENTS.map((agent, index) => {
          const status = getAgentStatus(agent.type, task.executions);
          const exec = task.executions.find((e) => e.agentType === agent.type);

          const dotClass =
            status === 'done'
              ? 'bg-emerald-400'
              : status === 'running'
              ? 'bg-blue-400 animate-pulse ring-4 ring-blue-400/20'
              : status === 'failed'
              ? 'bg-rose-400'
              : 'bg-slate-700';

          const labelClass =
            status === 'pending' ? 'text-slate-500' : 'text-white';

          return (
            <div key={agent.type} className="flex items-start gap-4 px-4 py-3">
              <div className="mt-2 flex-shrink-0 flex flex-col items-center gap-1">
                <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                {index < PIPELINE_AGENTS.length - 1 && (
                  <div className="w-px h-3 bg-slate-800" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-semibold text-sm ${labelClass}`}>{agent.label}</span>
                  {status === 'running' && (
                    <span className="text-xs text-blue-300 animate-pulse">Working...</span>
                  )}
                  {status === 'done' && (
                    <span className="text-xs text-emerald-400">Done</span>
                  )}
                  {status === 'failed' && (
                    <span className="text-xs text-rose-400">Failed</span>
                  )}
                  {status === 'pending' && (
                    <span className="text-xs text-slate-600">{index + 1}</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{agent.desc}</p>
                {exec?.output && status === 'done' && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {getOutputPreview(exec.output)}
                  </p>
                )}
                {exec?.error && status === 'failed' && (
                  <p className="text-xs text-rose-400/80 mt-1 line-clamp-2">{exec.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const { tasks, currentTask, setTasks, setCurrentTask, addTask, updateTask } = useTaskStore();
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void loadTasks();
  }, []);

  // Poll every 2s while the current task is in an active state
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!currentTask || !ACTIVE_STATUSES.includes(currentTask.status)) return;

    const taskId = currentTask.id;
    pollingRef.current = setInterval(async () => {
      try {
        const response = await taskApi.getById(taskId);
        updateTask(response.task.id, response.task);
        setCurrentTask(response.task);
      } catch {
        // ignore transient errors during polling
      }
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [currentTask?.id, currentTask?.status]);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await taskApi.getAll();
      setTasks(response.tasks);
      if (!currentTask && response.tasks.length > 0) {
        setCurrentTask(response.tasks[0]);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoadingTasks(false);
    }
  };

  const selectTask = async (taskId: string) => {
    try {
      const response = await taskApi.getById(taskId);
      setCurrentTask(response.task);
      updateTask(taskId, response.task);
    } catch (selectionError) {
      setError(getErrorMessage(selectionError));
    }
  };

  const handleSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const createdTaskResponse = await taskApi.create(values);
      addTask(createdTaskResponse.task);
      setCurrentTask(createdTaskResponse.task);

      // 202 — execution starts in background; polling kicks in via the effect above
      const startResponse = await executionApi.startExecution(createdTaskResponse.task.id);
      updateTask(startResponse.task.id, startResponse.task);
      setCurrentTask(startResponse.task);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTask: TaskDetails | null = currentTask;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#111827)]">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-12">
          <p className="text-sm uppercase tracking-[0.35em] text-blue-300 mb-4">ForgeAI</p>
          <h1 className="text-5xl font-bold text-white mb-4">Autonomous Task Execution</h1>
          <p className="max-w-3xl text-lg text-slate-300">
            Submit a development task and watch 6 specialized AI agents plan, design, and generate code in real time.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8">
          <div className="space-y-8">
            <TaskForm onSubmit={handleSubmit} submitting={submitting} error={error} />

            <section className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Current Task</h2>
                  <p className="text-slate-400">Live agent progress and execution results.</p>
                </div>
                {selectedTask ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[selectedTask.status]}`}
                  >
                    {formatStatus(selectedTask.status)}
                  </span>
                ) : null}
              </div>

              {selectedTask ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Prompt</p>
                    <p className="text-white">{selectedTask.prompt}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-1">Repository</p>
                    <a
                      href={selectedTask.repositoryUrl}
                      className="text-blue-300 hover:text-blue-200 break-all"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedTask.repository}
                    </a>
                  </div>

                  <AgentPipeline task={selectedTask} />

                  {selectedTask.plan && (
                    <div>
                      <p className="text-sm text-slate-400 mb-2">Generated Plan</p>
                      <pre className="overflow-x-auto rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-sm text-slate-200 whitespace-pre-wrap">
                        {selectedTask.plan}
                      </pre>
                    </div>
                  )}

                  {selectedTask.logs.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-3">Execution Log</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selectedTask.logs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-4 text-xs text-slate-400 mb-1">
                              <span className={log.level === 'ERROR' ? 'text-rose-400' : log.level === 'WARN' ? 'text-amber-400' : ''}>
                                {log.level}
                              </span>
                              <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-sm text-slate-200">{log.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400">
                  Submit a task to see the live agent pipeline.
                </p>
              )}
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-2">Recent Tasks</h2>
              <p className="text-slate-400 mb-6">Click any task to inspect its execution.</p>

              {loadingTasks ? (
                <p className="text-slate-400">Loading tasks...</p>
              ) : tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => { void selectTask(task.id); }}
                      className={`w-full text-left rounded-2xl border bg-slate-950/60 p-4 hover:border-blue-400/40 transition ${
                        currentTask?.id === task.id ? 'border-blue-400/40' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p className="font-semibold text-white line-clamp-2">{task.prompt}</p>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClasses[task.status]}`}
                        >
                          {formatStatus(task.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 break-all">{task.repositoryUrl}</p>
                      {ACTIVE_STATUSES.includes(task.status) && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-300">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Running
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No tasks yet. Submit one to get started.</p>
              )}
            </section>

            <section className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4">How it works</h2>
              <div className="space-y-3 text-sm text-slate-300">
                {PIPELINE_AGENTS.map((agent, i) => (
                  <div key={agent.type} className="flex gap-3">
                    <span className="flex-shrink-0 text-slate-500 font-mono">{i + 1}.</span>
                    <div>
                      <span className="font-semibold text-slate-200">{agent.label}</span>
                      <span className="text-slate-400"> — {agent.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
