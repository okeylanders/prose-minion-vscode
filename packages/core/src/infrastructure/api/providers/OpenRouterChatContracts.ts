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
