// Base Agent interface
export interface Agent {
  name: string;
  type: AgentType;
  run(input: string, context: any): Promise<string>;
}

export enum AgentType {
  PRODUCT_MANAGER = 'product-manager',
  ARCHITECT = 'architect',
  BACKEND = 'backend',
  FRONTEND = 'frontend',
  DATABASE = 'database',
  DEVOPS = 'devops',
}

// Tool interface for agents to use
export interface Tool {
  name: string;
  description: string;
  execute(input: any): Promise<any>;
}

// Agent execution result
export interface AgentResult {
  success: boolean;
  output: string;
  logs: string[];
  errors?: string[];
}

// Task execution context
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
}
