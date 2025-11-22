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
  costUsd?: number;
  isEstimate?: boolean;
}
