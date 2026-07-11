import { TokenUsage } from '@shared/types';
import { ResourceReadInspection } from './ResourceReadXmlCodec';

/** A deliberately small, caller-selected view of resources an agent may request. */
export type ResourceCatalog = 'guides' | 'projectContext' | 'none';

export type ConversationRetention = 'retain' | 'discard';

export type CapabilityLimitBehavior = 'forceFinalResponse' | 'returnLastResponse';

/**
 * The policy selected by every initial AI route. Keeping this data beside the
 * engine prevents a caller from accidentally inheriting another route's
 * catalog, retention, or cleanup semantics.
 */
export interface RunPolicy {
  readonly id: string;
  readonly resourceCatalog: ResourceCatalog;
  readonly retention: ConversationRetention;
  readonly maxCapabilityRounds: number;
  readonly onCapabilityLimit: CapabilityLimitBehavior;
  readonly visibleArtifact: 'final-response' | 'status-only';
  readonly cleanupOwner: 'engine' | 'workshop-session';
}

/** A compact, attributable record of evidence delivered to a model. */
export interface ResourceArtifact {
  readonly catalog: Exclude<ResourceCatalog, 'none'>;
  readonly path: string;
  readonly label: string;
  readonly category: string;
  readonly size: number;
  readonly reason: string;
}

export interface CapabilityFulfillment {
  readonly evidence: string;
  readonly artifacts: readonly ResourceArtifact[];
  readonly deliveredPaths: readonly string[];
}

/**
 * A capability owns its protocol: catalog enumeration, exact XML request
 * validation, fulfillment, evidence formatting, and provenance. The engine
 * owns turn mechanics and never interprets a guide or workspace path itself.
 */
export interface AgentCapability {
  readonly catalog: Exclude<ResourceCatalog, 'none'>;
  appendCatalog(userMessage: string): Promise<string>;
  inspectRequest(candidate: string): ResourceReadInspection;
  fulfill(requestedPaths: readonly string[]): Promise<CapabilityFulfillment>;
  stripToolCalls(content: string): string;
  statusMessage(requestedPaths: readonly string[]): string;
  statusTicker?(requestedPaths: readonly string[]): string | undefined;
  invalidRequestInstruction(rejection: Extract<ResourceReadInspection, { kind: 'invalid' }>): string;
  limitInstruction(): string;
}

/**
 * Capabilities carry per-run allowlist state, so long-lived callers hold a
 * factory and mint a fresh instance per run rather than sharing one whose
 * catalog snapshot another concurrent run could overwrite.
 */
export type AgentCapabilityFactory = () => AgentCapability;

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
  /** Required exactly when policy.resourceCatalog is not `none`. */
  readonly capability?: AgentCapability;
}

export interface ExecutionResult {
  readonly content: string;
  readonly usedGuides: string[];
  readonly requestedResources: string[];
  readonly artifacts: ResourceArtifact[];
  readonly usage?: TokenUsage;
  readonly finishReason?: string;
  readonly cancelled?: boolean;
  readonly conversationId?: string;
}
