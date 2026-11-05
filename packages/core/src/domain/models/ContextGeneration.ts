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
  /** Byte size observed while admitting the file to the configured catalog. */
  readonly sizeBytes: number;
  /**
   * HOST-SIDE ONLY. Never crosses the webview or a prompt — consumers that
   * project summaries outward map display-safe fields explicitly.
   */
  readonly absolutePath: string;
  readonly workspaceFolder?: string;
}

export interface ContextResourceContent extends ContextResourceSummary {
  readonly content: string;
}

export interface ContextResourceProvider {
  listResources(): ContextResourceSummary[];
  loadResources(paths: string[]): Promise<ContextResourceContent[]>;
}

/**
 * One configured match, kept whole (ADR 2026-11-05 D4.1): every workspace
 * folder, relative path and group a file matches, never only the first. The
 * same containment and symbolic-link checks admit it as admit the catalog.
 * HOST-SIDE ONLY: never crosses the webview, a prompt or a log.
 */
export interface ContextResourceCandidate {
  readonly group: ContextPathGroup;
  /** Relative to `workspaceFolderPath`, `/`-separated. */
  readonly relativePath: string;
  readonly workspaceFolderPath: string;
  readonly absolutePath: string;
  readonly sizeBytes: number;
}

/** Every configured match across groups and roots, read fresh. */
export interface ContextResourceCandidateReader {
  listCandidates(groups: ContextPathGroup[]): Promise<ContextResourceCandidate[]>;
}

/** Application-facing factory seam implemented by ContextResourceResolver. */
export interface ContextResourceProviderFactory {
  createProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider>;
}

export const DEFAULT_CONTEXT_GROUPS: ContextPathGroup[] = [...CONTEXT_PATH_GROUPS];
import { TokenUsage } from '@shared/types';
