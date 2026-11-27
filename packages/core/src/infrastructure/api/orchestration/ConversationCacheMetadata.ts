/** The only provider-cache telemetry that survives a restore, independent of a measured token budget. */
export interface ConversationCacheEstimate {
  estimatedCacheExpiresAt: number;
  cacheRequestModelId: string;
}

export function conversationRoutingKey(value: unknown): string | undefined {
  return typeof value === 'string' && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
    ? value : undefined;
}

/** Validate persisted hints independently of the wall clock; readers decide if the window is still open. */
export function conversationCacheEstimate(expiresAt: unknown, model: unknown): ConversationCacheEstimate | undefined {
  if (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= 0
    || typeof model !== 'string' || model.length === 0 || model.length > 256 || /[^!-~]/.test(model)) {
    return undefined;
  }
  return { estimatedCacheExpiresAt: expiresAt, cacheRequestModelId: model };
}
