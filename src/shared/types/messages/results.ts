/**
 * Results domain messages
 * File operations and save results
 */

import { MessageEnvelope, MessageType } from './base';

// ============================================================================
// Save Result Types
// ============================================================================

export interface SaveResultMetadata {
  word?: string;
  excerpt?: string;
  context?: string;
  sourceFileUri?: string;
  relativePath?: string;
  timestamp?: number;
}

// ============================================================================
// Copy/Save Result Messages
// ============================================================================

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
