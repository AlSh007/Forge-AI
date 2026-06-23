import axios, { AxiosError } from 'axios';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = 4096;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MAX_RETRIES = 4;
const DEFAULT_MAX_TOOL_ITERATIONS = 4;

// ─── OpenAI-compatible tool-calling types ───────────────────────────────────────

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMToolCall {
  id: string;
  type?: 'function';
  function: { name: string; arguments: string };
}

export interface ChatResultMessage {
  content: string | null;
  tool_calls?: LLMToolCall[];
}

export interface ChatRequest {
  model: string;
  max_tokens: number;
  messages: unknown[];
  tools?: LLMTool[];
  tool_choice?: 'auto' | 'none';
}

/** Executes a single tool call and returns the result fed back to the model. */
export type ToolDispatcher = (name: string, args: Record<string, unknown>) => Promise<string>;

/** Transport for one chat-completion round-trip. Injectable for testing. */
export type ChatTransport = (req: ChatRequest) => Promise<ChatResultMessage>;

function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }
  return apiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Single chat-completion round-trip with retry/backoff on 429. */
const chatCompletion: ChatTransport = async (req) => {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await axios.post<{
        choices: Array<{ message: ChatResultMessage }>;
      }>(`${GROQ_BASE_URL}/chat/completions`, req, {
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      });

      const message = response.data.choices[0]?.message;
      if (!message) {
        throw new Error('Empty response from Groq');
      }
      return message;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 429 && attempt < MAX_RETRIES) {
        // Respect Retry-After header if present, otherwise exponential backoff
        const retryAfter = axiosErr.response?.headers?.['retry-after'];
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(2 ** attempt * 5_000, 60_000);

        console.log(`[LLM] Rate limited. Retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        attempt++;
        continue;
      }

      throw err;
    }
  }

  throw new Error('Max retries exceeded for LLM call');
};

/** Single-shot completion — returns the model's text response. */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS
): Promise<string> {
  const message = await chatCompletion({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });
  return message.content ?? '';
}

/**
 * Tool-calling completion. Runs an OpenAI-style loop: the model may request tool
 * calls, which are dispatched and fed back, until it returns a final text answer
 * or the iteration cap is hit. Bounded to avoid runaway loops and token blowup.
 */
export async function callLLMWithTools(
  systemPrompt: string,
  userMessage: string,
  options: {
    tools: LLMTool[];
    dispatch: ToolDispatcher;
    model?: string;
    maxTokens?: number;
    maxIterations?: number;
    transport?: ChatTransport;
  }
): Promise<string> {
  const {
    tools,
    dispatch,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    maxIterations = DEFAULT_MAX_TOOL_ITERATIONS,
    transport = chatCompletion,
  } = options;

  const messages: unknown[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const message = await transport({
      model,
      max_tokens: maxTokens,
      messages,
      tools,
      tool_choice: 'auto',
    });

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? '';
    }

    // The assistant turn carrying the tool_calls must precede the tool results.
    messages.push({
      role: 'assistant',
      content: message.content ?? '',
      tool_calls: message.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: tc.function,
      })),
    });

    for (const toolCall of message.tool_calls) {
      let result: string;
      try {
        const args = toolCall.function.arguments
          ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
          : {};
        result = await dispatch(toolCall.function.name, args);
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : 'tool execution failed'}`;
      }
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
    }
  }

  // Iteration cap reached — force a final text answer without offering tools.
  const finalMessage = await transport({ model, max_tokens: maxTokens, messages });
  return finalMessage.content ?? '';
}
