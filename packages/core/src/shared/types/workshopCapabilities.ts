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

/** Reload-safe provenance rendered with a completed capability artifact. */
export interface WorkshopCapabilityArtifactDetails {
  operation: WorkshopCapabilityOperation;
  status: WorkshopCapabilityStatus;
  requestSummary: string;
  requestedByPersonaId: WorkshopPersonaId;
  metadata?: Record<string, unknown>;
}
