import type { TokenUsage } from './messages/tokenUsage';
import type {
  WorkshopPersonaId,
  WorkshopToolId
} from '@messages';
import type { ContextPathGroup } from './context';

/**
 * The closed operation list. The union, the persisted codec's allowlist, and
 * every exhaustive switch derive from it, so adding an operation here is the
 * one edit that widens all of them (and forgetting a switch case fails to
 * compile instead of failing a writer's save).
 */
export const WORKSHOP_CAPABILITY_OPERATIONS = [
  'dictionary.lookup',
  'dictionary.full-entry',
  'analysis.run',
  'resource.catalog',
  'resource.search',
  'resource.read'
] as const;

export type WorkshopCapabilityOperation = typeof WORKSHOP_CAPABILITY_OPERATIONS[number];

export const isWorkshopCapabilityOperation = (value: unknown): value is WorkshopCapabilityOperation =>
  typeof value === 'string' &&
  (WORKSHOP_CAPABILITY_OPERATIONS as readonly string[]).includes(value);

/**
 * A capability family owns its operations' writer-facing name, evidence
 * framing, and rejected-request handling. Every consumer switches on the
 * family exhaustively, so an operation without one fails to compile instead
 * of borrowing another family's name through an implicit "otherwise".
 */
export type WorkshopCapabilityFamily = 'dictionary' | 'analysis' | 'resource';

export function workshopCapabilityFamily(
  operation: WorkshopCapabilityOperation
): WorkshopCapabilityFamily {
  switch (operation) {
    case 'dictionary.lookup':
    case 'dictionary.full-entry':
      return 'dictionary';
    case 'analysis.run':
      return 'analysis';
    case 'resource.catalog':
    case 'resource.search':
    case 'resource.read':
      return 'resource';
    default: {
      const unhandled: never = operation;
      throw new Error(`Unhandled Workshop capability operation: ${String(unhandled)}`);
    }
  }
}

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
  /**
   * Final participant reply that transactionally published this evidence to
   * the room. Absent means private, including all pre-13D artifacts.
   */
  publishedWithTurnId?: string;
  metadata?: Record<string, unknown>;
}
