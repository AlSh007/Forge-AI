# ForgeAI System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  - Task Submission Dashboard                                 │
│  - Task Tracking & Monitoring                                │
│  - PR Status Viewer                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express/Node)                     │
│  - REST API Endpoints                                        │
│  - Task Orchestration                                        │
│  - Database Management                                       │
│  - GitHub Integration                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    ┌──────────────┐   ┌──────────────────────┐
    │  Agent Core  │   │  PostgreSQL Database │
    │              │   │  (Task, Exec Logs)   │
    │ - Agents     │   └──────────────────────┘
    │ - Orchestration
    │ - Tools      │
    └────┬─────────┘
         │
    ┌────┴────────────────────────┐
    │   Sandbox Execution Layer    │
    │   (Docker Containers)        │
    │                              │
    │ - Clone Repository           │
    │ - Install Dependencies       │
    │ - Generate Code              │
    │ - Run Tests                  │
    │ - Execute Validation         │
    └──────────────────────────────┘
```

## Component Details

### 1. Frontend (Next.js)
- **Purpose:** User interface for task submission and monitoring
- **Technologies:** React, TypeScript, TailwindCSS, Zustand
- **Features:**
  - Task submission form
  - Real-time execution monitoring
  - PR status tracking
  - Historical analytics

### 2. Backend API (Express)
- **Purpose:** Handle task management, orchestration, GitHub integration
- **Technologies:** Express, TypeScript, PostgreSQL, Prisma ORM
- **Endpoints:**
  - `POST /api/tasks` - Create new task
  - `GET /api/tasks/:id` - Get task details
  - `POST /api/tasks/:id/execute` - Start execution
  - `GET /api/executions` - Get execution logs

### 3. Agent Core
- **Purpose:** Multi-agent orchestration system
- **Agents:**
  - **ProductManagerAgent** - Breaks prompts into actionable steps
  - **ArchitectAgent** - Designs technical approach
  - **BackendAgent** - Implements server logic
  - **FrontendAgent** - Creates UI components
  - **DatabaseAgent** - Handles schema migrations
  - **DevOpsAgent** - Runs validation & tests

### 4. Sandbox Environment
- **Purpose:** Isolated execution for code generation and testing
- **Technology:** Docker
- **Capabilities:**
  - Repository cloning
  - Dependency installation
  - Code generation
  - Test execution
  - Validation checks

### 5. Database (PostgreSQL)
- **Purpose:** Store tasks, executions, logs, and PRs
- **Schema:**
  - Users
  - Tasks
  - AgentExecutions
  - PullRequests
  - ExecutionLogs
  - Repositories

## Data Flow

### Task Execution Flow

```
1. User submits task prompt
   ↓
2. Backend creates Task record
   ↓
3. AgentCoordinator receives task
   ↓
4. ProductManager breaks down prompt
   ↓
5. Architect designs approach
   ↓
6. Parallel agent execution:
   - Database agent creates migrations
   - Backend agent generates code
   - Frontend agent creates components
   ↓
7. DevOps agent validates:
   - Linting
   - Type checking
   - Unit tests
   - Integration tests
   ↓
8. If validation passes:
   - Create git branch
   - Commit changes
   - Push to server
   - Create PR via GitHub API
   ↓
9. Human review and merge
```

## Security Architecture

```
┌──────────────────────────────────────────────────┐
│          GitHub OAuth Authentication             │
│  (Securely store tokens, refresh as needed)      │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│      Permission Boundary & Rate Limiting         │
│  (Prevent abuse, enforce user quotas)            │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│     Sandbox Isolation (Docker Containers)        │
│  - Network isolation                             │
│  - Resource limits (CPU, memory, disk)           │
│  - Read-only file systems where needed           │
│  - Process isolation                             │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│       Tool Access Control                        │
│  - Agents can only use approved tools            │
│  - No direct shell access                        │
│  - Secret environment variables protected        │
└──────────────────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling
- **API Layer:** Stateless Express servers behind load balancer
- **Agent Execution:** Queue-based system (Bull/RabbitMQ) for parallel task processing
- **Database:** PostgreSQL with read replicas for scaling queries

### Caching Strategy
- **Repository Metadata:** Cache project structure and dependencies
- **Embeddings:** Cache code embeddings for faster search
- **LLM Responses:** Cache common code generation patterns

## Monitoring & Observability

```
Application Metrics:
- Task completion rate
- Average execution time
- Agent error rates
- PR acceptance rate

Infrastructure Metrics:
- Sandbox container utilization
- Database query performance
- API response times
- Error rates by endpoint

Tools:
- OpenTelemetry for distributed tracing
- Structured logging
- Prometheus metrics
- Grafana dashboards
```

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│         GitHub Actions CI/CD             │
│  - Run tests on every commit             │
│  - Build Docker images                   │
│  - Deploy to staging/production          │
└────────────────┬────────────────────────┘
                 ▼
         ┌──────────────────┐
         │   Docker Registry │
         │  (Container Hub)  │
         └────────┬─────────┘
                  ▼
    ┌─────────────────────────────┐
    │  Production Environment      │
    │  (Kubernetes or Docker)      │
    │  - Frontend (Vercel/Nginx)   │
    │  - Backend (Node)            │
    │  - PostgreSQL (RDS)          │
    └─────────────────────────────┘
```
