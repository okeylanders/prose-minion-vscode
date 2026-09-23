import { ModelParameterCount } from '@messages';

const UNDISCLOSED_PARAMETER_COUNT: ModelParameterCount = {
  label: 'params undisclosed',
  confidence: 'undisclosed'
};

/**
 * Parameter counts are not part of OpenRouter's model API contract. Published
 * values below come from provider/model-card disclosures surfaced by
 * OpenRouter. Approximate values use public Hugging Face safetensor metadata,
 * rounded for a compact comparison tag. Missing values remain explicitly
 * undisclosed instead of inferring proprietary architecture from price or
 * benchmark behavior.
 */
export const MODEL_PARAMETER_METADATA: Readonly<Record<string, ModelParameterCount>> = {
  'deepseek/deepseek-r1': { label: '671B params · 37B active', confidence: 'published' },
  'deepseek/deepseek-v3.1-terminus': { label: '≈685B params', confidence: 'estimated' },
  'deepseek/deepseek-v3.2-exp': { label: '≈685B params', confidence: 'estimated' },
  'deepseek/deepseek-v3.2': { label: '≈685B params', confidence: 'estimated' },
  'deepseek/deepseek-v4-pro': { label: '1.6T params · 49B active', confidence: 'published' },
  'deepseek/deepseek-v4-pro-0813': { label: '≈1.65T params', confidence: 'estimated' },
  'deepseek/deepseek-v4-flash': { label: '284B params · 13B active', confidence: 'published' },
  'deepseek/deepseek-v4-flash-0731': { label: '284B params · 13B active', confidence: 'published' },
  'deepseek/deepseek-v4.1-flash': { label: '≈763B params · 8–16B active', confidence: 'estimated' },
  'stepfun/step-3.7-flash': { label: '196B params · 11B active', confidence: 'published' },
  'z-ai/glm-4.5': { label: '≈358B params', confidence: 'estimated' },
  'z-ai/glm-4.6': { label: '≈357B params', confidence: 'estimated' },
  'z-ai/glm-4.7': { label: '≈358B params', confidence: 'estimated' },
  'z-ai/glm-4.7-flash': { label: '≈31B params', confidence: 'estimated' },
  'z-ai/glm-5': { label: '≈754B params', confidence: 'estimated' },
  'z-ai/glm-5.1': { label: '≈754B params', confidence: 'estimated' },
  'z-ai/glm-5.2': { label: '≈753B params', confidence: 'estimated' },
  'z-ai/glm-5.3': { label: '≈753B params', confidence: 'estimated' },
  'z-ai/glm-5.3-flash': { label: '≈321B params', confidence: 'estimated' },
  'z-ai/glm-5.3-flashx': { label: '≈321B params', confidence: 'estimated' },
  'openai/gpt-oss-120b:nitro': { label: '117B params · 5.1B active', confidence: 'published' },
  'moonshotai/kimi-k2-0905': { label: '1T params · 32B active', confidence: 'published' },
  'moonshotai/kimi-k2-thinking': { label: '1T params · 32B active', confidence: 'published' },
  'moonshotai/kimi-k2.5': { label: '≈1.03T params', confidence: 'estimated' },
  'moonshotai/kimi-k2.6': { label: '≈1.03T params', confidence: 'estimated' },
  'moonshotai/kimi-k3': { label: '2.8T params', confidence: 'published' },
  'qwen/qwen3.8-max-0902': { label: '2.4T params', confidence: 'published' },
  'qwen/qwen3.8-flash': { label: '≈180B params', confidence: 'estimated' },
  'mistralai/mistral-large-2407': { label: '123B params', confidence: 'published' },
  'mistralai/mistral-medium-3-5': { label: '128B params', confidence: 'published' },
  'mistralai/mistral-small-2603': { label: '119B params', confidence: 'published' },
  'nousresearch/hermes-4-405b': { label: '405B params', confidence: 'published' },
  'nousresearch/hermes-3-llama-3.1-70b': { label: '70B params', confidence: 'published' },
  'nousresearch/hermes-3-llama-3.1-405b': { label: '405B params', confidence: 'published' },
  'xiaomi/mimo-v2.6-flash': { label: '309B params · 15B active', confidence: 'published' },
  'xiaomi/mimo-v2.6-pro': { label: '>1T params', confidence: 'published' },
  'xiaomi/mimo-v2.6-pro-ultraspeed': { label: '1T params', confidence: 'published' },
  'qwen/qwen3-coder-plus': { label: '480B params · 35B active', confidence: 'published' },
  'qwen/qwen3.6-max-preview': { label: '≈1T params', confidence: 'published' },
  'sao10k/l3.3-euryale-70b': { label: '70B params', confidence: 'published' },
  'thedrummer/cydonia-24b-v4.1': { label: '24B params', confidence: 'published' },
  'thedrummer/skyfall-36b-v2': { label: '36B params', confidence: 'published' },
  'arcee-ai/trinity-large-thinking': { label: '≈399B params', confidence: 'estimated' },
  'aion-labs/aion-2.0': { label: '≈685B base params', confidence: 'estimated' },
  'sakana/fugu-ultra': { label: 'multi-model system', confidence: 'not-applicable' },
  'aion-labs/aion-3.0-mini': { label: 'multi-model system', confidence: 'not-applicable' },
  'aion-labs/aion-3.0': { label: 'multi-model system', confidence: 'not-applicable' },
  'aion-labs/aion-3.5-mini': { label: 'multi-model system', confidence: 'not-applicable' },
  'aion-labs/aion-3.5': { label: 'multi-model system', confidence: 'not-applicable' }
};

export const getModelParameterMetadata = (modelId: string): ModelParameterCount => {
  return MODEL_PARAMETER_METADATA[modelId] ?? UNDISCLOSED_PARAMETER_COUNT;
};
