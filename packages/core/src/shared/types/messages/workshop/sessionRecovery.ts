/**
 * Explicit recovery of a named session left mid-save (ADR 2026-11-19 D6e).
 * The webview confirms first (close other windows; unsaved work is kept),
 * then posts ids only: a webview-minted `requestId` and
 * the session id. The host answers by `requestId`, in host words.
 */

import { MessageEnvelope, MessageType } from '../base';

export interface WorkshopRecoverNamedSessionPayload {
  requestId: string;
  sessionId: string;
}

export interface WorkshopRecoverNamedSessionMessage extends MessageEnvelope<WorkshopRecoverNamedSessionPayload> {
  type: MessageType.WORKSHOP_RECOVER_NAMED_SESSION;
}

export interface WorkshopNamedSessionRecoveryResultPayload {
  requestId: string;
  sessionId: string;
  ok: boolean;
  /** The host's words: what recovery restored and kept, or the step it stopped at. */
  message: string;
}

export interface WorkshopNamedSessionRecoveryResultMessage extends MessageEnvelope<WorkshopNamedSessionRecoveryResultPayload> {
  type: MessageType.WORKSHOP_NAMED_SESSION_RECOVERY_RESULT;
}
