import {
  AgentCoordinator,
  AgentStepResult,
  AgentType as CoordinatorAgentType,
  ExecutionContext,
  TaskExecutionResult,
} from 'forgeai-agent-core';
import { AgentType, ExecutionStatus, LogLevel, TaskStatus, storage, TaskRecord } from './storage';

const coordinator = new AgentCoordinator();

const agentTypeMap: Record<CoordinatorAgentType, AgentType> = {
  [CoordinatorAgentType.PRODUCT_MANAGER]: AgentType.PRODUCT_MANAGER,
  [CoordinatorAgentType.ARCHITECT]: AgentType.ARCHITECT,
  [CoordinatorAgentType.BACKEND]: AgentType.BACKEND,
  [CoordinatorAgentType.FRONTEND]: AgentType.FRONTEND,
  [CoordinatorAgentType.DATABASE]: AgentType.DATABASE,
  [CoordinatorAgentType.DEVOPS]: AgentType.DEVOPS,
};

function createExecutionContext(task: TaskRecord): ExecutionContext {
  return {
    taskId: task.id,
    repository: task.repositoryUrl,
    branch: `forge/${task.id}`,
    userId: task.userId,
    environment: {
      nodeVersion: process.version,
      framework: 'repository-driven',
    },
  };
}

async function persistStep(task: TaskRecord, prompt: string, step: AgentStepResult): Promise<void> {
  const status = step.error ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS;
  const message = step.error
    ? `${step.agentName} failed: ${step.error}`
    : `${step.agentName} completed successfully.`;

  await storage.createExecution({
    taskId: task.id,
    userId: task.userId,
    agentType: agentTypeMap[step.agentType],
    status,
    input: prompt,
    output: step.output ?? null,
    error: step.error ?? null,
    logs: message,
  });

  await storage.createExecutionLog({
    taskId: task.id,
    message,
    level: step.error ? LogLevel.ERROR : LogLevel.INFO,
  });
}

async function persistExecutionResult(
  task: TaskRecord,
  result: TaskExecutionResult
): Promise<TaskRecord | null> {
  for (const step of result.steps) {
    await persistStep(task, task.prompt, step);
  }

  const nextStatus = result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
  const plan = result.plan ?? task.plan;
  await storage.updateTask(task.id, {
    status: nextStatus,
    plan,
  });

  await storage.createExecutionLog({
    taskId: task.id,
    message: result.success
      ? 'Task execution finished successfully.'
      : `Task execution failed: ${result.error ?? 'Unknown error'}`,
    level: result.success ? LogLevel.INFO : LogLevel.ERROR,
  });

  return storage.getTaskById(task.id);
}

export async function executeTask(taskId: string): Promise<TaskRecord | null> {
  const task = await storage.getTaskById(taskId);
  if (!task) {
    return null;
  }

  await storage.updateTask(task.id, {
    status: TaskStatus.PLANNING,
  });

  await storage.createExecutionLog({
    taskId: task.id,
    message: 'Task execution started.',
    level: LogLevel.INFO,
  });

  const executionContext = createExecutionContext(task);
  const result = await coordinator.executeTask(task.prompt, executionContext);

  if (result.success) {
    await storage.updateTask(task.id, {
      status: TaskStatus.IN_PROGRESS,
      plan: result.plan ?? task.plan,
    });
  }

  return persistExecutionResult(task, result);
}
