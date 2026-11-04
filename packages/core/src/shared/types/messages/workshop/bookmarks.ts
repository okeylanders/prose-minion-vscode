/**
 * Workshop bookmarks (ADR 2026-11-03 D5, D6, D9, D10).
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
export const WORKSHOP_BOOKMARK_LABEL_MAX_LENGTH = 80;

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
