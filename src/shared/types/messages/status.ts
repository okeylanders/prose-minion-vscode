/**
 * Status domain messages
 * Status updates and notifications
 */

import { MessageEnvelope, MessageType } from './base';

// ============================================================================
// Status Types
// ============================================================================

/**
 * Function signature for emitting status messages with optional progress and ticker
 *
 * @param message - Status message to display
 * @param progress - Optional progress tracking (current/total)
 * @param tickerMessage - Optional scrolling ticker text (e.g., matched words, guide names, block names)
 */
export type StatusEmitter = (
  message: string,
  progress?: { current: number; total: number },
  tickerMessage?: string
) => void;

export interface StatusPayload {
  message: string;
  tickerMessage?: string;  // Optional scrolling ticker text (matched words, guide names, block names, etc.)
  progress?: {
    current: number;
    total: number;
  };
}

export interface StatusMessage extends MessageEnvelope<StatusPayload> {
  type: MessageType.STATUS;
}
