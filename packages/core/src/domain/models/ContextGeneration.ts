/**
 * Domain models for the context assistant workflow
 */

import { CONTEXT_PATH_GROUPS, ContextPathGroup } from '@shared/types';

export interface ContextGenerationRequest {
  readonly excerpt: string;
  readonly existingContext?: string;
  readonly sourceFileUri?: string;
  readonly requestedGroups?: ContextPathGroup[];
}

export interface ContextGenerationResult {
  readonly toolName: string;
  readonly content: string;
  readonly timestamp: Date;
  readonly requestedResources?: string[];
  readonly usage?: TokenUsage;
}

export interface ContextResourceSummary {
  readonly group: ContextPathGroup;
  readonly path: string;
  readonly label: string;
  readonly workspaceFolder?: string;
}

export interface ContextResourceContent extends ContextResourceSummary {
  readonly content: string;
}

export interface ContextResourceProvider {
  listResources(): ContextResourceSummary[];
  loadResources(paths: string[]): Promise<ContextResourceContent[]>;
}

/** Application-facing factory seam implemented by ContextResourceResolver. */
export interface ContextResourceProviderFactory {
  createProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider>;
}

export const DEFAULT_CONTEXT_GROUPS: ContextPathGroup[] = [...CONTEXT_PATH_GROUPS];
import { TokenUsage } from '@shared/types';
