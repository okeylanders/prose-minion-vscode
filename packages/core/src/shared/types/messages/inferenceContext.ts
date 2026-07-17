/** Provider-neutral disclosure of whether context compression materially ran. */
export type ContextCompressionState = 'applied' | 'not-applied' | 'unknown';

/** Facts reported for one completed provider request. */
export interface InferenceRequestObservation {
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
  requestedMaxOutputTokens: number;
  finishReason?: string;
  contextCompression: ContextCompressionState;
  measuredAt: number;
}

/** Backward-looking context and processed-traffic telemetry for one logical turn. */
export interface ContextBudgetSnapshot {
  modelId: string;
  /** Provider-measured retained context after the latest committed reply. */
  contextTokens: number;
  promptTokens: number;
  completionTokens: number;
  peakPromptTokensThisTurn: number;
  requestedMaxOutputTokens: number;
  callsThisTurn: number;
  turnProcessedTokens: number;
  contextCompression: ContextCompressionState;
  measuredAt: number;
}

/** Safe Workshop projection. Private conversation keys never enter this contract. */
export interface LabeledContextBudgetSnapshot {
  label: string;
  snapshot?: ContextBudgetSnapshot;
}
