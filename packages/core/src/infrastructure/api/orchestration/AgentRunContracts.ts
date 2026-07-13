import { TokenUsage } from '@shared/types';

/** The caller-selected capability surface available to one agent turn. */
export type CapabilityCatalog = 'guides' | 'projectContext' | 'workshopPersona' | 'none';

export type ConversationRetention = 'retain' | 'discard';

export type CapabilityLimitBehavior = 'forceFinalResponse' | 'returnLastResponse';

/**
 * The policy selected by every AI route. Capability and correction budgets
 * reset for each user turn, including retained-conversation continuations.
 */
export interface RunPolicy {
  readonly id: string;
  readonly capabilityCatalog: CapabilityCatalog;
  readonly retention: ConversationRetention;
  readonly maxCapabilityRounds: number;
  readonly maxCorrectionTurns: number;
  readonly onCapabilityLimit: CapabilityLimitBehavior;
  readonly visibleArtifact: 'final-response' | 'status-only';
  readonly cleanupOwner: 'engine' | 'workshop-session';
}

/** A compact, attributable record of evidence delivered to a model. */
export interface CapabilityArtifact {
  readonly catalog: Exclude<CapabilityCatalog, 'none'>;
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly size: number;
  readonly reason: string;
}

/** Every capability rejection has a stable, log-safe reason. */
export interface AgentCapabilityRejection {
  readonly kind: 'invalid';
  readonly reason: string;
}

/** Provider-neutral inspection result for any typed capability operation. */
export type AgentCapabilityInspection<Request, Rejection extends AgentCapabilityRejection> =
  | { readonly kind: 'none' }
  | { readonly kind: 'request'; readonly request: Request }
  | Rejection;

export interface CapabilityFulfillment {
  readonly evidence: string;
  readonly artifacts: readonly CapabilityArtifact[];
  /** Log-safe identifiers delivered by this call (paths, operation labels, etc.). */
  readonly deliveredItems: readonly string[];
  /** Nested provider usage, aggregated into the enclosing turn exactly once. */
  readonly usage?: TokenUsage;
}

/**
 * A capability owns its protocol, validation, execution, evidence formatting,
 * and provenance. The engine owns turn mechanics and treats the request as an
 * opaque typed value returned by that same capability's inspector.
 */
export interface AgentCapability<
  Request = unknown,
  Rejection extends AgentCapabilityRejection = AgentCapabilityRejection
> {
  readonly catalog: Exclude<CapabilityCatalog, 'none'>;
  /** Enter the protocol/catalog contract into history on the initial turn. */
  appendContract(userMessage: string): Promise<string>;
  inspectRequest(candidate: string): AgentCapabilityInspection<Request, Rejection>;
  fulfill(request: Request): Promise<CapabilityFulfillment>;
  stripToolCalls(content: string): string;
  statusMessage(request: Request): string;
  statusTicker?(request: Request): string | undefined;
  /** A bounded summary suitable for logs; never return full manuscript context. */
  requestLogSummary(request: Request): string;
  /** Stable per-turn identifiers added to accept/reject logs when available. */
  inspectionLogContext?(): string;
  invalidRequestInstruction(rejection: Rejection): string;
  limitInstruction(): string;
}

/** Engine-internal existential pairing: inspect and fulfill belong to one adapter. */
export type AnyAgentCapability = AgentCapability<unknown, AgentCapabilityRejection>;

/**
 * Capabilities carry per-turn validation/budget state, so long-lived callers
 * hold a factory and mint a fresh instance for every user turn.
 */
export type AgentCapabilityFactory = () => AnyAgentCapability;

export type StreamingTokenCallback = (token: string) => void;

export interface AgentRunOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onToken?: StreamingTokenCallback;
}

export interface InitialRunRequest {
  readonly toolName: string;
  readonly systemMessage: string;
  readonly userMessage: string;
  readonly policy: RunPolicy;
  readonly options?: AgentRunOptions;
  /** Required exactly when policy.capabilityCatalog is not `none`. */
  readonly capability?: AnyAgentCapability;
}

export interface ContinuationRunRequest {
  readonly conversationId: string;
  readonly userMessage: string;
  readonly policy: RunPolicy;
  readonly options?: AgentRunOptions;
  /** Required exactly when policy.capabilityCatalog is not `none`. */
  readonly capability?: AnyAgentCapability;
}

export interface ExecutionResult {
  readonly content: string;
  readonly usedGuides: string[];
  readonly requestedResources: string[];
  readonly artifacts: CapabilityArtifact[];
  readonly usage?: TokenUsage;
  readonly finishReason?: string;
  readonly cancelled?: boolean;
  readonly conversationId?: string;
}
