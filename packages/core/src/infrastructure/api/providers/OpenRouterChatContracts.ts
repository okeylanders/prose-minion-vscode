/** Plain transcript content owned by conversation storage. */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCacheControl {
  type: 'ephemeral';
  ttl?: '5m' | '1h';
}

export interface OpenRouterTextContentBlock {
  type: 'text';
  text: string;
  cache_control?: OpenRouterCacheControl;
}

/** Provider wire content; cache metadata never enters the retained transcript. */
export interface OpenRouterWireMessage {
  role: OpenRouterMessage['role'];
  content: string | OpenRouterTextContentBlock[];
}

/**
 * A function call the model returned as structure instead of text
 * (`message.tool_calls`). `arguments` is the provider's raw JSON text,
 * unparsed: whoever reads it decides what it may mean. Never retained in a
 * transcript, which holds `OpenRouterMessage` roles only.
 *
 * `fault` marks a call the wire did not carry soundly: a name or arguments
 * that were not text (`malformed`), or longer than the boundary keeps
 * (`oversized`). Such a call is reported, never repaired: its `arguments`
 * are empty, not a prefix of what was sent, and no reader may run it.
 */
export interface OpenRouterToolCall {
  readonly id?: string;
  readonly name: string;
  readonly arguments: string;
  readonly fault?: OpenRouterToolCallFault;
}

export type OpenRouterToolCallFault = 'malformed' | 'oversized';
