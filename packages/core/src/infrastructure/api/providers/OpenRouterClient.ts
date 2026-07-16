/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API for AI-powered analysis
 */

import { LogSink } from '@/platform';
import {
  ContextCompressionState,
  InferenceRequestObservation,
  TokenUsage
} from '@shared/types';

const FALLBACK_OUTPUT_RESERVE_TOKENS = 10000;

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  usage?: { include: boolean };
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    // Some providers may include cost fields via OpenRouter
    cost?: number;
    cost_details?: {
      upstream_inference_cost?: number;
    }
  };
  openrouter_metadata?: unknown;
}

/** Normalize only the material context-compression fact; discard all raw router metadata. */
export const normalizeContextCompression = (metadata: unknown): ContextCompressionState => {
  if (metadata === undefined || metadata === null) return 'unknown';
  if (typeof metadata !== 'object' || Array.isArray(metadata)) return 'unknown';
  // Only an explicit pipeline that omits the stage proves "not applied";
  // metadata without a readable pipeline is schema drift, not evidence.
  const pipeline = (metadata as { pipeline?: unknown }).pipeline;
  if (!Array.isArray(pipeline)) return 'unknown';
  return pipeline.some(stage => (
    typeof stage === 'object' &&
    stage !== null &&
    !Array.isArray(stage) &&
    (stage as { type?: unknown }).type === 'context_compression'
  )) ? 'applied' : 'not-applied';
};

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private model: string;
  private readonly outputChannel?: LogSink;

  constructor(apiKey: string, model?: string, outputChannel?: LogSink) {
    this.apiKey = apiKey;
    this.model = model || 'z-ai/glm-4.6';
    this.outputChannel = outputChannel;
  }

  getModel(): string {
    return this.model;
  }

  /** Future requests use the new model; an already-dispatched fetch is unchanged. */
  setModel(model: string): void {
    const normalized = model.trim();
    if (!normalized) {
      throw new Error('OpenRouter model id cannot be empty');
    }
    this.model = normalized;
  }

  async createChatCompletion(
    messages: OpenRouterMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
    }
  ): Promise<{
    content: string;
    finishReason?: string;
    usage?: TokenUsage;
    observation?: InferenceRequestObservation;
    id?: string;
  }> {
    const requestedModel = this.model;
    const requestedMaxOutputTokens = options?.maxTokens ?? FALLBACK_OUTPUT_RESERVE_TOKENS;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/okeylanders/prose-minion-vscode',
        'X-Title': 'Prose Minion VS Code Extension',
        'X-OpenRouter-Metadata': 'enabled'
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: requestedModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: requestedMaxOutputTokens,
        usage: { include: true }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenRouter API');
    }

    const usage = this.toTokenUsage(data.usage);
    return {
      id: data.id,
      content: data.choices[0].message.content,
      finishReason: data.choices[0]?.finish_reason,
      usage,
      observation: usage ? this.toObservation(
        data.model || requestedModel,
        requestedMaxOutputTokens,
        usage,
        data.choices[0]?.finish_reason,
        data.openrouter_metadata
      ) : undefined
    };
  }

  /**
   * Create a streaming chat completion using Server-Sent Events (SSE).
   * Yields tokens progressively as they arrive from the server.
   * When cancelled via signal, server stops generating (saves tokens).
   */
  async *createStreamingChatCompletion(
    messages: OpenRouterMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
    }
  ): AsyncGenerator<{
    token: string;
    done: boolean;
    usage?: TokenUsage;
    finishReason?: string;
    observation?: InferenceRequestObservation;
  }> {
    const requestedModel = this.model;
    const requestedMaxOutputTokens = options?.maxTokens ?? FALLBACK_OUTPUT_RESERVE_TOKENS;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/okeylanders/prose-minion-vscode',
        'X-Title': 'Prose Minion VS Code Extension',
        'X-OpenRouter-Metadata': 'enabled'
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: requestedModel,
        messages,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: requestedMaxOutputTokens,
        stream_options: { include_usage: true }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenRouter API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      let finishReason: string | undefined;
      let usage: TokenUsage | undefined;
      let responseModel = requestedModel;
      let routerMetadata: unknown;
      let terminalEmitted = false;
      const terminal = () => ({
        token: '',
        done: true,
        usage,
        finishReason,
        observation: usage ? this.toObservation(
          responseModel,
          requestedMaxOutputTokens,
          usage,
          finishReason,
          routerMetadata
        ) : undefined
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            continue;
          }

          const data = trimmedLine.slice(6);
          if (data === '[DONE]') {
            terminalEmitted = true;
            yield terminal();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const token = delta?.content || '';
            const finish = parsed.choices?.[0]?.finish_reason;
            const chunkUsage = this.toTokenUsage(parsed.usage);

            if (finish) {
              finishReason = finish;
            }
            if (chunkUsage) usage = chunkUsage;
            if (typeof parsed.model === 'string' && parsed.model) responseModel = parsed.model;
            if (parsed.openrouter_metadata !== undefined) routerMetadata = parsed.openrouter_metadata;

            if (token) {
              yield { token, done: false };
            }

          } catch (error) {
            // Log for debugging but don't fail the stream
            this.outputChannel?.appendLine(
              `[OpenRouterClient] Skipped malformed JSON chunk: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
      if (!terminalEmitted && (finishReason || usage)) yield terminal();
    } catch (error) {
      // Cancel the underlying stream body on abort
      if (response.body) {
        await response.body.cancel().catch(() => {});
      }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Check if API key is configured
   */
  static isConfigured(apiKey?: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  private toTokenUsage(raw: any): TokenUsage | undefined {
    if (!raw) return undefined;
    const cost = raw.cost ?? raw.costUsd ?? raw.cost_usd;
    const costNum = cost !== undefined && cost !== null ? Number(cost) : undefined;
    return {
      promptTokens: Number(raw.prompt_tokens) || 0,
      completionTokens: Number(raw.completion_tokens) || 0,
      totalTokens: Number(raw.total_tokens) || 0,
      costUsd: Number.isFinite(costNum) ? costNum : undefined
    };
  }

  private toObservation(
    modelId: string,
    requestedMaxOutputTokens: number,
    usage: TokenUsage,
    finishReason: string | undefined,
    routerMetadata: unknown
  ): InferenceRequestObservation {
    const contextCompression = normalizeContextCompression(routerMetadata);
    if (routerMetadata !== undefined && contextCompression === 'unknown') {
      this.outputChannel?.appendLine(
        '[OpenRouterClient] Router metadata schema did not contain a readable pipeline; context compression is unknown.'
      );
    }
    return {
      modelId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUsd: usage.costUsd,
      requestedMaxOutputTokens,
      finishReason,
      contextCompression,
      measuredAt: Date.now()
    };
  }
}
