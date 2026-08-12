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
import { isHttpUrl, type UrlCitation } from '@messages';

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
  reasoning?: OpenRouterReasoningOptions;
  usage?: { include: boolean };
}

export interface OpenRouterReasoningOptions {
  effort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'none';
  exclude?: boolean;
}

export interface OpenRouterWebSearchTool {
  type: 'openrouter:web_search';
  parameters: {
    engine: 'auto';
    max_uses: number;
    max_total_results: number;
  };
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: unknown;
      annotations?: unknown;
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

interface OpenRouterErrorPayload {
  code?: unknown;
  message?: unknown;
  metadata?: {
    error_type?: unknown;
  };
}

/** A structured provider failure that callers can classify without parsing copy. */
export class OpenRouterApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly errorType?: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'OpenRouterApiError';
  }
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
      tools?: OpenRouterWebSearchTool[];
      reasoning?: OpenRouterReasoningOptions;
    }
  ): Promise<{
    content: string;
    finishReason?: string;
    usage?: TokenUsage;
    observation?: InferenceRequestObservation;
    id?: string;
    citations?: UrlCitation[];
  }> {
    const requestedModel = this.model;
    const requestedMaxOutputTokens = options?.maxTokens ?? FALLBACK_OUTPUT_RESERVE_TOKENS;
    const response = await this.fetchCompletion({
      model: requestedModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: requestedMaxOutputTokens,
      usage: { include: true },
      ...(options?.reasoning ? { reasoning: options.reasoning } : {}),
      ...(options?.tools ? { tools: options.tools } : {})
    }, options?.signal);

    if (!response.ok) {
      throw await this.readApiError(response);
    }

    const data = (await response.json()) as OpenRouterResponse & { error?: OpenRouterErrorPayload };

    if (data.error) {
      throw this.toApiError(data.error);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenRouter API');
    }

    const usage = this.toTokenUsage(data.usage);
    return {
      id: data.id,
      content: this.toAssistantContent(data.choices[0].message.content),
      finishReason: data.choices[0]?.finish_reason,
      usage,
      citations: this.toUrlCitations(data.choices[0].message.annotations),
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
   * OpenRouter's OpenAI-compatible response permits `message.content: null`
   * when a provider finishes without emitting a final answer. Normalize that
   * provider edge here so downstream orchestration can keep an honest string
   * contract and report an empty response instead of crashing during cleanup.
   */
  private toAssistantContent(content: unknown): string {
    if (typeof content === 'string') return content;
    this.outputChannel?.appendLine(
      `[OpenRouterClient] Provider returned ${content === null ? 'null' : typeof content} assistant content; treating it as an empty response.`
    );
    return '';
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
      tools?: OpenRouterWebSearchTool[];
      reasoning?: OpenRouterReasoningOptions;
    }
  ): AsyncGenerator<{
    token: string;
    done: boolean;
    id?: string;
    usage?: TokenUsage;
    finishReason?: string;
    observation?: InferenceRequestObservation;
    citations?: UrlCitation[];
  }> {
    const requestedModel = this.model;
    const requestedMaxOutputTokens = options?.maxTokens ?? FALLBACK_OUTPUT_RESERVE_TOKENS;
    const response = await this.fetchCompletion({
      model: requestedModel,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: requestedMaxOutputTokens,
      stream_options: { include_usage: true },
      ...(options?.reasoning ? { reasoning: options.reasoning } : {}),
      ...(options?.tools ? { tools: options.tools } : {})
    }, options?.signal);

    if (!response.ok) {
      throw await this.readApiError(response);
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
      // Tests and non-browser host adapters may provide a minimal fetch shape
      // without Headers; stream frames still carry the canonical response id.
      let responseId = response.headers?.get('X-Generation-Id') ?? undefined;
      let routerMetadata: unknown;
      let terminalEmitted = false;
      let citations: UrlCitation[] | undefined;
      const terminal = () => ({
        token: '',
        done: true,
        id: responseId,
        usage,
        finishReason,
        observation: usage ? this.toObservation(
          responseModel,
          requestedMaxOutputTokens,
          usage,
          finishReason,
          routerMetadata
        ) : undefined,
        citations
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
            if (parsed.error) {
              throw this.toApiError(parsed.error);
            }
            if (typeof parsed.id === 'string' && parsed.id) {
              responseId = parsed.id;
            }
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
            const chunkCitations = this.toUrlCitations(
              delta?.annotations ?? parsed.choices?.[0]?.message?.annotations
            );
            if (chunkCitations?.length) citations = this.mergeUrlCitations(citations, chunkCitations);

            if (token) {
              yield { token, done: false };
            }

          } catch (error) {
            if (error instanceof OpenRouterApiError) {
              throw error;
            }
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

  private async fetchCompletion(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/okeylanders/prose-minion-vscode',
          'X-Title': 'Prose Minion VS Code Extension',
          'X-OpenRouter-Metadata': 'enabled'
        },
        signal,
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new OpenRouterApiError(
        `OpenRouter request could not reach the provider: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'network'
      );
    }
  }

  private async readApiError(response: Response): Promise<OpenRouterApiError> {
    const body = await response.text();
    let payload: OpenRouterErrorPayload | undefined;
    try {
      const parsed = JSON.parse(body) as { error?: OpenRouterErrorPayload };
      payload = parsed.error;
    } catch {
      // Plain-text provider errors remain useful diagnostics.
    }
    const retryAfter = Number(response.headers?.get('Retry-After'));
    return this.toApiError(
      payload ?? { message: body },
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
    );
  }

  private toApiError(
    payload: OpenRouterErrorPayload,
    fallbackStatus?: number,
    retryAfterSeconds?: number
  ): OpenRouterApiError {
    const payloadStatus = typeof payload.code === 'number' ? payload.code : undefined;
    const status = fallbackStatus && fallbackStatus !== 200 ? fallbackStatus : payloadStatus;
    const message = typeof payload.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : 'OpenRouter could not complete the request.';
    const errorType = typeof payload.metadata?.error_type === 'string'
      ? payload.metadata.error_type
      : undefined;
    return new OpenRouterApiError(
      `OpenRouter API error${status ? ` ${status}` : ''}: ${message}`,
      status,
      errorType,
      retryAfterSeconds
    );
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

  private toUrlCitations(raw: unknown): UrlCitation[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const rejectedTypes: string[] = [];
    const citations = raw.flatMap((annotation): UrlCitation[] => {
      if (typeof annotation !== 'object' || annotation === null) {
        rejectedTypes.push(typeof annotation);
        return [];
      }
      const source = (annotation as { url_citation?: unknown }).url_citation;
      if (typeof source !== 'object' || source === null) {
        rejectedTypes.push(typeof (annotation as { type?: unknown }).type === 'string'
          ? (annotation as { type: string }).type
          : 'unknown');
        return [];
      }
      const value = source as Record<string, unknown>;
      if (!isHttpUrl(value.url)) {
        rejectedTypes.push('url_citation:invalid-url');
        return [];
      }
      return [{
        url: value.url,
        title: typeof value.title === 'string' ? value.title : undefined,
        startIndex: typeof value.start_index === 'number' ? value.start_index : undefined,
        endIndex: typeof value.end_index === 'number' ? value.end_index : undefined
      }];
    });
    if (rejectedTypes.length > 0) {
      this.outputChannel?.appendLine(
        `[OpenRouterClient] Dropped ${rejectedTypes.length}/${raw.length} unparseable citation annotation(s): ` +
        [...new Set(rejectedTypes)].join(', ')
      );
    }
    const merged = this.mergeUrlCitations(undefined, citations);
    if (merged?.length) {
      this.outputChannel?.appendLine(
        `[OpenRouterClient] Parsed ${merged.length} web citation(s) from ${raw.length} annotation(s)`
      );
    }
    return merged;
  }

  private mergeUrlCitations(
    current: UrlCitation[] | undefined,
    additions: UrlCitation[]
  ): UrlCitation[] | undefined {
    // `merged` is a shallow copy, so its entries are still shared with `current`
    // and `additions`. Copy on insert and replace on backfill so a caller holding
    // either array never observes a citation changing under it.
    const merged = [...(current ?? [])];
    for (const citation of additions) {
      const index = merged.findIndex((entry) => entry.url === citation.url);
      if (index < 0) {
        merged.push({ ...citation });
      } else if (!merged[index].title?.trim() && citation.title?.trim()) {
        merged[index] = { ...merged[index], title: citation.title };
      }
    }
    return merged.length > 0 ? merged : undefined;
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
