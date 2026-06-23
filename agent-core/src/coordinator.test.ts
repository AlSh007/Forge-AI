// Stub the LLM so the coordinator runs offline. PM/Architect/DevOps get plain
// text; code-gen agents fall back to callLLM here (no repoAccess in the context).
jest.mock('./llm/client', () => ({
  callLLM: jest.fn(async () => 'STUB_OUTPUT'),
  callLLMWithTools: jest.fn(async () => '{"files":[]}'),
}));

import { AgentCoordinator, AgentProgressEvent, ExecutionContext } from './index';

function makeContext(): ExecutionContext {
  return {
    taskId: 't1',
    repository: 'owner/repo',
    branch: 'forge/t1',
    userId: 'u1',
    environment: {},
  };
}

describe('AgentCoordinator input threading', () => {
  it('emits each agent input on its started event', async () => {
    const coordinator = new AgentCoordinator();
    const started: AgentProgressEvent[] = [];

    await coordinator.executeTask('Add a health endpoint', makeContext(), (event) => {
      if (event.status === 'started') started.push(event);
    });

    // All six agents announced a start carrying a non-empty input.
    expect(started).toHaveLength(6);
    for (const event of started) {
      expect(typeof event.input).toBe('string');
      expect(event.input && event.input.length).toBeGreaterThan(0);
      expect(event.input).toContain('Add a health endpoint');
    }
  });

  it('threads a prior agent output into a later agent input', async () => {
    const coordinator = new AgentCoordinator();
    const started: AgentProgressEvent[] = [];

    await coordinator.executeTask('Add a health endpoint', makeContext(), (event) => {
      if (event.status === 'started') started.push(event);
    });

    // The Architect (second agent) input should include the PM's output.
    expect(started[1].input).toContain('STUB_OUTPUT');
  });
});
