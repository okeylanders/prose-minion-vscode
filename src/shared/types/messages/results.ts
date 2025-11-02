/**
 * Results domain messages
 * Generic result messages and file operations
 */

import { MessageEnvelope, MessageType, SaveResultMetadata } from './base';

/**
 * Hierarchical error source identifier
 * Format: 'domain' or 'domain.subtool'
 *
 * Allows selective error handling and loading state clearing.
 * Extensible for future tabs with subtools.
 */
export type ErrorSource =
  // Analysis domain
  | 'analysis'
  | 'analysis.dialogue'
  | 'analysis.prose'

  // Metrics domain with subtools
  | 'metrics.prose_stats'
  | 'metrics.style_flags'
  | 'metrics.word_frequency'

  // Search domain
  | 'search'

  // Dictionary domain
  | 'dictionary'

  // Context domain
  | 'context'

  // Settings/configuration domain
  | 'settings.api_key'
  | 'settings.model'
  | 'settings.general'
  | 'settings.tokens'

  // Publishing domain
  | 'publishing'

  // Sources domain
  | 'sources.active_file'
  | 'sources.manuscript_globs'
  | 'sources.chapter_globs'

  // UI operations
  | 'ui.guide'
  | 'ui.selection'

  // File operations
  | 'file_ops.copy'
  | 'file_ops.save'

  // Unknown/legacy (fallback)
  | 'unknown';

export interface ErrorPayload {
  source: ErrorSource;
  message: string;
  details?: string;
}

export interface ErrorMessage extends MessageEnvelope<ErrorPayload> {
  type: MessageType.ERROR;
}

export interface StatusPayload {
  message: string;
  guideNames?: string;  // Comma-separated list of guide names for ticker animation
}

export interface StatusMessage extends MessageEnvelope<StatusPayload> {
  type: MessageType.STATUS;
}

export interface CopyResultPayload {
  toolName: string;
  content: string;
}

export interface CopyResultMessage extends MessageEnvelope<CopyResultPayload> {
  type: MessageType.COPY_RESULT;
}

export interface SaveResultPayload {
  toolName: string;
  content: string;
  metadata?: SaveResultMetadata;
}

export interface SaveResultMessage extends MessageEnvelope<SaveResultPayload> {
  type: MessageType.SAVE_RESULT;
}

export interface SaveResultSuccessPayload {
  filePath: string;
  toolName: string;
}

export interface SaveResultSuccessMessage extends MessageEnvelope<SaveResultSuccessPayload> {
  type: MessageType.SAVE_RESULT_SUCCESS;
}
