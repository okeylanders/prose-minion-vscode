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
 * Updated as of 2026
 * Grouped by provider family and version progression
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
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    description: 'Anthropic\'s latest Sonnet model with stronger coding, agentic reliability, and long-context performance'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic\'s fastest and most efficient model with frontier-level capabilities'
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Anthropic\'s frontier reasoning model for complex tasks and agentic workflows'
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    description: 'Anthropic\'s strongest model for complex agentic workflows and extended sessions'
  },
  {
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    description: 'Cost-efficient OpenAI model for structured category matching and high-throughput utility tasks'
  },
  {
    id: 'openai/gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    description: 'Fast, low-cost OpenAI model for lightweight category matching'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google\'s fast model'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Google advanced model'
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: 'High-speed thinking model for agentic workflows with near Pro-level reasoning at lower latency'
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'Google\'s flagship frontier model'
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite Preview',
    description: 'High-efficiency Gemini model for large category lists and high-volume matching'
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    description: 'Low-cost 1M-context model for fast category matching over larger inputs'
  },
  {
    id: 'qwen/qwen3.6-flash',
    name: 'Qwen3.6 Flash',
    description: 'Fast 1M-context model for inexpensive category search and utility tasks'
  },
  {
    id: 'mistralai/mistral-small-2603',
    name: 'Mistral Small 4',
    description: 'Current low-cost Mistral model with strong general instruction following'
  },
  {
    id: 'openai/gpt-5.1-chat',
    name: 'GPT-5.1 Chat',
    description: 'OpenAI conversational model'
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    description: 'Latest frontier-grade model with adaptive reasoning for dynamic complexity handling'
  },
  {
    id: 'openai/gpt-5.2-chat',
    name: 'GPT-5.2 Chat',
    description: 'Fast, lightweight model optimized for low-latency chat with adaptive reasoning'
  },
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    description: '$$$ OpenAI\'s most advanced model (~6x Opus price) for complex agentic tasks'
  },
  {
    id: 'openai/gpt-5.3-chat',
    name: 'GPT-5.3 Chat',
    description: 'Latest conversational release focused on smoother, more directly helpful everyday chat'
  },
  {
    id: 'openai/gpt-5.4',
    name: 'GPT-5.4',
    description: 'OpenAI\'s latest frontier model for professional work with stronger tool use and long-context performance'
  },
  {
    id: 'openai/gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    description: '$$$ Maximum-capability GPT-5.4 variant for complex, high-stakes multi-step tasks'
  },
  {
    id: 'deepcogito/cogito-v2.1-671b',
    name: 'Cogito v2.1 671B',
    description: 'One of the strongest open models globally, matching frontier closed models'
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large 2411',
    description: 'Mistral large model'
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'GLM 4.7',
    description: 'Z.AI\'s latest flagship model with enhanced programming and stable multi-step reasoning for complex agent tasks'
  },
];

/**
 * Curated list of recommended models for prose analysis ( Prose Excerpt Assistant )
 * Updated as of 2026
 * Grouped by provider family and version progression
 */
export const RECOMMENDED_MODELS = [
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    description: 'A highly popular favorite known for its exceptional balance of lyrical prose and nuanced reasoning. Great for style matching.'
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    description: 'The creative heavyweight. Unequalled nuance and depth in storytelling; writes with a distinctive, sophisticated voice.'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic\'s fastest efficient model. Perfect for quick grammar checks, style flag detection, and word frequency analysis.'
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Top-tier powerhouse. Exceptional at natural prose, deep subtext, and complex narrative construction. (Recommended)'
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    description: 'Most capable Sonnet generation with improved coding, reasoning consistency, and 1M-context readiness for long workflows.'
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Anthropic\'s frontier reasoning model optimized for complex software engineering and agentic workflows. Strong multimodal capabilities with improved robustness. Supports extended context and multi-step planning.'
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    description: 'Anthropic\'s strongest model for sustained knowledge work. Exceptional coherence across long outputs and extended sessions. Near-production-ready prose in a single pass with deep contextual understanding.'
  },
  {
    id: 'anthropic/claude-opus-4.7',
    name: 'Claude Opus 4.7',
    description: 'Anthropic\'s latest Opus model for long-running reasoning, sustained context, and premium prose analysis workflows.'
  },
  {
    id: 'deepcogito/cogito-v2.1-671b',
    name: 'Cogito v2.1 671B',
    description: 'One of the strongest open MoE models globally. Trained via self-play RL for state-of-the-art instruction following, coding, longer queries, and creative writing.'
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
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'Large MoE model with 1M context. Strong value option for deep structural critique, long manuscript context, and reasoning-heavy writing tasks.'
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    description: 'Efficiency-focused 1M-context model. Good for fast dictionary work, rewrites, and budget long-context analysis.'
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
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: 'High-speed thinking model with near Pro-level reasoning. Great for rapid critiques, multi-turn dialogue, and agentic writing workflows (1M context).'
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'A master of scale and style. Excellent at weaving complex plot threads into cohesive, engaging prose over massive contexts (1M+).'
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite Preview',
    description: 'High-efficiency Gemini model with 1M context. Useful for quick dictionary work, large batches, and low-cost category-style reasoning.'
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
    id: 'z-ai/glm-4.7',
    name: 'GLM 4.7',
    description: 'Z.AI\'s latest flagship model with enhanced programming capabilities and more stable multi-step reasoning/execution. Significant improvements in complex agent tasks with natural conversational experiences.'
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
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    description: 'Latest frontier-grade model with adaptive reasoning that allocates more depth to complex tasks. Consistent gains across math, coding, and tool calling with more coherent long-form answers. Great for creative writing.'
  },
  {
    id: 'openai/gpt-5.2-chat',
    name: 'GPT-5.2 Chat',
    description: 'Fast, warmer conversational model with selective "thinking" on harder queries. Optimized for high-throughput interactive workloads where responsiveness matters. Better instruction following and stable short-form reasoning.'
  },
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    description: '$$$ OpenAI\'s most advanced model (~6x Opus price). Major improvements in agentic coding and long context over GPT-5 Pro. Optimized for step-by-step reasoning, reduced hallucination/sycophancy, and accuracy in high-stakes use cases.'
  },
  {
    id: 'openai/gpt-5.3-chat',
    name: 'GPT-5.3 Chat',
    description: 'Newest ChatGPT-style conversational model with improved everyday helpfulness, smoother responses, and fewer unnecessary refusals.'
  },
  {
    id: 'openai/gpt-5.4',
    name: 'GPT-5.4',
    description: 'OpenAI\'s latest frontier model, unifying GPT and Codex strengths with stronger coding, document reasoning, and tool-use performance.'
  },
  {
    id: 'openai/gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    description: '$$$ Highest-capability GPT-5.4 variant for difficult, high-stakes work that needs deeper reasoning and maximum reliability.'
  },
  {
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    description: 'Efficient GPT-5.4 family model. Good for dictionary rewrites, style alternatives, and responsive utility workflows.'
  },
  {
    id: 'openai/gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    description: 'Fastest GPT-5.4 family option. Best for low-cost dictionary lookups and short rewrite suggestions.'
  },
  {
    id: 'openai/gpt-5.5',
    name: 'GPT-5.5',
    description: 'OpenAI frontier model with 1M+ context and stronger reasoning. Premium option for complex prose analysis, context-heavy rewrites, and chapter-scale work.'
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
    id: 'moonshotai/kimi-k2.6',
    name: 'Kimi K2.6',
    description: 'Long-horizon reasoning model with strong multimodal and agentic performance. Good for extended writing workflows and context-heavy critique.'
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large 2411',
    description: 'Flagship open-weight class. Excellent European-style prose quality and multilingual support.'
  },
  {
    id: 'mistralai/mistral-small-2603',
    name: 'Mistral Small 4',
    description: 'Current low-cost Mistral model. Good for quick rewrite alternatives, dictionary utilities, and general prose assistance.'
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
    id: 'qwen/qwen3.6-plus',
    name: 'Qwen3.6 Plus',
    description: 'Cost-efficient 1M-context model. Strong candidate for long-context prose analysis, dictionary rewrites, and large context packs.'
  },
  {
    id: 'qwen/qwen3.6-flash',
    name: 'Qwen3.6 Flash',
    description: 'Fast 1M-context Qwen model. Good for inexpensive utility tasks, dictionary alternatives, and large batch checks.'
  },
  {
    id: 'sao10k/l3.3-euryale-70b',
    name: 'Sao10K Euryale 70B',
    description: 'Roleplay specialist. Creative, non-restrictive, and great for unique character voices.'
  },
  {
    id: 'aion-labs/aion-2.0',
    name: 'Aion 2.0',
    description: 'Storytelling-focused model optimized for immersive roleplay, narrative tension, and character-driven rewrite exploration.'
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
