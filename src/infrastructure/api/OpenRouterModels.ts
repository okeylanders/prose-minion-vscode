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
 * Sorted alphabetically by name
 */
/**
 * Curated list of models for Category Search
 * Non-thinking models only for predictable token usage
 */
export const CATEGORY_MODELS = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Default for category search'
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    description: 'Google\'s flagship frontier model'
  },
  {
    id: 'openai/gpt-5.1-chat',
    name: 'GPT-5.1 Chat',
    description: 'OpenAI conversational model'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Google advanced model'
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large 2411',
    description: 'Mistral large model'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic\'s fastest and most efficient model with frontier-level capabilities'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google\'s fast model'
  },

];

/**
 * Curated list of recommended models for prose analysis ( Prose Excerpt Assistant )
 * Updated as of 2025
 * Sorted alphabetically by name
 */
export const RECOMMENDED_MODELS = [
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    description: 'A highly popular favorite known for its exceptional balance of lyrical prose and nuanced reasoning. Great for style matching.'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic\'s fastest efficient model. Perfect for quick grammar checks, style flag detection, and word frequency analysis.'
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    description: 'The creative heavyweight. Unequalled nuance and depth in storytelling; writes with a distinctive, sophisticated voice.'
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Top-tier powerhouse. Exceptional at natural prose, deep subtext, and complex narrative construction. (Recommended)'
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    description: 'Open-weight reasoning king. Excellent for heavy structural analysis, plot logic, and pacing verification at a low cost.'
  },
  {
    id: 'deepseek/deepseek-v3.1-terminus',
    name: 'DeepSeek V3.1 Terminus',
    description: 'Optimized for complex tasks. Strong general reasoning for structured text analysis and coding.'
  },
  {
    id: 'deepseek/deepseek-v3.2-exp',
    name: 'DeepSeek V3.2 Exp',
    description: 'Experimental sparse attention model. Good for long-context chapter analysis.'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'High-speed workhorse. Good for rapid critiques and checking large batches of text.'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning with thinking capabilities. A strong option for complex prose tasks.'
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    description: 'A master of scale and style. Excellent at weaving complex plot threads into cohesive, engaging prose over massive contexts (1M+).'
  },
  {
    id: 'z-ai/glm-4.5',
    name: 'GLM 4.5',
    description: 'Strong agentic model. Good for multi-step editing workflows.'
  },
  {
    id: 'z-ai/glm-4.6',
    name: 'GLM 4.6',
    description: 'Latest iteration with improved reasoning. Reliable for general writing assistance.'
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    description: 'Highly reliable legacy frontier model. Consistent instruction following for specific formatting needs.'
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    description: 'The adaptable virtuoso. Capable of mastering diverse tones and styles, from punchy thrillers to literary fiction.'
  },
  {
    id: 'openai/gpt-5.1-chat',
    name: 'GPT-5.1 Chat',
    description: 'Highly conversational and fluid. Excellent for dialogue workshops, brainstorming, and writing that flows naturally.'
  },
  {
    id: 'openai/gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    description: 'Advanced coding specialist. Use for scripting or complex formatting tasks.'
  },
  {
    id: 'x-ai/grok-4',
    name: 'Grok 4',
    description: 'Deep reasoning model with 256k context. Strong at maintaining consistency across long narratives.'
  },
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    description: 'Cost-efficient regular model. Good for quick iterations and drafting.'
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    description: 'Latest agentic fast model. Excellent for tooling and automated text processing tasks.'
  },
  {
    id: 'x-ai/grok-code-fast-1',
    name: 'Grok Code Fast 1',
    description: 'Fast coding specialist. Useful for technical formatting tools.'
  },
  {
    id: 'moonshotai/kimi-k2-0905',
    name: 'Kimi K2 0905',
    description: 'Large-scale MoE. Strong at general instruction following and long-context inputs.'
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    description: 'Reasoning-optimized. Good for deep-dives into plot holes and character motivations.'
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large 2411',
    description: 'Flagship open-weight class. Excellent European-style prose quality and multilingual support.'
  },
  {
    id: 'mistralai/magistral-medium-2506',
    name: 'Mistral Magistral Medium',
    description: 'Mistral\'s first dedicated reasoning model. Great for deeper structural critiques.'
  },
  {
    id: 'nousresearch/hermes-4-405b',
    name: 'Nous Hermes 4 405B',
    description: 'Uncensored frontier model. Best for mature themes, gritty narratives, and avoiding "assistant voice".'
  },
  {
    id: 'qwen/qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    description: 'Powerhouse coding agent. Use for advanced formatting scripts or technical edits.'
  },
  {
    id: 'qwen/qwen3-max',
    name: 'Qwen3 Max',
    description: 'Top-tier open model capability. Strong reasoning and creative writing performance.'
  },
  {
    id: 'sao10k/l3.3-euryale-70b',
    name: 'Sao10K Euryale 70B',
    description: 'Roleplay specialist. Creative, non-restrictive, and great for unique character voices.'
  },
  {
    id: 'thedrummer/anubis-70b-v1.1',
    name: 'TheDrummer: Anubis 70B',
    description: 'Unaligned creative writer. Excels at visceral, "human" prose and gritty storytelling.'
  },
  {
    id: 'thedrummer/rocinante-12b',
    name: 'TheDrummer: Rocinante 12B',
    description: 'Storytelling specialist. Engaging narrative voice and varied vocabulary.'
  },
  {
    id: 'arcee-ai/virtuoso-large',
    name: 'Virtuoso Large',
    description: 'Cross-domain reasoning. Good balance of creative writing and enterprise-grade analysis.'
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
