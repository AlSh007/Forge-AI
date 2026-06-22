import React from 'react';
import { AgentExecutionRecord, AgentType, TaskDetails, TaskStatus } from '../lib/api';

const ACTIVE_STATUSES: TaskStatus[] = ['PENDING', 'PLANNING', 'IN_PROGRESS', 'VALIDATING'];

interface AgentMeta {
  label: string;
  role: string;
  working: string;
}

const AGENT_META: Record<AgentType, AgentMeta> = {
  PRODUCT_MANAGER: {
    label: 'Product Manager',
    role: 'Requirements & scope',
    working: 'Analyzing requirements and defining the execution plan…',
  },
  ARCHITECT: {
    label: 'Architect',
    role: 'System design',
    working: 'Designing technical architecture and component structure…',
  },
  DATABASE: {
    label: 'Database',
    role: 'Schema & migrations',
    working: 'Planning data model changes and SQL migrations…',
  },
  BACKEND: {
    label: 'Backend',
    role: 'Server-side code',
    working: 'Writing API endpoints and server-side logic…',
  },
  FRONTEND: {
    label: 'Frontend',
    role: 'UI components',
    working: 'Building React components and interface views…',
  },
  DEVOPS: {
    label: 'DevOps',
    role: 'Validation & review',
    working: 'Reviewing correctness, security, and edge cases…',
  },
};

const PIPELINE_ORDER: AgentType[] = [
  'PRODUCT_MANAGER',
  'ARCHITECT',
  'DATABASE',
  'BACKEND',
  'FRONTEND',
  'DEVOPS',
];

type PipelineStatus = 'pending' | 'running' | 'done' | 'failed';

function getStatus(agentType: AgentType, executions: AgentExecutionRecord[]): PipelineStatus {
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
        .slice(0, 2)
        .map((f) => f.path)
        .join(', ');
      return `${count} file${count === 1 ? '' : 's'} — ${paths}${count > 2 ? ', …' : ''}`;
    }
    if (parsed.description) return parsed.description.slice(0, 100);
  } catch {
    // plain text
  }
  const firstLine = output.split('\n').find((l) => l.trim()) ?? output;
  return firstLine.trim().slice(0, 100);
}

// ── Node indicators ─────────────────────────────────────────────────────────

function NodeDone() {
  return (
    <div className="h-5 w-5 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center flex-shrink-0">
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
        <path
          d="M1.5 4.5l2 2L7.5 2"
          stroke="#34D399"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function NodeRunning() {
  return (
    <div className="relative h-5 w-5 flex-shrink-0 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-blue-400/20 animate-ping" />
      <div className="h-5 w-5 rounded-full border border-blue-400/50 bg-blue-950/60 flex items-center justify-center">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
      </div>
    </div>
  );
}

function NodeFailed() {
  return (
    <div className="h-5 w-5 rounded-full bg-rose-950 border border-rose-500/50 flex items-center justify-center flex-shrink-0">
      <span className="text-rose-400 text-[9px] font-bold leading-none select-none">✕</span>
    </div>
  );
}

function NodePending({ index }: { index: number }) {
  return (
    <div className="h-5 w-5 rounded-full border border-slate-800 bg-slate-900/40 flex items-center justify-center flex-shrink-0">
      <span className="text-slate-700 text-[9px] font-mono leading-none">
        {String(index + 1).padStart(2, '0')}
      </span>
    </div>
  );
}

// ── Connector rail between nodes ─────────────────────────────────────────────

function Connector({ top, bottom }: { top: PipelineStatus; bottom: PipelineStatus }) {
  const flowing = top === 'done' && bottom === 'running';
  const solid = top === 'done' && (bottom === 'done' || bottom === 'failed');

  return (
    <div className="relative w-px flex-1 my-0.5 overflow-hidden">
      {solid && <div className="absolute inset-0 bg-emerald-500/25" />}
      {flowing && <div className="absolute inset-0 pipeline-flow" />}
      {!solid && !flowing && <div className="absolute inset-0 bg-slate-800/70" />}
    </div>
  );
}

// ── Agent cards ──────────────────────────────────────────────────────────────

function RunningCard({ meta }: { meta: AgentMeta }) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-b from-blue-950/25 to-slate-900/10 overflow-hidden">
      {/* Scan beam sweeping across the top edge */}
      <div className="h-px w-full relative overflow-hidden bg-blue-900/20">
        <div className="absolute top-0 left-0 h-full w-[45%] bg-gradient-to-r from-transparent via-blue-400/90 to-transparent pipeline-scan" />
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="text-sm font-semibold text-white tracking-tight">{meta.label}</span>
          {/* Bouncing dots — communicates live inference */}
          <span className="flex items-center gap-[3px]" aria-label="Working">
            <span className="h-[3px] w-[3px] rounded-full bg-blue-400/70 animate-bounce bounce-d0" />
            <span className="h-[3px] w-[3px] rounded-full bg-blue-400/70 animate-bounce bounce-d1" />
            <span className="h-[3px] w-[3px] rounded-full bg-blue-400/70 animate-bounce bounce-d2" />
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-blue-300/50">{meta.working}</p>
      </div>
    </div>
  );
}

function DoneCard({ meta, exec }: { meta: AgentMeta; exec: AgentExecutionRecord }) {
  const preview = exec.output ? getOutputPreview(exec.output) : null;

  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/20 px-4 py-2.5 transition-all duration-300">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-sm font-medium text-slate-300 flex-shrink-0">{meta.label}</span>
        {preview && (
          <>
            <span className="text-slate-700 text-xs flex-shrink-0 select-none">—</span>
            <span className="text-[11px] text-slate-500 font-mono truncate">{preview}</span>
          </>
        )}
      </div>
    </div>
  );
}

function FailedCard({ meta, exec }: { meta: AgentMeta; exec?: AgentExecutionRecord }) {
  return (
    <div className="rounded-lg border border-rose-900/40 bg-rose-950/15 px-4 py-2.5">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-sm font-medium text-rose-300 flex-shrink-0">{meta.label}</span>
        {exec?.error && (
          <span className="text-[11px] text-rose-500/80 truncate font-mono">{exec.error.slice(0, 70)}</span>
        )}
      </div>
    </div>
  );
}

function PendingCard({ meta }: { meta: AgentMeta }) {
  return (
    <div className="px-1 py-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-slate-600">{meta.label}</span>
        <span className="text-[11px] text-slate-700 truncate">{meta.role}</span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AgentPipeline({ task }: { task: TaskDetails }) {
  const isLive = ACTIVE_STATUSES.includes(task.status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-slate-500 select-none">
          Agent Pipeline
        </span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] text-blue-400/60 font-mono">live</span>
          </span>
        )}
      </div>

      {/* Agents */}
      <div>
        {PIPELINE_ORDER.map((agentType, index) => {
          const status = getStatus(agentType, task.executions);
          const nextType = PIPELINE_ORDER[index + 1];
          const nextStatus = nextType ? getStatus(nextType, task.executions) : 'pending';
          const exec = task.executions.find((e) => e.agentType === agentType);
          const meta = AGENT_META[agentType];
          const isLast = index === PIPELINE_ORDER.length - 1;

          return (
            <div key={agentType} className="flex gap-3">
              {/* Rail column */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                {status === 'done'    && <NodeDone />}
                {status === 'running' && <NodeRunning />}
                {status === 'failed'  && <NodeFailed />}
                {status === 'pending' && <NodePending index={index} />}

                {!isLast && (
                  <Connector top={status} bottom={nextStatus} />
                )}
              </div>

              {/* Card column */}
              <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-2.5'}`}>
                {status === 'running' && <RunningCard meta={meta} />}
                {status === 'done'    && exec && <DoneCard meta={meta} exec={exec} />}
                {status === 'failed'  && <FailedCard meta={meta} exec={exec} />}
                {status === 'pending' && <PendingCard meta={meta} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
