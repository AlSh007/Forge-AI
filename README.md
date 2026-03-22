# ForgeAI – Autonomous Software Engineering Agents

A platform for autonomous AI coding agents that can handle full-stack development tasks: analyze codebases, generate code, validate through tests, and create pull requests automatically.

## Project Structure

```
forgeai/
├── backend/          # Node.js API server & agent orchestration
├── frontend/         # Next.js dashboard UI
├── agent-core/       # Agent framework & logic
├── docs/             # Documentation & architecture
└── package.json      # Monorepo workspace configuration
```

## Tech Stack

- **Frontend:** Next.js, React, TailwindCSS
- **Backend:** Node.js, TypeScript, Express
- **Agents:** LangGraph / OpenAI Agents SDK
- **Database:** PostgreSQL
- **Sandbox:** Docker
- **LLM:** OpenAI / Anthropic APIs

## Getting Started

### Prerequisites

- Node.js 18+ with npm 7+
- Docker
- PostgreSQL

### Installation

```bash
# Install dependencies for all workspaces
npm install

# Set up environment variables
cp .env.example .env.local

# Run development servers
npm run dev
```

## Development Phases

- [ ] Phase 1: Foundation & Core Infrastructure
- [ ] Phase 2: Agent Framework & Core Logic
- [ ] Phase 3: Task Execution Pipeline
- [ ] Phase 4: Frontend & User Interface
- [ ] Phase 5: Security & Hardening
- [ ] Phase 6: Testing & Deployment
- [ ] Phase 7: MVP Launch & Iteration

## Contributing

This project is under active development. Check `/docs` for detailed architecture and roadmap.

## License

MIT
