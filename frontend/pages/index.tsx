import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { TaskForm, TaskFormValues } from '../components/TaskForm';
import { TaskDetails, TaskStatus, executionApi, taskApi } from '../lib/api';
import { useTaskStore } from '../lib/store';

const statusClasses: Record<TaskStatus, string> = {
  PENDING: 'bg-slate-500/20 text-slate-200 border-slate-400/30',
  PLANNING: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  VALIDATING: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  FAILED: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  CANCELLED: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
};

function formatStatus(status: TaskStatus): string {
  return status.replace(/_/g, ' ');
}

function prettyPrintPlan(plan: string | null): string {
  if (!plan) {
    return 'No plan available yet.';
  }

  try {
    return JSON.stringify(JSON.parse(plan), null, 2);
  } catch {
    return plan;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong while talking to the API.';
}

export default function Home() {
  const { tasks, currentTask, setTasks, setCurrentTask, addTask, updateTask } = useTaskStore();
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTasks();
  }, []);

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

      const executedTaskResponse = await executionApi.startExecution(createdTaskResponse.task.id);
      updateTask(executedTaskResponse.task.id, executedTaskResponse.task);
      setCurrentTask(executedTaskResponse.task);

      const refreshedTasks = await taskApi.getAll();
      setTasks(refreshedTasks.tasks);
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setError(message);
      throw submitError;
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
          <h1 className="text-5xl font-bold text-white mb-4">Autonomous Task Execution Dashboard</h1>
          <p className="max-w-3xl text-lg text-slate-300">
            The first working slice now creates tasks, runs the coordinator, and shows stored
            execution history from the API.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8">
          <div className="space-y-8">
            <TaskForm onSubmit={handleSubmit} submitting={submitting} error={error} />

            <section className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Current Task</h2>
                  <p className="text-slate-400">
                    Inspect the stored plan, execution steps, and backend logs.
                  </p>
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

                  <div>
                    <p className="text-sm text-slate-400 mb-2">Generated Plan</p>
                    <pre className="overflow-x-auto rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-sm text-slate-200">
                      {prettyPrintPlan(selectedTask.plan)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-3">Execution Steps</p>
                    <div className="space-y-3">
                      {selectedTask.executions.length > 0 ? (
                        selectedTask.executions.map((execution) => (
                          <div
                            key={execution.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                          >
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <p className="text-sm font-semibold text-white">
                                {execution.agentType.replace(/_/g, ' ')}
                              </p>
                              <span className="text-xs text-slate-400">{execution.status}</span>
                            </div>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">
                              {execution.output ?? execution.logs ?? execution.error ?? 'No output'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400">No executions recorded yet.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-3">Execution Log</p>
                    <div className="space-y-2">
                      {selectedTask.logs.length > 0 ? (
                        selectedTask.logs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-4 text-xs text-slate-400 mb-1">
                              <span>{log.level}</span>
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-200">{log.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400">No logs available yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">
                  Create your first task to see the execution timeline show up here.
                </p>
              )}
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-2">Recent Tasks</h2>
              <p className="text-slate-400 mb-6">
                Click any task to inspect its latest persisted state.
              </p>

              {loadingTasks ? (
                <p className="text-slate-400">Loading tasks...</p>
              ) : tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        void selectTask(task.id);
                      }}
                      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/60 p-4 hover:border-blue-400/40 transition"
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
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">
                  No tasks yet. Submit one from the panel on the left to seed the timeline.
                </p>
              )}
            </section>

            <section className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4">What This Slice Proves</h2>
              <div className="space-y-4 text-slate-300">
                <p>Tasks are persisted through the backend instead of living only in the UI.</p>
                <p>The agent coordinator runs and writes step-by-step execution history.</p>
                <p>The dashboard now reflects task state, plan output, and execution logs.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
