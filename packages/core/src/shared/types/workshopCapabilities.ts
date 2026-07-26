import type { TokenUsage } from './messages/tokenUsage';
import type { WorkshopPersonaId, WorkshopToolId } from './messages/workshop';
import type { ContextPathGroup } from './context';

export type WorkshopCapabilityOperation =
  | 'dictionary.lookup'
  | 'dictionary.full-entry'
  | 'analysis.run'
  | 'resource.catalog'
  | 'resource.search'
  | 'resource.read';

export type WorkshopAnalysisInputMode = 'inherit' | 'prepend' | 'replace' | 'omit';

export interface WorkshopAnalysisInputSelection {
  mode: WorkshopAnalysisInputMode;
  text?: string;
}

export interface WorkshopAnalysisInputProvenance {
  mode: WorkshopAnalysisInputMode;
  material: string;
  chosenBy: string;
  words: number;
  truncation?: string;
}

export type WorkshopCapabilityRequest =
  | {
      capability: 'dictionary.lookup';
      word: string;
      context: string;
      purpose: string;
    }
  | {
      capability: 'dictionary.full-entry';
      word: string;
      context: string;
      purpose: string;
    }
  | {
      capability: 'analysis.run';
      toolId: WorkshopToolId;
      excerpt: WorkshopAnalysisInputSelection;
      context: WorkshopAnalysisInputSelection;
    }
  | {
      capability: 'resource.catalog';
      group?: ContextPathGroup;
    }
  | {
      capability: 'resource.search';
      query: string;
      group?: ContextPathGroup;
    }
  | {
      capability: 'resource.read';
      group: ContextPathGroup;
      path: string;
      startLine?: number;
      endLine?: number;
    };

export type WorkshopCapabilityStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface WorkshopCapabilityResult {
  capability: WorkshopCapabilityOperation;
  status: WorkshopCapabilityStatus;
  requestSummary: string;
  content?: string;
  metadata?: Record<string, unknown>;
  usage?: TokenUsage;
  error?: string;
}

/**
 * The conversation owner on whose behalf a capability ran
 * (ADR 2026-07-24 §2). Persisted on the turn: who invoked a capability is a
 * historical fact, and once guests are invokers ownership is unrecoverable
 * from the record unless it is stored. Whether an owner implies privacy stays
 * a computed policy (13D's `audience()`), never a stored classification.
 */
export type WorkshopCapabilityPrincipal =
  | { kind: 'host' }
  | { kind: 'personaGuest'; personaId: WorkshopPersonaId };

/** Reload-safe provenance rendered with a completed capability artifact. */
export interface WorkshopCapabilityArtifactDetails {
  operation: WorkshopCapabilityOperation;
  status: WorkshopCapabilityStatus;
  requestSummary: string;
  requestedByPersonaId: WorkshopPersonaId;
  invokedBy: WorkshopCapabilityPrincipal;
  metadata?: Record<string, unknown>;
}
