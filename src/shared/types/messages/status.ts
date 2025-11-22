/**
 * Status domain messages
 * Status updates and notifications
 */

import { MessageEnvelope, MessageType } from './base';

// ============================================================================
// Status Types
// ============================================================================

/**
 * Function signature for emitting status messages with optional progress
 */
export type StatusEmitter = (
  message: string,
  progress?: { current: number; total: number }
) => void;

export interface StatusPayload {
  message: string;
  guideNames?: string;  // Comma-separated list of guide names for ticker animation
  progress?: {
    current: number;
    total: number;
  };
}

export interface StatusMessage extends MessageEnvelope<StatusPayload> {
  type: MessageType.STATUS;
}
