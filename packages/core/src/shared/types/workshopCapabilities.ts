import type { TokenUsage } from './messages/tokenUsage';
import type { WorkshopPersonaId, WorkshopToolId } from './messages/workshop';

export type WorkshopCapabilityOperation =
  | 'dictionary.lookup'
  | 'dictionary.full-entry'
  | 'analysis.run';

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
      instructions?: string;
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

/** Reload-safe provenance rendered with a completed capability artifact. */
export interface WorkshopCapabilityArtifactDetails {
  operation: WorkshopCapabilityOperation;
  status: WorkshopCapabilityStatus;
  requestSummary: string;
  requestedByPersonaId: WorkshopPersonaId;
  metadata?: Record<string, unknown>;
}
