import axios, { AxiosError } from 'axios';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = 4096;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MAX_RETRIES = 4;

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

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS
): Promise<string> {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await axios.post<{
        choices: Array<{ message: { content: string } }>;
      }>(
        `${GROQ_BASE_URL}/chat/completions`,
        {
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Groq');
      }
      return content;
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
}
