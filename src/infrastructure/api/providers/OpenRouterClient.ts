/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API for AI-powered analysis
 */

import { TokenUsage } from '@shared/types';

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
}

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || 'z-ai/glm-4.6';
  }

  getModel(): string {
    return this.model;
  }

  async createChatCompletion(
    messages: OpenRouterMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
    }
  ): Promise<{ content: string; finishReason?: string; usage?: TokenUsage; id?: string }> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/okeylanders/prose-minion-vscode',
        'X-Title': 'Prose Minion VS Code Extension'
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 10000,
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

    return {
      id: data.id,
      content: data.choices[0].message.content,
      finishReason: data.choices[0]?.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
            costUsd: (() => {
              const rawCost =
                (data.usage as any).cost ??
                (data.usage as any).costUsd ??
                (data.usage as any).cost_usd;
              const costNum = rawCost !== undefined && rawCost !== null ? Number(rawCost) : undefined;
              return Number.isFinite(costNum) ? costNum : undefined;
            })()
          }
        : undefined
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
  ): AsyncGenerator<{ token: string; done: boolean; usage?: TokenUsage }> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/okeylanders/prose-minion-vscode',
        'X-Title': 'Prose Minion VS Code Extension'
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 10000,
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
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const token = delta?.content || '';
            const finishReason = parsed.choices?.[0]?.finish_reason;
            const usage = parsed.usage;

            if (token) {
              yield { token, done: false };
            }

            if (finishReason || usage) {
              yield {
                token: '',
                done: true,
                usage: usage ? {
                  promptTokens: usage.prompt_tokens,
                  completionTokens: usage.completion_tokens,
                  totalTokens: usage.total_tokens,
                  costUsd: (() => {
                    const rawCost = usage.cost ?? usage.costUsd ?? usage.cost_usd;
                    const costNum = rawCost !== undefined && rawCost !== null ? Number(rawCost) : undefined;
                    return Number.isFinite(costNum) ? costNum : undefined;
                  })()
                } : undefined
              };
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
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
}
