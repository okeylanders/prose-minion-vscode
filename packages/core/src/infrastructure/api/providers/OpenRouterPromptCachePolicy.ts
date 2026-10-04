import { createHash } from 'crypto';
import { ClaudeCacheTtl, coerceClaudeCacheTtl, TokenUsage } from '@messages';
import type {
  OpenRouterCacheControl,
  OpenRouterMessage,
  OpenRouterWireMessage
} from '@providers/OpenRouterChatContracts';

export interface OpenRouterPreparedMessages {
  messages: readonly OpenRouterWireMessage[];
  session_id?: string;
  cache_control?: OpenRouterCacheControl;
}

type PreparedCacheContent = Pick<OpenRouterPreparedMessages, 'messages' | 'cache_control'>;

interface OpenRouterPromptCachePolicy {
  readonly supports: (model: string) => boolean;
  readonly prepare: (messages: readonly OpenRouterMessage[], ttl: ClaudeCacheTtl) => PreparedCacheContent;
  readonly ttlSeconds: (ttl: ClaudeCacheTtl) => number | undefined;
  readonly confirmsActivity: (usage: TokenUsage) => boolean;
}

// OpenRouter's caching guide plus Alibaba endpoint cache-write metadata,
// verified 2026-10-03. Do not infer support from the Qwen family or snapshots.
const ALIBABA_EXPLICIT_CACHE_MODELS = new Set([
  'deepseek/deepseek-v3.2',
  'qwen/qwen-plus',
  'qwen/qwen3-max',
  'qwen/qwen3-coder-plus',
  'qwen/qwen3-coder-flash',
  'qwen/qwen3.6-plus',
  'qwen/qwen3.6-flash',
  'qwen/qwen3.6-max-preview',
  'qwen/qwen3.7-max',
  'qwen/qwen3.7-plus',
  'qwen/qwen3.7-flash',
  'qwen/qwen3.8-max',
  'qwen/qwen3.8-max-0902',
  'qwen/qwen3.8-flash'
]);

function prepareAlibabaCacheContent(messages: readonly OpenRouterMessage[]): PreparedCacheContent {
  const systemIndex = messages.findIndex(message => message.role === 'system' && message.content.length > 0);
  let tailIndex = messages.length - 1;
  while (tailIndex >= 0 && messages[tailIndex].content.length === 0) {
    tailIndex -= 1;
  }

  return {
    // Keep earlier text in the same wire shape when the tail marker advances.
    // The stable system marker also provides reuse beyond the 20-block lookback.
    messages: messages.map((message, index): OpenRouterWireMessage => ({
      role: message.role,
      content: message.content.length === 0 ? message.content : [{
        type: 'text',
        text: message.content,
        ...(index === systemIndex || index === tailIndex
          ? { cache_control: { type: 'ephemeral' as const } }
          : {})
      }]
    }))
  };
}

/** GPT-5.6+ has a documented 30-minute default, including automatic caching. */
function supportsOpenAiCacheWindow(model: string): boolean {
  const version = /^openai\/gpt-(\d+)(?:\.(\d+))?(?:-|$)/.exec(model);
  if (!version) {
    return false;
  }
  const major = Number(version[1]);
  const minor = Number(version[2] ?? 0);
  return major > 5 || (major === 5 && minor >= 6);
}

const PROMPT_CACHE_POLICIES = {
  anthropicAutomatic: {
    supports: model => model.startsWith('anthropic/'),
    prepare: (messages, ttl) => ({
      messages,
      cache_control: { type: 'ephemeral', ...(ttl === '1h' ? { ttl } : {}) }
    }),
    ttlSeconds: ttl => ttl === '1h' ? 3600 : 300,
    confirmsActivity: usage => (usage.cachedTokens ?? 0) > 0 || (usage.cacheWriteTokens ?? 0) > 0
  },
  alibabaExplicit: {
    supports: model => ALIBABA_EXPLICIT_CACHE_MODELS.has(model),
    prepare: prepareAlibabaCacheContent,
    ttlSeconds: () => 300,
    // A read alone could come from another endpoint's implicit cache, whose
    // lifetime is unknown. Explicit writes prove the known five-minute mode.
    confirmsActivity: usage => (usage.cacheWriteTokens ?? 0) > 0
  },
  openaiAutomatic: {
    supports: supportsOpenAiCacheWindow,
    prepare: messages => ({ messages }),
    // A minimum eligibility window, not an exact eviction time. OpenAI may
    // retain it longer; this policy does not change its automatic caching.
    ttlSeconds: () => 1800,
    confirmsActivity: usage => (usage.cachedTokens ?? 0) > 0 || (usage.cacheWriteTokens ?? 0) > 0
  },
  native: {
    supports: () => true,
    prepare: messages => ({ messages }),
    ttlSeconds: () => undefined,
    confirmsActivity: () => false
  }
} satisfies Record<string, OpenRouterPromptCachePolicy>;

function resolvePromptCachePolicy(model: string): OpenRouterPromptCachePolicy {
  const baseModel = model.replace(/^~/, '').split(':')[0];
  return Object.values(PROMPT_CACHE_POLICIES).find(candidate => candidate.supports(baseModel))
    ?? PROMPT_CACHE_POLICIES.native;
}

/** Documented cache window only; unknown native retention stays unestimated. */
export function getOpenRouterPromptCacheTtlSeconds(model: string, ttl?: ClaudeCacheTtl): number | undefined {
  return resolvePromptCachePolicy(model).ttlSeconds(coerceClaudeCacheTtl(ttl));
}

export function hasOpenRouterKnownCacheActivity(model: string, usage: TokenUsage): boolean {
  return resolvePromptCachePolicy(model).confirmsActivity(usage);
}

/** Translate retained-conversation intent into an outgoing cache request. */
export function prepareOpenRouterPromptCacheRequest(
  model: string,
  messages: readonly OpenRouterMessage[],
  conversationId?: string,
  claudeCacheTtl?: ClaudeCacheTtl
): OpenRouterPreparedMessages {
  if (!conversationId) {
    return { messages };
  }

  const policy = resolvePromptCachePolicy(model);

  return {
    // Bound the routing key without exposing tool names from runtime ids.
    session_id: `prose-minion:${createHash('sha256').update(conversationId).digest('hex')}`,
    ...policy.prepare(messages, coerceClaudeCacheTtl(claudeCacheTtl))
  };
}
