# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ForgeAI is an autonomous AI coding agent platform. Users submit development task prompts; the system orchestrates 6 specialized agents (ProductManager, Architect, Database, Backend, Frontend, DevOps) to analyze the codebase, generate code, validate it, and optionally create pull requests.

## Monorepo Structure

npm workspaces with three packages:

- `backend/` — Express.js REST API, task orchestration, Prisma ORM, dual storage layer
- `frontend/` — Next.js 14 dashboard for task submission and execution monitoring
- `agent-core/` — Multi-agent orchestration framework (`AgentCoordinator` + 6 agents + Groq LLM client)
- `docs/` — Architecture docs, roadmap, setup guides

## First-time Setup

```bash
npm install                    # installs all workspace deps including concurrently
# backend/.env already exists — set GITHUB_TOKEN if you want PR creation
npm run dev                    # builds agent-core, then starts all three servers
```

Servers: backend → `http://localhost:4000`, frontend → `http://localhost:3000`

## Commands

### Root
```bash
npm run dev     # build agent-core first, then start all three servers via concurrently
npm run build   # build all workspaces in dependency order
npm run test    # run tests across all workspaces
npm run lint    # lint all workspaces
```

### Per-workspace
```bash
npm run dev -w backend       # Express server on port 4000 (requires agent-core built first)
npm run dev -w frontend      # Next.js on port 3000
npm run dev -w agent-core    # TypeScript watch mode (tsc -w)

npm run test -w backend
npm run test -w frontend
npm run test -w agent-core

npm run migrate -w backend       # Prisma migrations (requires DATABASE_URL)
npm run db:push -w backend       # Sync schema without migration file
npm run prisma:studio -w backend # Prisma GUI
```

**Important**: The backend imports `forgeai-agent-core` from `agent-core/dist/`. Always build agent-core before starting the backend (`npm run build -w agent-core`). `npm run dev` handles this automatically.

## Architecture

### Request Flow
1. User submits task (prompt + repo URL) via frontend form
2. Frontend immediately calls `POST /api/tasks` then `POST /api/tasks/:id/execute`
3. Backend fetches GitHub repo context (file tree + key file contents) via GitHub API
4. `AgentCoordinator` runs 6 agents sequentially, each receiving the full accumulated context:
   - **ProductManagerAgent** → execution plan (plain text)
   - **ArchitectAgent** → technical design (plain text)
   - **DatabaseAgent** → schema changes (`{"files": [...]}` JSON)
   - **BackendAgent** → server-side code (`{"files": [...]}` JSON)
   - **FrontendAgent** → UI components (`{"files": [...]}` JSON)
   - **DevOpsAgent** → validation report (plain text)
5. Code-generating agents return JSON with file paths + content; coordinator collects all `CodeChange[]`
6. If `GITHUB_TOKEN` set: creates branch, commits files, opens PR
7. Results persisted; frontend shows execution steps, logs, and plan

### Backend (`backend/src/`)
- `index.ts` — Express server; endpoints: `GET/POST /api/tasks`, `POST /api/tasks/:id/execute`, `GET /api/executions`, `GET /api/pull-requests`
- `storage.ts` — Dual adapter: Prisma if `DATABASE_URL` set, else in-memory Map (survives without a DB)
- `execution.ts` — Orchestration: fetches repo context → runs coordinator → creates PR
- `github.ts` — GitHub REST API via native `fetch`: repo tree, branch creation, file commits, PR creation
- `prisma/schema.prisma` — Models: Task, AgentExecution, ExecutionLog, PullRequest, Repository, User

### Agent Core (`agent-core/src/`)
- `index.ts` — `AgentCoordinator`; builds enriched prompts threading each agent's output into the next
- `agents/base.ts` — All 6 agent classes; each calls `callLLM` with a specialized system prompt
- `llm/client.ts` — Groq client (OpenAI-compatible SDK pointing at `api.groq.com/openai/v1`)
- `types.ts` — Shared types: `ExecutionContext`, `CodeChange`, `RepoContext`, `TaskExecutionResult`

### Frontend (`frontend/`)
- `pages/index.tsx` — Dashboard: task form, recent task list, execution steps + log display
- `lib/api.ts` — Axios client; `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:4000`)
- `lib/store.ts` — Zustand store for task state

## Environment Variables

**`backend/.env`** (already created):
- `GROQ_API_KEY` — required for LLM inference (console.groq.com/keys)
- `GITHUB_TOKEN` — optional; enables branch + PR creation
- `DATABASE_URL` — optional; PostgreSQL connection string (omit to use in-memory storage)
- `PORT` — defaults to 4000

**`frontend/.env.local`** (already created):
- `NEXT_PUBLIC_API_URL=http://localhost:4000`

## Key Design Decisions

- **Stateless storage fallback**: No database required for development. `ForgeStorage` auto-selects between Prisma and in-memory based on `DATABASE_URL`.
- **Agent context threading**: Each agent receives all prior agents' outputs in its prompt, building cumulative context.
- **Code change parsing**: Backend/Frontend/Database agents return `{"files": [...]}` JSON; coordinator collects and deduplicates all `CodeChange[]` for PR commit.
- **Groq LLM**: Default model `llama-3.3-70b-versatile` via OpenAI-compatible API. Change `DEFAULT_MODEL` in `agent-core/src/llm/client.ts` to swap models.

## TypeScript

Strict mode enabled. All packages extend root `tsconfig.json`. Backend targets ES2020 with `@types/node@20` (which provides `fetch` globals). Agent-core generates `.d.ts` declaration files.
