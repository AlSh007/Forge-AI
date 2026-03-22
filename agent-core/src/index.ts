import { ExecutionContext } from './types';
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

  async executeTask(prompt: string, context: ExecutionContext): Promise<any> {
    console.log(`\n📋 Starting task execution for: ${prompt}\n`);

    try {
      // Step 1: Product Manager breaks down the task
      console.log('1️⃣  Planning...');
      const plan = await this.agents.productManager.run(prompt, context);
      console.log('Plan:', plan);

      // Step 2: Architect designs approach
      console.log('\n2️⃣  Designing architecture...');
      const design = await this.agents.architect.run(prompt, context);
      console.log('Design:', design);

      // Step 3: Parallel implementation (would be parallel in production)
      console.log('\n3️⃣  Implementing...');
      
      // Database changes first
      const dbChanges = await this.agents.database.run(prompt, context);
      console.log('Database:', dbChanges);

      // Backend implementation
      const backendCode = await this.agents.backend.run(prompt, context);
      console.log('Backend:', backendCode);

      // Frontend implementation
      const frontendCode = await this.agents.frontend.run(prompt, context);
      console.log('Frontend:', frontendCode);

      // Step 4: Validation
      console.log('\n4️⃣  Validating...');
      const validation = await this.agents.devops.run(prompt, context);
      console.log('Validation:', validation);

      console.log('\n✅ Task execution completed');
      
      return {
        success: true,
        plan,
        design,
        dbChanges,
        backendCode,
        frontendCode,
        validation,
      };
    } catch (error) {
      console.error('❌ Task execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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

  coordinator.executeTask('Add JWT authentication to the API', context);
}
