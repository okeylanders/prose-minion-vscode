/**
 * Error domain messages
 * Error handling and error source tracking
 */

import { MessageEnvelope, MessageType } from './base';

// ============================================================================
// Error Types
// ============================================================================

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
  | 'analysis.writing_tools'

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
  | 'ui.docs'
  | 'ui.resource'
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
