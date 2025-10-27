/**
 * Results domain messages
 * Generic result messages and file operations
 */

import { BaseMessage, MessageType, SaveResultMetadata } from './base';

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

  // Publishing domain
  | 'publishing'

  // UI operations
  | 'ui.guide'
  | 'ui.selection'

  // File operations
  | 'file_ops.copy'
  | 'file_ops.save'

  // Unknown/legacy (fallback)
  | 'unknown';

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  source: ErrorSource;
  message: string;
  details?: string;
}

export interface StatusMessage extends BaseMessage {
  type: MessageType.STATUS;
  message: string;
  guideNames?: string;  // Comma-separated list of guide names for ticker animation
}

export interface CopyResultMessage extends BaseMessage {
  type: MessageType.COPY_RESULT;
  toolName: string;
  content: string;
}

export interface SaveResultMessage extends BaseMessage {
  type: MessageType.SAVE_RESULT;
  toolName: string;
  content: string;
  metadata?: SaveResultMetadata;
}

export interface SaveResultSuccessMessage extends BaseMessage {
  type: MessageType.SAVE_RESULT_SUCCESS;
  filePath: string;
  toolName: string;
}
