import type { ContextPathGroup } from '../context';

/** Provider-neutral disclosure of whether context compression materially ran. */
export type ContextCompressionState = 'applied' | 'not-applied' | 'unknown';

/**
 * What a manifest row IS (Sprint 12 Phase 7). `pin` = the versioned excerpt;
 * `attachment` = standing context; `message-attachment` = a one-shot
 * thread-artifact (Phase 6B) that rode a single message; `resource` =
 * a configured project resource or craft guide an agent fetched;
 * `tool-evidence` = an analysis side-pass report; `dictionary` = Writer's
 * Dictionary evidence.
 */
export type ContextSourceKind =
  | 'pin'
  | 'attachment'
  | 'message-attachment'
  | 'resource'
  | 'tool-evidence'
  | 'dictionary';

/** Who put the material into this participant's context. */
export type ContextSourceOrigin = 'writer' | 'host' | 'tool';

/**
 * One row of the "In context" manifest (Sprint 12 Phase 7): what a retained
 * participant is actually carrying, regardless of who put it there. Closed
 * and display-safe — raw absolute paths and conversation ids never enter
 * this contract. Cost is provider-measured (`promptTokensDelta`) where the
 * engine could attribute a capability round; `sizeChars` is the honest
 * fallback with `isEstimate: true`. The manifest observes — it never gates,
 * edits, or trims prompt content.
 */
export interface ContextSourceEntry {
  kind: ContextSourceKind;
  origin: ContextSourceOrigin;
  label: string;
  configuredResource?: { group: ContextPathGroup; path: string };
  sizeChars: number;
  /** Provider-measured tokens attributed to this delivery, when available. */
  promptTokensDelta?: number;
  isEstimate: boolean;
  excerptVersion?: number;
  /** Superseded by a later excerpt revision; rendered dimmed, never vanished. */
  stale?: boolean;
  /** Epoch ms when the material entered this participant's context. */
  deliveredAt: number;
}

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
  /**
   * The active participant's context-source manifest (Sprint 12 Phase 7):
   * writer-declared entries first, then agent-fetched deliveries in
   * delivery order.
   */
  sources?: ContextSourceEntry[];
}
