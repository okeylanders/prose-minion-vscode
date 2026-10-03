import { createHash } from 'crypto';
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
  readonly prepare: (messages: readonly OpenRouterMessage[]) => PreparedCacheContent;
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

const PROMPT_CACHE_POLICIES = {
  anthropicAutomatic: {
    supports: model => model.startsWith('anthropic/'),
    prepare: messages => ({ messages, cache_control: { type: 'ephemeral' } })
  },
  alibabaExplicit: {
    supports: model => ALIBABA_EXPLICIT_CACHE_MODELS.has(model),
    prepare: prepareAlibabaCacheContent
  },
  native: {
    supports: () => true,
    prepare: messages => ({ messages })
  }
} satisfies Record<string, OpenRouterPromptCachePolicy>;

/** Translate retained-conversation intent into an outgoing cache request. */
export function prepareOpenRouterPromptCacheRequest(
  model: string,
  messages: readonly OpenRouterMessage[],
  conversationId?: string
): OpenRouterPreparedMessages {
  if (!conversationId) {
    return { messages };
  }

  const baseModel = model.replace(/^~/, '').split(':')[0];
  const policy = Object.values(PROMPT_CACHE_POLICIES).find(candidate => candidate.supports(baseModel))
    ?? PROMPT_CACHE_POLICIES.native;

  return {
    // Bound the routing key without exposing tool names from runtime ids.
    session_id: `prose-minion:${createHash('sha256').update(conversationId).digest('hex')}`,
    ...policy.prepare(messages)
  };
}
