import { Agent, AgentType, ExecutionContext } from '../types';

// Base implementation for all agents
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

  protected error(message: string): void {
    console.error(`[${this.name}] ERROR: ${message}`);
  }
}

// Product Manager Agent - Breaks user prompts into tasks
export class ProductManagerAgent extends BaseAgent {
  constructor() {
    super('ProductManager', AgentType.PRODUCT_MANAGER);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Analyzing task: ${input}`);

    const plan = {
      taskId: context.taskId,
      steps: [
        'Analyze repository structure',
        'Design implementation approach',
        'Identify required changes',
        'Create test plan',
      ],
      estimatedTime: '30 minutes',
    };

    return JSON.stringify(plan, null, 2);
  }
}

// Architect Agent - Designs technical approach
export class ArchitectAgent extends BaseAgent {
  constructor() {
    super('Architect', AgentType.ARCHITECT);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Designing architecture for: ${input}`);

    const design = {
      repository: context.repository,
      approach: 'Modular implementation',
      components: ['Task API', 'Execution tracking', 'Dashboard updates'],
      dependencies: ['Express', 'Prisma', 'Next.js'],
      migrations: [],
    };

    return JSON.stringify(design, null, 2);
  }
}

// Backend Agent - Implements server logic
export class BackendAgent extends BaseAgent {
  constructor() {
    super('Backend', AgentType.BACKEND);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Implementing backend: ${input}`);
    return `Prepared backend execution plan for ${context.repository}`;
  }
}

// Frontend Agent - Creates UI components
export class FrontendAgent extends BaseAgent {
  constructor() {
    super('Frontend', AgentType.FRONTEND);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Implementing frontend: ${input}`);
    return `Prepared frontend workflow for task ${context.taskId}`;
  }
}

// Database Agent - Handles schema changes
export class DatabaseAgent extends BaseAgent {
  constructor() {
    super('Database', AgentType.DATABASE);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Handling database changes: ${input}`);
    return `Repository metadata and task persistence reviewed for ${context.repository}`;
  }
}

// DevOps Agent - Handles testing and validation
export class DevOpsAgent extends BaseAgent {
  constructor() {
    super('DevOps', AgentType.DEVOPS);
  }

  async run(input: string, context: ExecutionContext): Promise<string> {
    this.log(`Running validation: ${input}`);
    return `Validation complete for branch ${context.branch}`;
  }
}
