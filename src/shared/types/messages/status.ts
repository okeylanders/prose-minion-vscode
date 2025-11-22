/**
 * Status domain messages
 * Status updates and notifications
 */

import { MessageEnvelope, MessageType } from './base';

// ============================================================================
// Status Types
// ============================================================================

export interface StatusPayload {
  message: string;
  guideNames?: string;  // Comma-separated list of guide names for ticker animation
}

export interface StatusMessage extends MessageEnvelope<StatusPayload> {
  type: MessageType.STATUS;
}
