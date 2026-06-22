import React, { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { TaskForm, TaskFormValues } from '../components/TaskForm';
import { AgentPipeline } from '../components/AgentPipeline';
import { ExecutionLogRecord, TaskDetails, TaskStatus, executionApi, systemApi, taskApi } from '../lib/api';
import { useTaskStore } from '../lib/store';

// ── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: TaskStatus[] = ['PENDING', 'PLANNING', 'IN_PROGRESS', 'VALIDATING'];

const STATUS_DOT: Record<TaskStatus, string> = {
  PENDING:     'bg-slate-500',
  PLANNING:    'bg-amber-400 animate-pulse',
  IN_PROGRESS: 'bg-blue-400 animate-pulse',
  VALIDATING:  'bg-violet-400 animate-pulse',
  COMPLETED:   'bg-emerald-400',
  FAILED:      'bg-rose-400',
  CANCELLED:   'bg-slate-700',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING:     'Pending',
  PLANNING:    'Planning',
  IN_PROGRESS: 'Running',
  VALIDATING:  'Validating',
  COMPLETED:   'Completed',
  FAILED:      'Failed',
  CANCELLED:   'Cancelled',
};

const LOG_LEVEL_COLOR: Record<string, string> = {
  DEBUG: 'bg-slate-700',
  INFO:  'bg-blue-500/60',
  WARN:  'bg-amber-400/70',
  ERROR: 'bg-rose-400',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return (error.response?.data as { error?: string })?.error ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LogLine({ log }: { log: ExecutionLogRecord }) {
  const dot = LOG_LEVEL_COLOR[log.level] ?? 'bg-slate-600';
  const time = new Date(log.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="flex items-start gap-2.5 px-3 py-[3px] hover:bg-white/[0.02] rounded group">
      <div className={`mt-[5px] h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-[11px] font-mono text-slate-600 flex-shrink-0 select-none tabular-nums">
        {time}
      </span>
      <span className="text-[11px] font-mono text-slate-400 leading-relaxed break-all">
        {log.message}
      </span>
    </div>
  );
}

function EmptyTaskState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-center mb-4">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="14" height="11" rx="2" stroke="#475569" strokeWidth="1.2" />
          <path d="M7 5V4a3 3 0 0 1 6 0v1" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7 10h6M7 13h4" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm text-slate-500 mb-1">No task selected</p>
      <p className="text-xs text-slate-700">Submit a task to see the live agent pipeline.</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { tasks, currentTask, setTasks, setCurrentTask, addTask, updateTask } = useTaskStore();
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [storageMode, setStorageMode] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch system health once on mount
  useEffect(() => {
    systemApi.health()
      .then((d) => setStorageMode(d.storage))
      .catch(() => {});
  }, []);

  // Load tasks on mount
  useEffect(() => {
    void loadTasks();
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTask?.logs.length]);

  // Poll every 2s while the current task is active
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
      } catch { /* ignore */ }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentTask?.id, currentTask?.status]);

  // Collapse plan when a new task starts
  useEffect(() => {
    setShowPlan(false);
  }, [currentTask?.id]);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await taskApi.getAll();
      setTasks(response.tasks);
      if (!currentTask && response.tasks.length > 0) setCurrentTask(response.tasks[0]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingTasks(false);
    }
  };

  const selectTask = async (taskId: string) => {
    try {
      const response = await taskApi.getById(taskId);
      setCurrentTask(response.task);
      updateTask(taskId, response.task);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await taskApi.create(values);
      addTask(created.task);
      setCurrentTask(created.task);
      const started = await executionApi.startExecution(created.task.id);
      updateTask(started.task.id, started.task);
      setCurrentTask(started.task);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const task: TaskDetails | null = currentTask;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12),_transparent_60%),linear-gradient(160deg,_#020617,_#0a1120_50%,_#0d1117)]">

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800/50 bg-slate-950/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-11 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 select-none">
            <span className="font-mono text-sm font-bold text-white tracking-tight">forge</span>
            <span className="font-mono text-sm font-bold text-blue-500">/</span>
            <span className="font-mono text-sm text-slate-500">ai</span>
          </div>
          <div className="flex items-center gap-5 text-[11px] font-mono text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              6 agents
            </span>
            {storageMode && <span>{storageMode} storage</span>}
          </div>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="grid lg:grid-cols-[1fr,340px] gap-6 items-start">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="space-y-5">

            <TaskForm onSubmit={handleSubmit} submitting={submitting} error={error} />

            {/* Current task workspace */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">

              {/* Zone header */}
              <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-800/60">
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-500 select-none">
                  Current task
                </span>
                {task && (
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status]}`} />
                    <span className="text-[11px] font-mono text-slate-500">
                      {STATUS_LABEL[task.status]}
                    </span>
                    <span className="text-[10px] font-mono text-slate-700 ml-1">
                      #{shortId(task.id)}
                    </span>
                  </div>
                )}
              </div>

              {task ? (
                <div className="p-5 space-y-5">

                  {/* Task prompt */}
                  <div>
                    <p className="text-base font-medium text-white leading-snug mb-1.5">
                      {task.prompt}
                    </p>
                    <a
                      href={task.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 hover:text-blue-400 transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M5 1C2.79 1 1 2.79 1 5c0 1.77 1.15 3.27 2.74 3.8.2.04.27-.09.27-.19v-.68c-1.11.24-1.34-.54-1.34-.54-.18-.46-.44-.58-.44-.58-.36-.25.03-.24.03-.24.4.03.61.41.61.41.35.6.93.43 1.15.33.04-.26.14-.43.25-.53-.88-.1-1.8-.44-1.8-1.96 0-.43.15-.79.41-1.06-.04-.1-.18-.5.04-.95 0 0 .34-.11 1.1.41A3.83 3.83 0 0 1 5 3.33c.34 0 .68.05 1 .14.76-.52 1.1-.41 1.1-.41.22.45.08.85.04.95.26.27.4.63.4 1.06 0 1.53-.93 1.86-1.81 1.96.14.12.27.37.27.75v1.11c0 .1.07.23.27.19C7.85 8.27 9 6.77 9 5c0-2.21-1.79-4-4-4z" fill="currentColor" />
                      </svg>
                      {task.repository}
                    </a>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800/60" />

                  {/* Pipeline */}
                  <AgentPipeline task={task} />

                  {/* Collapsible plan */}
                  {task.plan && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowPlan((v) => !v)}
                        className="flex items-center gap-2 text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors select-none mb-2"
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" fill="none"
                          aria-hidden="true"
                          className={`transition-transform duration-150 ${showPlan ? 'rotate-90' : ''}`}
                        >
                          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {showPlan ? 'Hide plan' : 'Show generated plan'}
                      </button>
                      {showPlan && (
                        <pre className="overflow-x-auto rounded-xl bg-black/40 border border-slate-800/60 px-4 py-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {task.plan}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Execution log */}
                  {task.logs.length > 0 && (
                    <div className="rounded-xl bg-black/40 border border-slate-800/60 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/40">
                        <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-slate-600 select-none">
                          Log
                        </span>
                        <span className="ml-auto text-[10px] font-mono text-slate-700">
                          {task.logs.length} lines
                        </span>
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1.5">
                        {task.logs.map((log) => (
                          <LogLine key={log.id} log={log} />
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <EmptyTaskState />
              )}
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">

              <div className="px-5 py-3 border-b border-slate-800/60">
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-500 select-none">
                  Recent tasks
                </span>
              </div>

              {loadingTasks ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-slate-600 font-mono">Loading…</p>
                </div>
              ) : tasks.length > 0 ? (
                <div className="py-1">
                  {tasks.map((t) => {
                    const isSelected = currentTask?.id === t.id;
                    const isLive = ACTIVE_STATUSES.includes(t.status);

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { void selectTask(t.id); }}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors
                          ${isSelected
                            ? 'bg-blue-500/8 border-l-2 border-blue-500/60'
                            : 'border-l-2 border-transparent hover:bg-slate-800/30'
                          }`}
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className={`h-2 w-2 rounded-full ${STATUS_DOT[t.status]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug line-clamp-2 mb-1 ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                            {t.prompt}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-600 truncate max-w-[140px]">
                              {t.repository}
                            </span>
                            <span className="text-slate-800 text-[10px] select-none">·</span>
                            <span className="text-[10px] font-mono text-slate-700">
                              {relativeTime(t.createdAt)}
                            </span>
                            {isLive && (
                              <>
                                <span className="text-slate-800 text-[10px] select-none">·</span>
                                <span className="flex items-center gap-1 text-[10px] font-mono text-blue-400/70">
                                  <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse" />
                                  live
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-slate-600 mb-1">No tasks yet</p>
                  <p className="text-xs text-slate-700">Run your first task to see it here.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
