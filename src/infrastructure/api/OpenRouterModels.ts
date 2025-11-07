/**
 * OpenRouter Models
 * Fetches and manages available models from OpenRouter API
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * Curated list of recommended models for prose analysis ( Prose Excerpt Assistant )
 * Updated as of 2025
 */
export const RECOMMENDED_MODELS = [
  {
    id: 'z-ai/glm-4.6',
    name: 'GLM 4.6',
    description: 'Latest ZhipuAI model (Recommended)'
  },
  {
    id: 'z-ai/glm-4.5',
    name: 'GLM 4.5',
    description: 'ZhipuAI model'
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Anthropic\'s latest balanced model'
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    description: 'Anthropic\'s most capable model'
  },
  {
    id: 'openai/gpt-5-codex',
    name: 'GPT-5 Codex',
    description: 'OpenAI\'s code-optimized model'
  },
  {
    id: 'openai/gpt-5-chat',
    name: 'GPT-5 Chat',
    description: 'OpenAI\'s conversational model'
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    description: 'OpenAI\'s latest general-purpose model'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Google\'s advanced model'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google\'s fast model'
  },
  {
    id: 'google/gemini-2.5-flash-image-preview',
    name: 'Gemini 2.5 Flash Image Preview',
    description: 'Google\'s multimodal model'
  },
  {
    id: 'deepseek/deepseek-v3.2-exp',
    name: 'DeepSeek V3.2 Exp',
    description: 'DeepSeek\'s experimental model'
  },
  {
    id: 'qwen/qwen3-max',
    name: 'Qwen3 Max',
    description: 'Alibaba\'s most capable model'
  },
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    description: 'xAI\'s fast model'
  },
  {
    id: 'x-ai/grok-code-fast-1',
    name: 'Grok Code Fast 1',
    description: 'xAI\'s code-optimized model'
  },
  {
    id: 'moonshotai/kimi-k2-0905',
    name: 'Kimi K2 0905',
    description: 'Moonshot AI\'s model'
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    description: 'Advanced reasoning model with 256K context, optimized for persistent step-by-step thought and complex multi-turn workflows'
  }
];

export class OpenRouterModels {
  private static readonly API_URL = 'https://openrouter.ai/api/v1/models';
  private static cachedModels: OpenRouterModel[] | null = null;

  /**
   * Fetch available models from OpenRouter API
   */
  static async fetchModels(): Promise<OpenRouterModel[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    try {
      const response = await fetch(this.API_URL, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = (await response.json()) as OpenRouterModelsResponse;
      this.cachedModels = data.data;
      return data.data;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      // Return recommended models as fallback
      return RECOMMENDED_MODELS.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        pricing: { prompt: '0', completion: '0' },
        context_length: 200000
      }));
    }
  }

  /**
   * Get recommended models (doesn't require API call)
   */
  static getRecommendedModels() {
    return RECOMMENDED_MODELS;
  }

  /**
   * Clear cached models
   */
  static clearCache() {
    this.cachedModels = null;
  }
}
