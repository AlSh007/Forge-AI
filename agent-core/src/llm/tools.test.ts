import { callLLMWithTools, ChatRequest, ChatResultMessage, ChatTransport, LLMToolCall } from './client';
import { REPO_TOOLS, makeRepoDispatcher } from './tools';
import { RepoAccess } from '../types';

const repo: RepoAccess = {
  async readFile(path) {
    return path === 'src/index.ts' ? 'export const x = 1;' : null;
  },
  async listFiles() {
    return ['src/index.ts', 'src/app.ts', 'README.md'];
  },
  async searchFiles(query) {
    return ['src/index.ts', 'src/app.ts', 'README.md'].filter((p) =>
      p.toLowerCase().includes(query.toLowerCase())
    );
  },
};

const dispatch = makeRepoDispatcher(repo);

const tc = (id: string, name: string, args: unknown): LLMToolCall => ({
  id,
  function: { name, arguments: JSON.stringify(args) },
});

type ToolMsg = { role: string; content: string; tool_call_id?: string; tool_calls?: unknown };

describe('makeRepoDispatcher', () => {
  it('read_file returns file content', async () => {
    expect(await dispatch('read_file', { path: 'src/index.ts' })).toBe('export const x = 1;');
  });

  it('read_file on a missing path reports not found', async () => {
    expect(await dispatch('read_file', { path: 'nope.ts' })).toMatch(/^File not found/);
  });

  it('read_file without a path returns an error', async () => {
    expect(await dispatch('read_file', {})).toMatch(/^Error/);
  });

  it('list_files returns every path', async () => {
    expect((await dispatch('list_files', {})).split('\n')).toHaveLength(3);
  });

  it('search_files filters by substring', async () => {
    expect(await dispatch('search_files', { query: 'app' })).toBe('src/app.ts');
  });

  it('search_files without a query returns an error', async () => {
    expect(await dispatch('search_files', {})).toMatch(/^Error/);
  });

  it('an unknown tool returns an error', async () => {
    expect(await dispatch('nope', {})).toMatch(/unknown tool/);
  });

  it('caps oversized file content', async () => {
    const bigRepo: RepoAccess = { ...repo, async readFile() { return 'a'.repeat(10_000); } };
    const out = await makeRepoDispatcher(bigRepo)('read_file', { path: 'big.ts' });
    expect(out.length).toBeLessThan(10_000);
    expect(out).toMatch(/\[truncated\]$/);
  });
});

describe('callLLMWithTools', () => {
  it('returns immediately when the model requests no tools', async () => {
    let calls = 0;
    const transport: ChatTransport = async () => {
      calls++;
      return { content: 'immediate' };
    };
    const out = await callLLMWithTools('sys', 'user', { tools: REPO_TOOLS, dispatch, transport });
    expect(out).toBe('immediate');
    expect(calls).toBe(1);
  });

  it('dispatches tool calls, feeds results back, then returns the final answer', async () => {
    const seen: ChatRequest[] = [];
    const script: ChatResultMessage[] = [
      { content: null, tool_calls: [tc('c1', 'read_file', { path: 'src/index.ts' })] },
      { content: null, tool_calls: [tc('c2', 'list_files', {})] },
      { content: '{"files":[],"description":"done"}' },
    ];
    let i = 0;
    const transport: ChatTransport = async (req) => {
      seen.push(req);
      return script[i++];
    };

    const out = await callLLMWithTools('sys', 'user', { tools: REPO_TOOLS, dispatch, transport, maxIterations: 4 });

    expect(out).toBe('{"files":[],"description":"done"}');
    expect(seen).toHaveLength(3);

    const finalMessages = seen[2].messages as ToolMsg[];
    const toolResults = finalMessages.filter((m) => m.role === 'tool');
    expect(toolResults).toHaveLength(2);
    expect(toolResults.some((m) => m.content === 'export const x = 1;')).toBe(true);
    expect(finalMessages.some((m) => m.role === 'assistant' && m.tool_calls)).toBe(true);
  });

  it('forces a final no-tools answer when the iteration cap is reached', async () => {
    const seen: ChatRequest[] = [];
    let i = 0;
    const transport: ChatTransport = async (req) => {
      seen.push(req);
      if (!req.tools) return { content: 'FORCED FINAL' };
      return { content: null, tool_calls: [tc('x' + i++, 'list_files', {})] };
    };

    const out = await callLLMWithTools('sys', 'user', { tools: REPO_TOOLS, dispatch, transport, maxIterations: 2 });

    expect(out).toBe('FORCED FINAL');
    expect(seen).toHaveLength(3); // 2 loop iterations + 1 forced final
    expect(seen[2].tools).toBeUndefined();
  });

  it('captures a tool error as a result and keeps going', async () => {
    const throwingDispatch = async () => {
      throw new Error('boom');
    };
    const seen: ChatRequest[] = [];
    const script: ChatResultMessage[] = [
      { content: null, tool_calls: [tc('e1', 'read_file', { path: 'x' })] },
      { content: 'recovered' },
    ];
    let i = 0;
    const transport: ChatTransport = async (req) => {
      seen.push(req);
      return script[i++];
    };

    const out = await callLLMWithTools('sys', 'user', { tools: REPO_TOOLS, dispatch: throwingDispatch, transport });

    expect(out).toBe('recovered');
    const toolResult = (seen[1].messages as ToolMsg[]).find((m) => m.role === 'tool');
    expect(toolResult?.content).toMatch(/boom/);
  });
});
