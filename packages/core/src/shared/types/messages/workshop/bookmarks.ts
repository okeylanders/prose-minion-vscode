/**
 * Workshop bookmarks (ADR 2026-11-03 D5, D6, D9, D10), and the read-only
 * turn preview that opens a bookmark, a to-do's source or a read-in card
 * outside the snapshot's window (D6).
 *
 * The writer marks a bubble to come back to it. Bookmarks are host-owned
 * session state: the host checks which turns may carry one, mints ids, and
 * resolves each label. They are presentation only, and never enter a
 * persona's prompt, a room frame, provider history, or recall.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { WorkshopPersonaId, WorkshopToolId } from './participants';
import type { WorkshopTurnParticipant } from './session';

/** The longest label a writer may give a bookmark, after trimming. */
export const WORKSHOP_BOOKMARK_LABEL_CHARACTERS = 80;

/**
 * One bookmark as the session stores it. `label` is present only when the
 * writer named it; otherwise the host derives the default from the turn.
 * Host-private: the webview receives `WorkshopBookmarkSummary` instead.
 */
export interface WorkshopTurnBookmark {
  id: string;
  turnId: string;
  label?: string;
  /** Epoch ms when the writer set it (host-stamped). */
  createdAt: number;
}

/**
 * One bookmark as the snapshot shows it, in thread order, whether or not its
 * bubble is in the snapshot's window.
 */
export interface WorkshopBookmarkSummary {
  id: string;
  turnId: string;
  /** The writer's label, or the deterministic default. Never model-generated. */
  label: string;
  participant: WorkshopTurnParticipant;
  personaId?: WorkshopPersonaId;
  toolId?: WorkshopToolId;
  /** True when the same snapshot's `turns` holds this bookmark's bubble. */
  inWindow: boolean;
}

/** Set (`true`) or clear (`false`) the bookmark on one turn. Idempotent. */
export interface WorkshopSetTurnBookmarkPayload {
  turnId: string;
  bookmarked: boolean;
}

export interface WorkshopSetTurnBookmarkMessage
  extends MessageEnvelope<WorkshopSetTurnBookmarkPayload> {
  type: MessageType.WORKSHOP_SET_TURN_BOOKMARK;
}

/** Name a bookmark; `null` (or a blank label) restores the default. */
export interface WorkshopRenameBookmarkPayload {
  bookmarkId: string;
  label: string | null;
}

export interface WorkshopRenameBookmarkMessage
  extends MessageEnvelope<WorkshopRenameBookmarkPayload> {
  type: MessageType.WORKSHOP_RENAME_BOOKMARK;
}

/**
 * Ask for one turn of the room, read-only, for the preview sheet (ADR
 * 2026-11-03 D6). `requestId` is minted by the webview and echoed, so only
 * the answer to the pending request is taken (as the Read in reader's is).
 */
export interface WorkshopRequestTurnPreviewPayload {
  requestId: string;
  turnId: string;
}

export interface WorkshopRequestTurnPreviewMessage
  extends MessageEnvelope<WorkshopRequestTurnPreviewPayload> {
  type: MessageType.WORKSHOP_REQUEST_TURN_PREVIEW;
}

/**
 * One turn as the preview shows it: exactly what the transcript projection
 * (`projectWorkshopTranscriptTurn`) gives export and recall, so no
 * host-private body (attachment text, widget payloads, capability evidence,
 * context details) is ever sent.
 */
export interface WorkshopTurnPreview {
  /** A writer message, a participant reply, or a one-line notice. */
  kind: 'writer' | 'reply' | 'event';
  /** Who wrote it, as the thread names them ("You" for the writer). */
  speaker: string;
  /** The projected Markdown body (a notice's one line). */
  content: string;
  /** Epoch ms of the turn. */
  timestamp: number;
  /** The instrument it went to or came from privately, when it bypassed the room. */
  privateWith?: string;
  /** A reply that stopped at the max-token limit. */
  truncated?: true;
}

export interface WorkshopTurnPreviewPayload {
  requestId: string;
  turnId: string;
  /** Absent when the host refused; then `error` says why, naming no content. */
  turn?: WorkshopTurnPreview;
  error?: string;
}

export interface WorkshopTurnPreviewMessage
  extends MessageEnvelope<WorkshopTurnPreviewPayload> {
  type: MessageType.WORKSHOP_TURN_PREVIEW;
}
