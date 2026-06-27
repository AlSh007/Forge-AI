import { Agent, AgentType, ExecutionContext } from '../types';
import { callLLM, callLLMWithTools, FAST_MODEL, SCOUT_MODEL, CODE_MODEL } from '../llm/client';
import { REPO_TOOLS, makeRepoDispatcher } from '../llm/tools';

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

  /**
   * Generate a response. When the host provides repo access, the agent runs the
   * full tool-calling loop so it can read files before producing output.
   * Falls back to a single-shot completion when no repo access is available.
   */
  protected async generate(
    systemPrompt: string,
    input: string,
    context: ExecutionContext,
    maxTokens?: number,
    maxIterations?: number,
    model?: string
  ): Promise<string> {
    if (context.repoAccess) {
      return callLLMWithTools(systemPrompt, input, {
        tools: REPO_TOOLS,
        dispatch: makeRepoDispatcher(context.repoAccess),
        ...(maxTokens ? { maxTokens } : {}),
        ...(maxIterations ? { maxIterations } : {}),
        ...(model ? { model } : {}),
      });
    }
    return callLLM(systemPrompt, input, model, maxTokens);
  }
}

// ─── Shared tool workflow instructions ───────────────────────────────────────
//
// Appended to every code-generating agent. Separated so the workflow reminder
// stays consistent across agents while the agent-specific rules stay clean.

const TOOL_WORKFLOW = `
## Repository tools — mandatory reading sequence

You have three tools. Follow this sequence before producing any output:

1. list_files() — see the complete file tree. Understand the layout.
2. search_files(query) — find relevant files. Use the feature name, route name, model name, component name as queries. Run multiple searches.
3. read_file(path) — read EVERY file you will create or modify, plus:
   - The main entry point (index.ts / app.ts / server.ts / main.ts)
   - Any type/interface files your changes depend on
   - Shared utilities or middleware your code will call
   - Related files that import or are imported by what you're changing

Do not skip to writing until you have read the relevant files. Code that ignores the actual codebase produces wrong imports, duplicated logic, and style violations.

Your FINAL message must be raw JSON only — no markdown fences, no explanation before or after the JSON.`.trimStart();

// ─── Product Manager ──────────────────────────────────────────────────────────

const PM_SYSTEM = `You are a senior technical product manager embedded in an engineering team. \
You receive a task and the repository file structure. \
Your job is to produce a concise, actionable execution plan for downstream engineers.

Your plan must include:

1. Task summary — 1-2 sentences on exactly what needs to be built or changed.
2. Affected files — list the specific file paths that will be created or modified. \
   Use actual paths from the repository structure; do not invent paths.
3. Implementation steps — ordered bullet points, concise but specific. \
   Reference actual function names, route paths, model fields where visible.
4. External requirements — new env vars, packages, or migration steps needed.
5. Key edge cases the implementation must handle.

Keep the plan under 400 words. Do NOT include code blocks or code snippets — \
prose descriptions only. Engineers will write the actual code. \
Output plain text only — no JSON, no markdown code fences.`;

export class ProductManagerAgent extends BaseAgent {
  constructor() {
    super('ProductManager', AgentType.PRODUCT_MANAGER);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Analyzing task for ${context.repository}`);
    return callLLM(PM_SYSTEM, input, FAST_MODEL);
  }
}

// ─── Architect ────────────────────────────────────────────────────────────────

const ARCHITECT_SYSTEM = `You are a senior software architect. \
Your job is to design the technical approach for the given task, grounded in the ACTUAL codebase — \
not a hypothetical one.

The repository structure and key file contents are already provided above. \
Study them carefully before designing.

Produce a technical design covering:

1. Files changed — for each file: what new functions/routes/types are added, what existing code is modified, and why.
2. Data flow — how the change flows from the entry point through the layers to storage or the response.
3. New types, interfaces, or schemas — define them concretely with field names and types.
4. Integration points — what existing code calls or is called by the new code. Be specific about function signatures and where they live.
5. Invariants to preserve — what the code-generating agents must NOT break.

Reference actual function names, file paths, and type names from the provided codebase. \
Output plain text only.`;

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super('Architect', AgentType.ARCHITECT);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Designing architecture for ${context.repository}`);
    return callLLM(ARCHITECT_SYSTEM, input, FAST_MODEL);
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────

const DATABASE_SYSTEM = `You are an expert database engineer. \
Determine whether the task requires any database schema or migration changes.

The repository's key files — including schema.prisma or any SQL migration files — are provided \
in the "Key File Contents" section above. Read them carefully.

Decision criteria:
- Only recommend schema changes that are DIRECTLY required by the task (new tables, new columns, new indexes).
- Adding a new API endpoint, changing business logic, or adding frontend components never requires schema changes.
- If the existing schema already supports the feature, output an empty files array.

Respond with JSON in exactly this format:
{"files": [{"path": "relative/path/to/file.sql", "content": "file content here"}], "description": "what changed and why"}

If no schema changes are needed:
{"files": [], "description": "No schema changes required — reason here"}

Output raw JSON only — no markdown fences, no explanation before or after.`;

export class DatabaseAgent extends BaseAgent {
  constructor() {
    super('Database', AgentType.DATABASE);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Planning schema changes for ${context.repository}`);
    // Schema is pre-loaded in the key files section — no tool calls needed.
    // Uses Llama 4 Scout (30K TPM, separate bucket from 8B and 70B models).
    return callLLM(DATABASE_SYSTEM, input, SCOUT_MODEL);
  }
}

// ─── Backend ──────────────────────────────────────────────────────────────────

const BACKEND_SYSTEM = `You are an expert backend/API engineer. \
The key source files — including the actual backend entry point and storage layer — are provided \
in the "Key File Contents" section above. Read every provided file carefully before writing.

## Output format (strict — raw JSON only, no markdown fences, no prose before or after)
{"files": [{"path": "relative/path/to/file.ts", "content": "COMPLETE file content here"}], "description": "brief summary of what changed"}

## Critical rules
- Write COMPLETE file contents — the entire file, not a diff or a snippet.
- PRESERVE all existing code. When modifying a file like backend/src/index.ts:
  • Keep every existing import exactly as written in the provided file.
  • Keep every existing route, middleware, and handler that is already there.
  • Only ADD new code — do not remove or restructure existing code.
  • Use the same import paths, variable names, and patterns as the provided file.
- Only include files that must change for this specific task. Do not create files for things that already exist.
- Never invent service classes or imports that do not exist in the provided source files.
  Use the actual storage/service patterns from the files shown above.
- JSON escaping rule: every backslash (\\) in TypeScript source must become \\\\\\\\ in JSON.
  Specifically for regex literals — WRONG: "content": "\\/path" (JSON strips backslash → /path)
  CORRECT: "content": "\\\\/path" (JSON preserves → \\/path = escaped slash in TS regex)
  If a regex is hard to escape, write it as new RegExp('^pattern$', 'flags') with a plain string.`;

export class BackendAgent extends BaseAgent {
  constructor() {
    super('Backend', AgentType.BACKEND);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Generating backend code for ${context.repository}`);
    // Single-shot with key files pre-loaded. Avoids tool-call overhead while
    // still giving the model the real source code it needs to match patterns.
    // Llama 4 Scout (30K TPM) keeps this in a separate rate-limit bucket from PM/Architect.
    return callLLM(BACKEND_SYSTEM, input, SCOUT_MODEL, 4096);
  }
}

// ─── Frontend ─────────────────────────────────────────────────────────────────

const FRONTEND_SYSTEM = `You are an expert frontend engineer. \
The key source files — pages, components, and API utilities — are provided in the \
"Key File Contents" section above. Study them carefully before writing.

## CRITICAL: Only modify frontend files
You MUST ONLY output files under the \`frontend/\` directory. \
NEVER output backend files (backend/*, prisma/*, etc.) — those are handled by a different agent. \
If no frontend changes are needed, say so explicitly.

## Output format (strict — raw JSON only, no markdown fences, no prose before or after)
{"files": [{"path": "frontend/path/to/file.tsx", "content": "COMPLETE file content here"}], "description": "brief summary"}

If no frontend changes are required:
{"files": [], "description": "No frontend changes required — reason here"}

## Code rules
- Write COMPLETE file contents — the entire file, not a diff or a snippet.
- Include ONLY files that must change for this specific task.
- PRESERVE all existing code in modified files — keep every existing component, hook, and route.
  Only ADD new code.
- Match the existing codebase exactly:
  • Same styling system (Tailwind classes, CSS modules — whatever is used in the shown files)
  • Same component structure and naming patterns as provided files
  • Same state management approach (useState, Zustand, Redux — whatever is in use)
  • Same API call patterns (fetch, axios, react-query, SWR — whatever is used)
  • Same TypeScript patterns (interfaces, type aliases, generics)
- JSON escaping rule: every backslash (\\) in TypeScript/TSX source must become \\\\\\\\ in JSON.
  If a regex is hard to escape, use new RegExp('^pattern$', 'flags') with a plain string instead.`;

export class FrontendAgent extends BaseAgent {
  constructor() {
    super('Frontend', AgentType.FRONTEND);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Generating frontend code for ${context.repository}`);
    return callLLM(FRONTEND_SYSTEM, input, SCOUT_MODEL, 4096);
  }
}

// ─── DevOps ───────────────────────────────────────────────────────────────────

const DEVOPS_SYSTEM = `You are a senior DevOps engineer and practical code reviewer. \
Your role is to verify that the generated code is a USEFUL, SHIPPABLE implementation \
of the requested feature — not a perfect one.

## What to review
Assess the plan and generated code changes for:
1. Correctness — does it implement the core feature as described in the task? Does the logic make sense?
2. Integration — does it look like it fits the existing codebase structure and patterns?
3. Critical safety — any hardcoded credentials, plaintext secrets, SQL injection, or broken authentication?
4. Completeness — is the PRIMARY requirement implemented? (Not side-concerns like tests or verbose logging.)

## Verdict criteria

PASS when:
- The code implements the requested feature and follows the repo's patterns.
- Imperfect code is acceptable: missing tests, simplified error handling, minimal logging, \
  minor edge cases not handled. These are iterative improvements, not release blockers.
- You would accept this as a useful starting point that moves the codebase forward.

FAIL only when ONE OR MORE of these is true:
- The code has a bug that would cause a runtime crash on the normal use path.
- There is a critical security flaw: exposed credentials, injectable input, broken auth check.
- The primary feature is entirely absent — the code simply does not do what the task asked.
- The generated files would conflict so badly with the existing structure that they cannot be applied.

DO NOT fail for: missing tests, incomplete logging, simplified error handling, code that could be \
refactored, missing edge cases for uncommon inputs, or anything that is a "nice to have" rather than \
a "must have" for the feature to work.

## Output

Write a concise review (3-6 bullet points covering the checks above), then on the FINAL LINE \
and nowhere else, write:

VERDICT: PASS — <one-line reason>
or
VERDICT: FAIL — <one-line reason>

Output plain text only.`;

export class DevOpsAgent extends BaseAgent {
  constructor() {
    super('DevOps', AgentType.DEVOPS);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Validating changes for ${context.repository}`);
    // Llama 4 Scout: 30K TPM bucket; DevOps reviews can be large (all generated code).
    return callLLM(DEVOPS_SYSTEM, input, SCOUT_MODEL);
  }
}
