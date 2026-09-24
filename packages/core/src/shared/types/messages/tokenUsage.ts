/**
 * Token usage tracking
 * First-class app behavior for AI token and cost tracking
 */

// ============================================================================
// Token Usage Types
// ============================================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Number of provider requests represented by an aggregated logical-turn usage. */
  requestCount?: number;
  costUsd?: number;
  isEstimate?: boolean;
  /** Prompt tokens the provider explicitly reported reading from cache. Absent means unreported. */
  cachedTokens?: number;
  /** Prompt tokens the provider explicitly reported writing to cache. Absent means unreported. */
  cacheWriteTokens?: number;
}
