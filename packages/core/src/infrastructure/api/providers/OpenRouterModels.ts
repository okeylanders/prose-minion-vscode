/**
 * OpenRouter Models
 * Fetches and manages available models from OpenRouter API
 */

import { LogSink } from '@/platform';

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  created?: number;
  family?: string;
  knowledge_cutoff?: string;
  expiration_date?: string;
  isFallback?: boolean;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface CuratedOpenRouterModel {
  id: string;
  name: string;
  family: string;
  description: string;
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
export const CATEGORY_MODELS: CuratedOpenRouterModel[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    family: 'Claude Sonnet',
    description: 'Default for category search'
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    family: 'Claude Sonnet',
    description: 'Anthropic\'s latest Sonnet model with stronger coding, agentic reliability, and long-context performance'
  },
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    family: 'Claude Sonnet',
    description: 'Anthropic\'s newest Sonnet model with 1M context, adaptive reasoning, and frontier performance for professional writing and agentic work'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    family: 'Claude Haiku',
    description: 'Anthropic\'s fastest and most efficient model with frontier-level capabilities'
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    family: 'Claude Opus',
    description: 'Anthropic\'s frontier reasoning model for complex tasks and agentic workflows'
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    family: 'Claude Opus',
    description: 'Anthropic\'s strongest model for complex agentic workflows and extended sessions'
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Claude Opus 4.8',
    family: 'Claude Opus',
    description: 'Anthropic\'s newest Opus model with 1M context, stronger agentic reasoning, and premium long-form analysis quality'
  },
  {
    id: 'anthropic/claude-opus-4.8-fast',
    name: 'Claude Opus 4.8 Fast',
    family: 'Claude Opus',
    description: 'Higher-throughput Opus 4.8 variant for interactive category search and rapid high-quality utility passes'
  },
  {
    id: 'anthropic/claude-opus-4.7-fast',
    name: 'Claude Opus 4.7 Fast',
    family: 'Claude Opus',
    description: 'Lower-latency variant of Opus 4.7 for category search and high-throughput utility tasks'
  },
  {
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    family: 'GPT-5.4',
    description: 'Cost-efficient OpenAI model for structured category matching and high-throughput utility tasks'
  },
  {
    id: 'openai/gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    family: 'GPT-5.4',
    description: 'Fast, low-cost OpenAI model for lightweight category matching'
  },
  {
    id: 'openai/gpt-5.5-pro',
    name: 'GPT-5.5 Pro',
    family: 'GPT-5.5',
    description: 'Premium GPT-5.5 variant for high-accuracy category matching on difficult/ambiguous inputs'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    family: 'Gemini 2.5',
    description: 'Google\'s fast model'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    family: 'Gemini 2.5',
    description: 'Google advanced model'
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    family: 'Gemini 3',
    description: 'High-speed thinking model for agentic workflows with near Pro-level reasoning at lower latency'
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    family: 'Gemini 3.1',
    description: 'Google\'s flagship frontier model'
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite Preview',
    family: 'Gemini 3.1',
    description: 'High-efficiency Gemini model for large category lists and high-volume matching'
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    family: 'Gemini 3.5',
    description: 'Latest Gemini 3.5 fast tier — strong reasoning at high throughput for large category lists'
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    family: 'DeepSeek V4',
    description: 'Low-cost 1M-context model for fast category matching over larger inputs'
  },
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    family: 'Step',
    description: 'Fast multimodal StepFun model with strong throughput for category matching, quick rewrites, and utility analysis'
  },
  {
    id: 'inclusionai/ling-2.6-flash',
    name: 'Ling 2.6 Flash',
    family: 'Ling',
    description: 'Very low-cost text model for high-volume utility classification and simple category searches'
  },
  {
    id: 'inclusionai/ring-2.6-1t',
    name: 'Ring 2.6 1T',
    family: 'Ring',
    description: 'Efficient large-scale thinking model for structured reasoning and long category lists'
  },
  {
    id: 'qwen/qwen3.6-flash',
    name: 'Qwen3.6 Flash',
    family: 'Qwen3.6',
    description: 'Fast 1M-context model for inexpensive category search and utility tasks'
  },
  {
    id: 'qwen/qwen3.7-max',
    name: 'Qwen3.7 Max',
    family: 'Qwen3.7',
    description: 'Flagship Qwen3.7 model with 1M context and strong agentic instruction following'
  },
  {
    id: 'mistralai/mistral-small-2603',
    name: 'Mistral Small 4',
    family: 'Mistral Small',
    description: 'Current low-cost Mistral model with strong general instruction following'
  },
  {
    id: 'mistralai/mistral-medium-3-5',
    name: 'Mistral Medium 3.5',
    family: 'Mistral Medium',
    description: 'Mid-premium Mistral model for more complex category matching and structured prose analysis'
  },
  {
    id: 'openai/gpt-5.1-chat',
    name: 'GPT-5.1 Chat',
    family: 'GPT-5.1',
    description: 'OpenAI conversational model'
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    family: 'GPT-5.2',
    description: 'Latest frontier-grade model with adaptive reasoning for dynamic complexity handling'
  },
  {
    id: 'openai/gpt-5.2-chat',
    name: 'GPT-5.2 Chat',
    family: 'GPT-5.2',
    description: 'Fast, lightweight model optimized for low-latency chat with adaptive reasoning'
  },
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    family: 'GPT-5.2',
    description: '$$$ OpenAI\'s most advanced model (~6x Opus price) for complex agentic tasks'
  },
  {
    id: 'openai/gpt-5.3-chat',
    name: 'GPT-5.3 Chat',
    family: 'GPT-5.3',
    description: 'Latest conversational release focused on smoother, more directly helpful everyday chat'
  },
  {
    id: 'openai/gpt-5.4',
    name: 'GPT-5.4',
    family: 'GPT-5.4',
    description: 'OpenAI\'s latest frontier model for professional work with stronger tool use and long-context performance'
  },
  {
    id: 'openai/gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    family: 'GPT-5.4',
    description: '$$$ Maximum-capability GPT-5.4 variant for complex, high-stakes multi-step tasks'
  },
  {
    id: 'openai/gpt-chat-latest',
    name: 'GPT Chat Latest',
    family: 'GPT Chat',
    description: 'OpenAI stable chat alias that tracks the latest Instant chat model for conversational utility work'
  },
  {
    id: 'deepcogito/cogito-v2.1-671b',
    name: 'Cogito v2.1 671B',
    family: 'Cogito',
    description: 'One of the strongest open models globally, matching frontier closed models'
  },
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral Large 2512',
    family: 'Mistral Large',
    description: 'Newest Mistral Large with improved reasoning and instruction following over 2411'
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'GLM 4.7',
    family: 'GLM 4',
    description: 'Z.AI\'s latest flagship model with enhanced programming and stable multi-step reasoning for complex agent tasks'
  },
  {
    id: 'z-ai/glm-4.7-flash',
    name: 'GLM 4.7 Flash',
    family: 'GLM 4',
    description: 'Fast variant of GLM 4.7 — low-latency category matching with the same reasoning lineage'
  },
  {
    id: 'z-ai/glm-5.1',
    name: 'GLM 5.1',
    family: 'GLM 5',
    description: 'Z.AI\'s newest flagship for predictable structured matching with improved reliability'
  },
  {
    id: 'z-ai/glm-5.2',
    name: 'GLM 5.2',
    family: 'GLM 5',
    description: 'Z.AI\'s GLM 5.2 flagship with 1M context and stronger long-horizon reasoning for structured category matching'
  },
];

/**
 * Curated list of recommended models for prose analysis ( Prose Excerpt Assistant )
 * Updated as of 2026
 * Grouped by provider family and version progression
 */
export const RECOMMENDED_MODELS: CuratedOpenRouterModel[] = [
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    family: 'Claude Opus',
    description: 'The creative heavyweight. Unequalled nuance and depth in storytelling; writes with a distinctive, sophisticated voice.'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    family: 'Claude Haiku',
    description: 'Anthropic\'s fastest efficient model. Perfect for quick grammar checks, style flag detection, and word frequency analysis.'
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    family: 'Claude Sonnet',
    description: 'Top-tier powerhouse. Exceptional at natural prose, deep subtext, and complex narrative construction. (Recommended)'
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    family: 'Claude Sonnet',
    description: 'Most capable Sonnet generation with improved coding, reasoning consistency, and 1M-context readiness for long workflows.'
  },
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    family: 'Claude Sonnet',
    description: 'Anthropic\'s newest Sonnet flagship. 1M context, adaptive reasoning, and frontier performance across prose analysis, coding, agents, and professional writing workflows.'
  },
  {
    id: 'anthropic/claude-fable-5',
    name: 'Claude Fable 5',
    family: 'Claude Fable',
    description: 'Anthropic\'s Mythos-class model for autonomous knowledge work and coding. 1M context with reasoning support for deep prose analysis, manuscript-scale critique, and complex revision planning.'
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    family: 'Claude Opus',
    description: 'Anthropic\'s frontier reasoning model optimized for complex software engineering and agentic workflows. Strong multimodal capabilities with improved robustness. Supports extended context and multi-step planning.'
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    family: 'Claude Opus',
    description: 'Anthropic\'s strongest model for sustained knowledge work. Exceptional coherence across long outputs and extended sessions. Near-production-ready prose in a single pass with deep contextual understanding.'
  },
  {
    id: 'anthropic/claude-opus-4.7',
    name: 'Claude Opus 4.7',
    family: 'Claude Opus',
    description: 'Anthropic\'s latest Opus model for long-running reasoning, sustained context, and premium prose analysis workflows.'
  },
  {
    id: 'anthropic/claude-opus-4.7-fast',
    name: 'Claude Opus 4.7 Fast',
    family: 'Claude Opus',
    description: 'Fast-tier Opus 4.7. Premium prose reasoning with reduced latency for interactive editing and rapid critique loops.'
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Claude Opus 4.8',
    family: 'Claude Opus',
    description: 'Anthropic\'s newest Opus model. 1M context, improved agentic reasoning, and premium long-form prose analysis for difficult scenes and manuscript-scale critique.'
  },
  {
    id: 'anthropic/claude-opus-4.8-fast',
    name: 'Claude Opus 4.8 Fast',
    family: 'Claude Opus',
    description: 'Higher-throughput Opus 4.8. Same model family and context window with faster output for iterative chapter passes and rapid critique loops.'
  },
  {
    id: 'deepcogito/cogito-v2.1-671b',
    name: 'Cogito v2.1 671B',
    family: 'Cogito',
    description: 'One of the strongest open MoE models globally. Trained via self-play RL for state-of-the-art instruction following, coding, longer queries, and creative writing.'
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    family: 'DeepSeek R1',
    description: 'Open-weight reasoning king. Excellent for heavy structural analysis, plot logic, and pacing verification at a low cost.'
  },
  {
    id: 'deepseek/deepseek-v3.1-terminus',
    name: 'DeepSeek V3.1 Terminus',
    family: 'DeepSeek V3',
    description: 'Optimized for complex tasks. Strong general reasoning for structured text analysis and coding.'
  },
  {
    id: 'deepseek/deepseek-v3.2-exp',
    name: 'DeepSeek V3.2 Exp',
    family: 'DeepSeek V3',
    description: 'Experimental sparse attention model. Good for long-context chapter analysis.'
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    family: 'DeepSeek V3',
    description: 'Stable V3.2 release. Sparse-attention long-context model suited to manuscript-scale critique and consistency checks.'
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    family: 'DeepSeek V4',
    description: 'Large MoE model with 1M context. Strong value option for deep structural critique, long manuscript context, and reasoning-heavy writing tasks.'
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    family: 'DeepSeek V4',
    description: 'Efficiency-focused 1M-context model. Good for fast dictionary work, rewrites, and budget long-context analysis.'
  },
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    family: 'Step',
    description: 'StepFun\'s latest Flash model with 256K context. Fast, inexpensive option for quick critique, dictionary alternatives, and utility rewriting.'
  },
  {
    id: 'inclusionai/ling-2.6-flash',
    name: 'Ling 2.6 Flash',
    family: 'Ling',
    description: 'Tiny-cost inclusionAI text model for high-volume utility work, quick classification, and lightweight prose checks.'
  },
  {
    id: 'inclusionai/ling-2.6-1t',
    name: 'Ling 2.6 1T',
    family: 'Ling',
    description: 'Large inclusionAI text model with efficient pricing. Useful for long-context reasoning and structured manuscript analysis on a budget.'
  },
  {
    id: 'inclusionai/ring-2.6-1t',
    name: 'Ring 2.6 1T',
    family: 'Ring',
    description: '1T-parameter-scale thinking model with efficient active parameters. Good for agentic critique, coding-adjacent workflows, and structured long-form reasoning.'
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    family: 'Gemini 2.5',
    description: 'High-speed workhorse. Good for rapid critiques and checking large batches of text.'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    family: 'Gemini 2.5',
    description: 'Advanced reasoning with thinking capabilities. A strong option for complex prose tasks.'
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    family: 'Gemini 3',
    description: 'High-speed thinking model with near Pro-level reasoning. Great for rapid critiques, multi-turn dialogue, and agentic writing workflows (1M context).'
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    family: 'Gemini 3.1',
    description: 'A master of scale and style. Excellent at weaving complex plot threads into cohesive, engaging prose over massive contexts (1M+).'
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite Preview',
    family: 'Gemini 3.1',
    description: 'High-efficiency Gemini model with 1M context. Useful for quick dictionary work, large batches, and low-cost category-style reasoning.'
  },
  {
    id: 'google/gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    family: 'Gemini 3.1',
    description: 'Stable release of Flash Lite. Same 1M-context efficiency profile without preview-channel churn — good default for high-volume utility work.'
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    family: 'Gemini 3.5',
    description: 'Latest Gemini fast tier. Stronger reasoning than 3-flash with high throughput — good for rapid prose critique and dictionary alternatives.'
  },
  {
    id: 'z-ai/glm-4.5',
    name: 'GLM 4.5',
    family: 'GLM 4',
    description: 'Strong agentic model. Good for multi-step editing workflows.'
  },
  {
    id: 'z-ai/glm-4.6',
    name: 'GLM 4.6',
    family: 'GLM 4',
    description: 'Latest iteration with improved reasoning. Reliable for general writing assistance.'
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'GLM 4.7',
    family: 'GLM 4',
    description: 'Z.AI\'s latest flagship model with enhanced programming capabilities and more stable multi-step reasoning/execution. Significant improvements in complex agent tasks with natural conversational experiences.'
  },
  {
    id: 'z-ai/glm-4.7-flash',
    name: 'GLM 4.7 Flash',
    family: 'GLM 4',
    description: 'Fast variant of GLM 4.7. Lower-latency option for utility rewrites and quick critiques on the GLM 4.7 reasoning lineage.'
  },
  {
    id: 'z-ai/glm-5',
    name: 'GLM 5',
    family: 'GLM 5',
    description: 'Major GLM version bump. Improved instruction following and creative coherence over GLM 4.7.'
  },
  {
    id: 'z-ai/glm-5.1',
    name: 'GLM 5.1',
    family: 'GLM 5',
    description: 'Z.AI\'s newest flagship. Refines GLM 5 with stronger long-context reasoning and more reliable multi-step prose generation.'
  },
  {
    id: 'z-ai/glm-5.2',
    name: 'GLM 5.2',
    family: 'GLM 5',
    description: 'Z.AI\'s latest flagship (1M context). Builds on GLM 5.1 with stronger long-horizon reasoning for manuscript-scale critique and reliable multi-step prose generation.'
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    family: 'GPT-4',
    description: 'Highly reliable legacy frontier model. Consistent instruction following for specific formatting needs.'
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    family: 'GPT-5.1',
    description: 'The adaptable virtuoso. Capable of mastering diverse tones and styles, from punchy thrillers to literary fiction.'
  },
  {
    id: 'openai/gpt-5.1-chat',
    name: 'GPT-5.1 Chat',
    family: 'GPT-5.1',
    description: 'Highly conversational and fluid. Excellent for dialogue workshops, brainstorming, and writing that flows naturally.'
  },
  {
    id: 'openai/gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    family: 'GPT-5.1',
    description: 'Coding specialist. Use for scripting or complex formatting tasks.'
  },
  {
    id: 'openai/gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    family: 'GPT-5.1',
    description: 'Premium GPT-5.1 Codex variant for advanced formatting scripts and heavier technical edit workflows.'
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    family: 'GPT-5.2',
    description: 'Latest frontier-grade model with adaptive reasoning that allocates more depth to complex tasks. Consistent gains across math, coding, and tool calling with more coherent long-form answers. Great for creative writing.'
  },
  {
    id: 'openai/gpt-5.2-chat',
    name: 'GPT-5.2 Chat',
    family: 'GPT-5.2',
    description: 'Fast, warmer conversational model with selective "thinking" on harder queries. Optimized for high-throughput interactive workloads where responsiveness matters. Better instruction following and stable short-form reasoning.'
  },
  {
    id: 'openai/gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    family: 'GPT-5.2',
    description: 'GPT-5.2 Codex tier. Improved tool use and code reasoning over 5.1 Codex for technical scripting and structured-text tooling.'
  },
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    family: 'GPT-5.2',
    description: '$$$ OpenAI\'s most advanced model (~6x Opus price). Major improvements in agentic coding and long context over GPT-5 Pro. Optimized for step-by-step reasoning, reduced hallucination/sycophancy, and accuracy in high-stakes use cases.'
  },
  {
    id: 'openai/gpt-5.3-chat',
    name: 'GPT-5.3 Chat',
    family: 'GPT-5.3',
    description: 'Newest ChatGPT-style conversational model with improved everyday helpfulness, smoother responses, and fewer unnecessary refusals.'
  },
  {
    id: 'openai/gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    family: 'GPT-5.3',
    description: 'Newest Codex variant. Strongest tool-use and structured-edit performance in the Codex line.'
  },
  {
    id: 'openai/gpt-5.4',
    name: 'GPT-5.4',
    family: 'GPT-5.4',
    description: 'OpenAI\'s latest frontier model, unifying GPT and Codex strengths with stronger coding, document reasoning, and tool-use performance.'
  },
  {
    id: 'openai/gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    family: 'GPT-5.4',
    description: '$$$ Highest-capability GPT-5.4 variant for difficult, high-stakes work that needs deeper reasoning and maximum reliability.'
  },
  {
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    family: 'GPT-5.4',
    description: 'Efficient GPT-5.4 family model. Good for dictionary rewrites, style alternatives, and responsive utility workflows.'
  },
  {
    id: 'openai/gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    family: 'GPT-5.4',
    description: 'Fastest GPT-5.4 family option. Best for low-cost dictionary lookups and short rewrite suggestions.'
  },
  {
    id: 'openai/gpt-5.5',
    name: 'GPT-5.5',
    family: 'GPT-5.5',
    description: 'OpenAI frontier model with 1M+ context and stronger reasoning. Premium option for complex prose analysis, context-heavy rewrites, and chapter-scale work.'
  },
  {
    id: 'openai/gpt-5.5-pro',
    name: 'GPT-5.5 Pro',
    family: 'GPT-5.5',
    description: '$$$ Premium GPT-5.5 variant for the deepest reasoning, longest context, and highest-stakes prose work.'
  },
  {
    id: 'openai/gpt-chat-latest',
    name: 'GPT Chat Latest',
    family: 'GPT Chat',
    description: 'Stable OpenAI chat alias on OpenRouter. Tracks the latest Instant chat model for brainstorming, dialogue workshops, and everyday editorial conversations.'
  },
  {
    id: 'x-ai/grok-4.20',
    name: 'Grok 4.20',
    family: 'Grok 4',
    description: 'xAI\'s current flagship. Strong long-context reasoning and consistent voice across extended narratives.'
  },
  {
    id: 'x-ai/grok-4.20-multi-agent',
    name: 'Grok 4.20 Multi-Agent',
    family: 'Grok 4',
    description: 'Multi-agent variant of Grok 4.20. Suited to tooling pipelines and agentic editing workflows.'
  },
  {
    id: 'x-ai/grok-4.3',
    name: 'Grok 4.3',
    family: 'Grok 4',
    description: 'Newest Grok deep-reasoning model. Premium tier for complex structural critique and consistency analysis.'
  },
  {
    id: 'moonshotai/kimi-k2-0905',
    name: 'Kimi K2 0905',
    family: 'Kimi K2',
    description: 'Large-scale MoE. Strong at general instruction following and long-context inputs.'
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    family: 'Kimi K2',
    description: 'Reasoning-optimized. Good for deep-dives into plot holes and character motivations.'
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    family: 'Kimi K2',
    description: 'Mid-generation Kimi release. Sits between K2-0905 and K2.6 for cost/quality tradeoffs on long-context critique.'
  },
  {
    id: 'moonshotai/kimi-k2.6',
    name: 'Kimi K2.6',
    family: 'Kimi K2',
    description: 'Long-horizon reasoning model with strong multimodal and agentic performance. Good for extended writing workflows and context-heavy critique.'
  },
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral Large 2512',
    family: 'Mistral Large',
    description: 'Newest Mistral Large. Improved reasoning and instruction following over 2411 with strong multilingual prose.'
  },
  {
    id: 'mistralai/mistral-medium-3.1',
    name: 'Mistral Medium 3.1',
    family: 'Mistral Medium',
    description: 'Mid-tier Mistral. Good balance between Small and Large for general prose assistance and structured edits.'
  },
  {
    id: 'mistralai/mistral-medium-3-5',
    name: 'Mistral Medium 3.5',
    family: 'Mistral Medium',
    description: 'Newer medium-tier Mistral model. Stronger agentic workflow and instruction-following option for structured edits, critique, and multilingual prose.'
  },
  {
    id: 'mistralai/mistral-small-2603',
    name: 'Mistral Small 4',
    family: 'Mistral Small',
    description: 'Current low-cost Mistral model. Good for quick rewrite alternatives, dictionary utilities, and general prose assistance.'
  },
  {
    id: 'nousresearch/hermes-4-405b',
    name: 'Nous Hermes 4 405B',
    family: 'Hermes 4',
    description: 'Uncensored frontier model. Best for mature themes, gritty narratives, and avoiding "assistant voice".'
  },
  {
    id: 'nousresearch/hermes-4-70b',
    name: 'Nous Hermes 4 70B',
    family: 'Hermes 4',
    description: 'Smaller, cheaper Hermes 4. Same uncensored character handling at lower cost for mature-theme drafting.'
  },
  {
    id: 'qwen/qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    family: 'Qwen3',
    description: 'Powerhouse coding agent. Use for advanced formatting scripts or technical edits.'
  },
  {
    id: 'qwen/qwen3-max',
    name: 'Qwen3 Max',
    family: 'Qwen3',
    description: 'Top-tier open model capability. Strong reasoning and creative writing performance.'
  },
  {
    id: 'qwen/qwen3-max-thinking',
    name: 'Qwen3 Max Thinking',
    family: 'Qwen3',
    description: 'Thinking-optimized Qwen3 Max. Stronger structural reasoning for plot analysis and consistency review.'
  },
  {
    id: 'qwen/qwen3.6-plus',
    name: 'Qwen3.6 Plus',
    family: 'Qwen3.6',
    description: 'Cost-efficient 1M-context model. Strong candidate for long-context prose analysis, dictionary rewrites, and large context packs.'
  },
  {
    id: 'qwen/qwen3.6-flash',
    name: 'Qwen3.6 Flash',
    family: 'Qwen3.6',
    description: 'Fast 1M-context Qwen model. Good for inexpensive utility tasks, dictionary alternatives, and large batch checks.'
  },
  {
    id: 'qwen/qwen3.6-max-preview',
    name: 'Qwen3.6 Max Preview',
    family: 'Qwen3.6',
    description: 'Top-tier Qwen 3.6 preview. Premium open-model option for deep prose critique with very long context.'
  },
  {
    id: 'qwen/qwen3.7-max',
    name: 'Qwen3.7 Max',
    family: 'Qwen3.7',
    description: 'Flagship Qwen3.7 model with 1M context. Strong agent-centric instruction following for long-context prose analysis, planning, and structured rewrites.'
  },
  {
    id: 'qwen/qwen3.7-plus',
    name: 'Qwen3.7 Plus',
    family: 'Qwen3.7',
    description: 'Cost-effective Qwen3.7 sibling with 1M context. Strong value option for long-context prose analysis, dictionary rewrites, and structured edits at a fraction of 3.7 Max\'s price.'
  },
  {
    id: 'sao10k/l3.3-euryale-70b',
    name: 'Sao10K Euryale 70B',
    family: 'Euryale',
    description: 'Roleplay specialist. Creative, non-restrictive, and great for unique character voices.'
  },
  {
    id: 'aion-labs/aion-2.0',
    name: 'Aion 2.0',
    family: 'Aion',
    description: 'Storytelling-focused model optimized for immersive roleplay, narrative tension, and character-driven rewrite exploration.'
  },
  {
    id: 'thedrummer/rocinante-12b',
    name: 'TheDrummer: Rocinante 12B',
    family: 'TheDrummer',
    description: 'Storytelling specialist. Engaging narrative voice and varied vocabulary.'
  },
  {
    id: 'thedrummer/cydonia-24b-v4.1',
    name: 'TheDrummer: Cydonia 24B v4.1',
    family: 'TheDrummer',
    description: 'Mid-size creative-writing specialist. Stronger structural coherence than Rocinante with the same narrative flair.'
  },
  {
    id: 'thedrummer/skyfall-36b-v2',
    name: 'TheDrummer: Skyfall 36B v2',
    family: 'TheDrummer',
    description: 'Larger TheDrummer model. Premium creative-writing tier for distinctive voice and longer-form fiction.'
  },
  {
    id: 'arcee-ai/virtuoso-large',
    name: 'Virtuoso Large',
    family: 'Arcee',
    description: 'Cross-domain reasoning. Good balance of creative writing and enterprise-grade analysis.'
  },
  {
    id: 'arcee-ai/trinity-large-thinking',
    name: 'Arcee Trinity Large Thinking',
    family: 'Arcee',
    description: 'Arcee\'s top thinking-tier model. Deep multi-step reasoning for complex narrative analysis.'
  }
];

export class OpenRouterModels {
  private static readonly API_URL = 'https://openrouter.ai/api/v1/models';
  private static cachedModels: OpenRouterModel[] | null = null;

  /**
   * Fetch available models from OpenRouter API
   */
  static async fetchModels(logSink?: LogSink): Promise<OpenRouterModel[]> {
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
      const reason = error instanceof Error ? error.message : String(error);
      console.error('Error fetching OpenRouter models:', error);
      // Surface the cause where a user can actually see it — the Output channel the
      // debug command reveals — not only the host dev-console.
      logSink?.appendLine(
        `[OpenRouterModels] Live model catalog fetch failed (${reason}); using offline fallback — pricing/context unavailable until the next refresh.`
      );
      // Cache the fallback so repeated reads don't re-hit a known-bad network on every
      // call. Reopening the model browser (clearCache + refetch) is the explicit retry path.
      const fallback: OpenRouterModel[] = RECOMMENDED_MODELS.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        family: m.family,
        isFallback: true,
        pricing: { prompt: '0', completion: '0' },
        context_length: 200000
      }));
      this.cachedModels = fallback;
      return fallback;
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
