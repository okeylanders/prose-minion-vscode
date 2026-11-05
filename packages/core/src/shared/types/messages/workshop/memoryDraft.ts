/**
 * The helper's draft of a memory's title, summary and kind (ADR 2026-11-05
 * D5; Helper Agent Slice 2). When the memory sheet opens from a turn (Save
 * to memory… on a bubble, or Remember this on a bookmark), the webview asks
 * for a draft by the turn's ids alone: the host reads the turn itself and
 * never takes its text from the webview.
 */

import type { MessageEnvelope, MessageType } from '../base';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';

/**
 * A turn of the open room by its id (and, for a bookmark outside the
 * window, the room it was asked in), or a saved session's turn by session
 * and turn. The sheet's own request, by a webview-minted id.
 */
export interface WorkshopMemoryDraftRequestPayload {
  requestId: string;
  turnId: string;
  /** A saved session's turn (Remember this on a saved bookmark); absent, a turn of the open room. */
  sessionId?: string;
  /** A turn of the open room outside the window: the room the sheet was opened in. */
  roomRevision?: number;
}

export interface WorkshopMemoryDraftRequestMessage extends MessageEnvelope<WorkshopMemoryDraftRequestPayload> {
  type: MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST;
}

/** The helper's fields, each within the memory's bounds. */
export interface WorkshopMemoryHelperDraft {
  title: string;
  summary: string;
  kind: ProjectMemoryKind;
}

/**
 * How the request ended. Every outcome but `drafted` leaves the sheet as
 * it is, with one quiet line:
 * - `off`: `proseMinion.workshop.memory.helperDrafts` is off; nothing was sent;
 * - `unconfigured`: no API key; nothing was sent;
 * - `refused`: the host would not read the turn (gone, not a message, another room);
 * - `failed`: the call errored, timed out or was stopped;
 * - `malformed`: the answer was dropped for a fault of its own.
 */
export type WorkshopMemoryDraftOutcome = 'drafted' | 'off' | 'unconfigured' | 'refused' | 'failed' | 'malformed';

export interface WorkshopMemoryDraftResultPayload {
  requestId: string;
  outcome: WorkshopMemoryDraftOutcome;
  /** Present exactly when `outcome` is `drafted`. */
  draft?: WorkshopMemoryHelperDraft;
}

export interface WorkshopMemoryDraftResultMessage extends MessageEnvelope<WorkshopMemoryDraftResultPayload> {
  type: MessageType.WORKSHOP_MEMORY_DRAFT_RESULT;
}
