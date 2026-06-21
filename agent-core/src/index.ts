import { AgentStepResult, CodeChange, ExecutionContext, ProgressCallback, TaskExecutionResult } from './types';
import {
  ProductManagerAgent,
  ArchitectAgent,
  BackendAgent,
  FrontendAgent,
  DatabaseAgent,
  DevOpsAgent,
} from './agents/base';

// Keep accumulated context below this to avoid token-per-minute rate limits
const MAX_CONTEXT_CHARS = 12_000;

function truncate(text: string, maxChars = MAX_CONTEXT_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... [truncated]';
}

function parseCodeChanges(output: string): CodeChange[] {
  try {
    const parsed = JSON.parse(output) as { files?: CodeChange[] };
    return Array.isArray(parsed.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

function buildRepoSection(context: ExecutionContext): string {
  const { repoContext } = context;
  if (!repoContext) return '';

  const keyFilesSection = Object.entries(repoContext.keyFiles)
    .slice(0, 15)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``)
    .join('\n\n');

  return `
## Repository: ${context.repository}
## Framework: ${repoContext.framework ?? 'unknown'}
## Dependencies: ${(repoContext.dependencies ?? []).slice(0, 30).join(', ')}

## Repository File Structure
\`\`\`
${repoContext.structure}
\`\`\`

## Key File Contents
${keyFilesSection}
`.trim();
}

export class AgentCoordinator {
  private agents = {
    productManager: new ProductManagerAgent(),
    architect: new ArchitectAgent(),
    backend: new BackendAgent(),
    frontend: new FrontendAgent(),
    database: new DatabaseAgent(),
    devops: new DevOpsAgent(),
  };

  async executeTask(
    prompt: string,
    context: ExecutionContext,
    onProgress?: ProgressCallback
  ): Promise<TaskExecutionResult> {
    const steps: AgentStepResult[] = [];
    console.log(`\nStarting task execution for: ${prompt}\n`);

    const repoSection = buildRepoSection(context);
    const baseInput = `## Task\n${prompt}\n\n${repoSection}`;

    try {
      const plan = await this.runStep(
        this.agents.productManager,
        baseInput,
        context,
        steps,
        onProgress
      );

      const design = await this.runStep(
        this.agents.architect,
        truncate(`${baseInput}\n\n## Execution Plan\n${plan}`),
        context,
        steps,
        onProgress
      );

      const dbChanges = await this.runStep(
        this.agents.database,
        truncate(`${baseInput}\n\n## Execution Plan\n${plan}\n\n## Architecture Design\n${design}`),
        context,
        steps,
        onProgress
      );

      const backendCode = await this.runStep(
        this.agents.backend,
        truncate(`${baseInput}\n\n## Execution Plan\n${plan}\n\n## Architecture Design\n${design}\n\n## Database Changes\n${dbChanges}`),
        context,
        steps,
        onProgress
      );

      const frontendCode = await this.runStep(
        this.agents.frontend,
        truncate(`${baseInput}\n\n## Execution Plan\n${plan}\n\n## Architecture Design\n${design}\n\n## Backend Changes\n${backendCode}`),
        context,
        steps,
        onProgress
      );

      const validation = await this.runStep(
        this.agents.devops,
        truncate(`${baseInput}\n\n## Execution Plan\n${plan}\n\n## Architecture Design\n${design}\n\n## Database Changes\n${dbChanges}\n\n## Backend Changes\n${backendCode}\n\n## Frontend Changes\n${frontendCode}`),
        context,
        steps,
        onProgress
      );

      const codeChanges = [
        ...parseCodeChanges(dbChanges),
        ...parseCodeChanges(backendCode),
        ...parseCodeChanges(frontendCode),
      ];

      console.log('\nTask execution completed');

      return {
        success: true,
        steps,
        plan,
        design,
        dbChanges,
        backendCode,
        frontendCode,
        validation,
        codeChanges,
      };
    } catch (error) {
      console.error('Task execution failed:', error);
      return {
        success: false,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async runStep(
    agent: {
      name: string;
      type: AgentStepResult['agentType'];
      run: (input: string, context: ExecutionContext) => Promise<string>;
    },
    input: string,
    context: ExecutionContext,
    steps: AgentStepResult[],
    onProgress?: ProgressCallback
  ): Promise<string> {
    await onProgress?.({ agentType: agent.type, agentName: agent.name, status: 'started' });
    try {
      const output = await agent.run(input, context);
      steps.push({ agentType: agent.type, agentName: agent.name, output });
      await onProgress?.({ agentType: agent.type, agentName: agent.name, status: 'completed', output });
      return output;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      steps.push({ agentType: agent.type, agentName: agent.name, error: errMsg });
      await onProgress?.({ agentType: agent.type, agentName: agent.name, status: 'failed', error: errMsg });
      throw error;
    }
  }
}

export * from './types';
