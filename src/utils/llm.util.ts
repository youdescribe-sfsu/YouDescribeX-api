// src/utils/llm.util.ts

// xiao1009 Generic OpenAI chat helper for RefineAD. Business code (services) must never talk to the
// OpenAI SDK directly: it calls callLlmChat() and deals only with plain text in / plain text out,
// plus an LlmError on failure. Client creation follows openAPI.util.ts:1-9 and the request shape
// follows openAPI.util.ts:55-62. The timeout is handed to the SDK itself (same approach as
// coquiTTS.util.ts:13-14,30 does with axios) so the HTTP request is actually aborted.
import { APIConnectionTimeoutError, APIError, OpenAI } from 'openai';
import { OPENAI_API_KEY, REFINE_LLM_MODEL, REFINE_TIMEOUT_MS } from '../config';
import { AIProcessingError } from './customErrors';
import { logger } from './logger';

// xiao1009 Conservative defaults for description rewriting: a single clip is short, and a low
// temperature keeps the model close to the describer's own wording.
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.3;

const openai = new OpenAI({
  apiKey: `${OPENAI_API_KEY}`,
});

// xiao1009 Why the failure kinds are separate: the API contract distinguishes 503 (the model did not
// answer in time, retrying may work) from 502 (the model answered, but unusably).
export type LlmFailureKind = 'not_configured' | 'timeout' | 'upstream' | 'empty_response';

// xiao1009 Extends the existing AIProcessingError so any `instanceof AIProcessingError` check keeps
// working, and carries `status` so error.middleware.ts:7 turns it into 502/503 without extra mapping.
export class LlmError extends AIProcessingError {
  public status: number;
  public kind: LlmFailureKind;

  constructor(kind: LlmFailureKind, status: number, message: string) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
    this.status = status;
  }
}

// xiao1009 Model and timeout are optional so callers can override them, but they default to config.
// A model name is never hard-coded here.
export interface LlmChatParams {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmChatResult {
  text: string;
  model: string;
  responseId: string;
}

// xiao1009 One round trip to the chat completion API. Returns the assistant message trimmed but
// otherwise untouched: cleaning and validating the content is the caller's job, so that this helper
// stays reusable for prompts other than RefineAD.
export const callLlmChat = async (params: LlmChatParams): Promise<LlmChatResult> => {
  const model = params.model || REFINE_LLM_MODEL;
  const timeoutMs = params.timeoutMs || REFINE_TIMEOUT_MS;

  if (!OPENAI_API_KEY) {
    logger.error('LLM call aborted: OPENAI_API_KEY is not configured');
    throw new LlmError('not_configured', 503, 'AI service is not configured');
  }

  const startedAt = Date.now();

  try {
    const response = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        max_tokens: params.maxTokens || DEFAULT_MAX_TOKENS,
        temperature: params.temperature ?? DEFAULT_TEMPERATURE,
      },
      // xiao1009 maxRetries: 0 keeps total wall-clock within timeoutMs. The SDK retries twice by
      // default, which would silently turn a 20s budget into 60s.
      { timeout: timeoutMs, maxRetries: 0 },
    );

    const text = response.choices[0]?.message?.content?.trim();

    if (!text) {
      logger.error(`Empty response from LLM (model: ${model}, responseId: ${response.id})`);
      throw new LlmError('empty_response', 502, 'AI service returned an empty response');
    }

    // xiao1009 Prompt and description text are deliberately not logged: they are user content and
    // would bloat the daily log files. Lengths and token usage are enough to debug.
    logger.info(
      `LLM call ok (model: ${model}, ms: ${Date.now() - startedAt}, promptChars: ${params.systemPrompt.length + params.userPrompt.length}, replyChars: ${
        text.length
      }, tokens: ${response.usage?.total_tokens ?? 'n/a'})`,
    );

    return { text, model, responseId: response.id };
  } catch (error) {
    // xiao1009 Already one of ours (empty_response above): pass it through untouched.
    if (error instanceof LlmError) {
      throw error;
    }

    if (error instanceof APIConnectionTimeoutError) {
      logger.error(`LLM call timed out after ${Date.now() - startedAt}ms (model: ${model}, budget: ${timeoutMs}ms)`);
      throw new LlmError('timeout', 503, 'AI service timed out, please try again');
    }

    if (error instanceof APIError) {
      logger.error(`LLM call failed with API error (model: ${model}, status: ${error.status}, type: ${error.type}): ${error.message}`);
      throw new LlmError('upstream', 502, 'AI service request failed');
    }

    logger.error(`LLM call failed unexpectedly (model: ${model}): ${error?.message}`);
    throw new LlmError('upstream', 502, 'AI service request failed');
  }
};

export default callLlmChat;
