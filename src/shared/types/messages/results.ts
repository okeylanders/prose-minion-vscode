/**
 * Results domain messages
 * Generic result messages and file operations
 */

import { BaseMessage, MessageType, SaveResultMetadata } from './base';

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
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
