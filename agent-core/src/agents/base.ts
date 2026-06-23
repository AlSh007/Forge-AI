import { Agent, AgentType, ExecutionContext } from '../types';
import { callLLM } from '../llm/client';

export abstract class BaseAgent implements Agent {
  name: string;
  type: AgentType;

  constructor(name: string, type: AgentType) {
    this.name = name;
    this.type = type;
  }

  abstract run(input: string, context: ExecutionContext): Promise<string>;

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

// ─── Product Manager ──────────────────────────────────────────────────────────

const PM_SYSTEM = `You are a senior technical product manager. Given a development task and repository context, produce a structured execution plan.

Your plan must include:
1. Task summary (1-2 sentences)
2. Key requirements (bullet list)
3. Ordered implementation steps
4. Files likely to be created or modified
5. Risks or edge cases to watch for

Be concise and precise. Output plain text only.`;

export class ProductManagerAgent extends BaseAgent {
  constructor() {
    super('ProductManager', AgentType.PRODUCT_MANAGER);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Analyzing task for ${context.repository}`);
    return callLLM(PM_SYSTEM, input);
  }
}

// ─── Architect ────────────────────────────────────────────────────────────────

const ARCHITECT_SYSTEM = `You are a senior software architect. Given a development task, execution plan, and codebase context, design the technical approach.

Cover:
1. Architecture decisions and rationale
2. Components that need to change
3. New data models or schema changes (if any)
4. API surface changes (if any)
5. Dependencies to add (if any)

Be specific to the codebase provided. Output plain text only.`;

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super('Architect', AgentType.ARCHITECT);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Designing architecture for ${context.repository}`);
    return callLLM(ARCHITECT_SYSTEM, input);
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────

const DATABASE_SYSTEM = `You are an expert database engineer. Given a development task, execution plan, and architecture design, determine the required database/schema changes.

If schema changes are needed, respond with JSON in this exact format:
{"files": [{"path": "relative/path/to/migration.sql", "content": "SQL content here"}], "description": "what changed and why"}

If no schema changes are needed, respond with:
{"files": [], "description": "No schema changes required"}

Output raw JSON only — no markdown, no code fences.`;

export class DatabaseAgent extends BaseAgent {
  constructor() {
    super('Database', AgentType.DATABASE);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Planning schema changes for ${context.repository}`);
    return callLLM(DATABASE_SYSTEM, input);
  }
}

// ─── Backend ──────────────────────────────────────────────────────────────────

const BACKEND_SYSTEM = `You are an expert backend engineer. Given a development task, plan, architecture design, and existing codebase, generate the required server-side code changes.

Respond with JSON in this exact format:
{"files": [{"path": "relative/path/to/file.ts", "content": "complete file content here"}], "description": "brief description of what was changed"}

Rules:
- Include only files that need to be created or modified
- Write complete file contents (not diffs or snippets)
- Match the existing code style, language, and framework shown in the codebase
- Do not add files outside the repository structure shown
- Output raw JSON only — no markdown, no code fences`;

export class BackendAgent extends BaseAgent {
  constructor() {
    super('Backend', AgentType.BACKEND);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Generating backend code for ${context.repository}`);
    return callLLM(BACKEND_SYSTEM, input, undefined, 8192);
  }
}

// ─── Frontend ─────────────────────────────────────────────────────────────────

const FRONTEND_SYSTEM = `You are an expert frontend engineer. Given a development task, plan, architecture design, backend changes, and existing codebase, generate the required UI code changes.

Respond with JSON in this exact format:
{"files": [{"path": "relative/path/to/file.tsx", "content": "complete file content here"}], "description": "brief description of what was changed"}

Rules:
- Include only files that need to be created or modified
- Write complete file contents (not diffs or snippets)
- Match the existing framework, styling approach, and code patterns shown
- If no frontend changes are required, respond with: {"files": [], "description": "No frontend changes required"}
- Output raw JSON only — no markdown, no code fences`;

export class FrontendAgent extends BaseAgent {
  constructor() {
    super('Frontend', AgentType.FRONTEND);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Generating frontend code for ${context.repository}`);
    return callLLM(FRONTEND_SYSTEM, input, undefined, 8192);
  }
}

// ─── DevOps ───────────────────────────────────────────────────────────────────

const DEVOPS_SYSTEM = `You are a senior DevOps and QA engineer. Review the development plan and all generated code changes for correctness, security, and quality.

Your review must cover:
1. Correctness — does the code do what the task requires?
2. Security — any injection risks, exposed secrets, missing auth checks?
3. Breaking changes — will this break existing functionality?
4. Missing pieces — anything the task required but not implemented?

Then, on the FINAL line and nowhere else, emit a machine-readable verdict in exactly this format:
VERDICT: PASS — <one-line reason>
or
VERDICT: FAIL — <one-line reason>

Use FAIL if the changes have correctness bugs, security issues, or are missing required functionality. Output plain text only.`;

export class DevOpsAgent extends BaseAgent {
  constructor() {
    super('DevOps', AgentType.DEVOPS);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Validating changes for ${context.repository}`);
    return callLLM(DEVOPS_SYSTEM, input);
  }
}
