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
 * Curated list of recommended models for prose analysis
 * Updated as of 2024
 */
export const RECOMMENDED_MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Best balance of quality and speed for prose analysis'
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Highest quality, best for detailed analysis'
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fastest and most affordable'
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'High quality alternative'
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'Multimodal, fast, good quality'
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini 1.5 Pro',
    description: 'Large context window'
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
