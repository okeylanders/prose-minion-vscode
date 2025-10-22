/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API for AI-powered analysis
 */

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
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
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
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
    }
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/your-username/prose-minion-vscode',
        'X-Title': 'Prose Minion VS Code Extension'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000
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

    return data.choices[0].message.content;
  }

  /**
   * Check if API key is configured
   */
  static isConfigured(apiKey?: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 0);
  }
}
