import axios, { AxiosError } from 'axios';

// Primary code-generation model: Llama 3.3 70B (128K context, highest quality).
// Falls back to Mixtral when the 70B daily quota is exhausted.
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
// Fast planning/review model: 8B instant, 6K TPM bucket. Use only for PM/Architect
// (tiny prompts ≈1K tokens each, so both fit comfortably within the 6K/min limit).
export const FAST_MODEL = 'llama-3.1-8b-instant';
// Intermediate model: Llama 4 Scout has a separate 30K TPM bucket and works for
// single-shot text generation (but NOT for tool-calling via the Groq compat API).
export const SCOUT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
// Code-generation model: 70B is the only Groq model that reliably executes
// tool calls via the OpenAI-compat API. Used only for Backend and Frontend.
export const CODE_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = 4096;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MAX_RETRIES = 8;
const DEFAULT_MAX_TOOL_ITERATIONS = 8;

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

      // 429 = rate limited; 413 = Groq sometimes uses this when TPM is exhausted.
      if ((status === 429 || status === 413) && attempt < MAX_RETRIES) {
        const retryAfter = axiosErr.response?.headers?.['retry-after'];
        const resetTokens = axiosErr.response?.headers?.['x-ratelimit-reset-tokens'];
        const resetSecs = resetTokens
          ? parseFloat(String(resetTokens))
          : retryAfter
            ? Number(retryAfter)
            : Math.min(2 ** attempt * 5, 120);
        // Enforce a 15-second minimum so the TPM bucket has time to meaningfully
        // replenish before the next request, even when the header says <1s.
        const waitMs = Math.max(Math.min(Math.ceil(resetSecs) * 1000, 120_000), 15_000);

        console.log(`[LLM] Rate limited (${status}). Retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
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
