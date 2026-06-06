import { AgentStepResult, ExecutionContext, TaskExecutionResult } from './types';
import {
  ProductManagerAgent,
  ArchitectAgent,
  BackendAgent,
  FrontendAgent,
  DatabaseAgent,
  DevOpsAgent,
} from './agents/base';

// Agent Coordinator - Orchestrates multi-agent workflow
export class AgentCoordinator {
  private agents = {
    productManager: new ProductManagerAgent(),
    architect: new ArchitectAgent(),
    backend: new BackendAgent(),
    frontend: new FrontendAgent(),
    database: new DatabaseAgent(),
    devops: new DevOpsAgent(),
  };

  async executeTask(prompt: string, context: ExecutionContext): Promise<TaskExecutionResult> {
    const steps: AgentStepResult[] = [];
    console.log(`\nStarting task execution for: ${prompt}\n`);

    try {
      const plan = await this.runStep(this.agents.productManager, prompt, context, steps);
      const design = await this.runStep(this.agents.architect, prompt, context, steps);
      const dbChanges = await this.runStep(this.agents.database, prompt, context, steps);
      const backendCode = await this.runStep(this.agents.backend, prompt, context, steps);
      const frontendCode = await this.runStep(this.agents.frontend, prompt, context, steps);
      const validation = await this.runStep(this.agents.devops, prompt, context, steps);

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
    prompt: string,
    context: ExecutionContext,
    steps: AgentStepResult[]
  ): Promise<string> {
    try {
      const output = await agent.run(prompt, context);
      steps.push({
        agentType: agent.type,
        agentName: agent.name,
        output,
      });
      return output;
    } catch (error) {
      steps.push({
        agentType: agent.type,
        agentName: agent.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Example usage
if (require.main === module) {
  const coordinator = new AgentCoordinator();
  const context = {
    taskId: 'task-123',
    repository: 'https://github.com/user/repo',
    branch: 'feature/auth',
    userId: 'user-456',
    environment: {
      nodeVersion: '18',
      framework: 'Express',
    },
  };

  void coordinator.executeTask('Add JWT authentication to the API', context);
}

export * from './types';
