export interface Agent {
  name: string;
  type: AgentType;
  run(input: string, context: ExecutionContext): Promise<string>;
}

export enum AgentType {
  PRODUCT_MANAGER = 'product-manager',
  ARCHITECT = 'architect',
  BACKEND = 'backend',
  FRONTEND = 'frontend',
  DATABASE = 'database',
  DEVOPS = 'devops',
}

export interface Tool {
  name: string;
  description: string;
  execute(input: unknown): Promise<unknown>;
}

export interface AgentResult {
  success: boolean;
  output: string;
  logs: string[];
  errors?: string[];
}

export interface AgentStepResult {
  agentType: AgentType;
  agentName: string;
  output?: string;
  error?: string;
}

export interface CodeChange {
  path: string;
  content: string;
}

export interface TaskExecutionResult {
  success: boolean;
  steps: AgentStepResult[];
  plan?: string;
  design?: string;
  dbChanges?: string;
  backendCode?: string;
  frontendCode?: string;
  validation?: string;
  codeChanges?: CodeChange[];
  error?: string;
}

export interface RepoContext {
  structure: string;
  keyFiles: Record<string, string>;
  framework?: string;
  dependencies?: string[];
}

export interface ExecutionContext {
  taskId: string;
  repository: string;
  branch: string;
  userId: string;
  environment: {
    nodeVersion?: string;
    pythonVersion?: string;
    framework?: string;
  };
  repoContext?: RepoContext;
}

export type AgentProgressEvent = {
  agentType: AgentType;
  agentName: string;
  status: 'started' | 'completed' | 'failed';
  output?: string;
  error?: string;
};

export type ProgressCallback = (event: AgentProgressEvent) => void | Promise<void>;
