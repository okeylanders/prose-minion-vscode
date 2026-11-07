/**
 * The Bookmarks screen (ADR 2026-11-05 D8): a read-only browser of every
 * bookmark, the open room's and every saved session's. The writer's own
 * view: nothing here reaches a persona, a room frame or provider history.
 *
 * Every request carries a webview-minted `requestId` the host echoes, and
 * the webview takes only the pending request's first answer.
 * - **Saved sessions** come a page at a time (PR #214 F-02), by an opaque
 *   cursor the host returns; each page says how many sessions it read, could
 *   not read, and has yet to read.
 * - **The open room's rows** come from the host's full ledger, never the
 *   snapshot's window (PR #214 F-03), and only for the room the request
 *   names (`roomRevision`).
 * - **A saved turn's preview** is the turn as the transcript projects it,
 *   the same `WorkshopTurnPreview` the room's preview sends.
 *
 * Labels and messages are writer text: shown, never logged.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { WorkshopTurnPreview } from './bookmarks';

/** One bookmark as the screen shows it. */
export interface WorkshopBookmarkBrowserRow {
  bookmarkId: string;
  turnId: string;
  /** The writer's label, or the default the thread shows. */
  label: string;
  /** Epoch ms when the writer set the bookmark (not the turn's own time). */
  createdAt: number;
  /** Who said the turn, as the thread names them. */
  speaker: string;
  /** The identity its color comes from (a persona id, or `tool:{toolId}`); absent for the writer. */
  identity?: string;
  /** The message as the turn preview shows it; absent when the thread shows nothing of it. */
  message?: WorkshopTurnPreview;
  /**
   * Its turn is one a bookmark may mark, by the host's rule
   * (`isWorkshopBookmarkableTurn`): "Remember this" is offered only on such
   * a row, so the screen offers what the host saves (PR #219 F-01).
   */
  rememberable?: true;
}

/** A saved session's bookmarks, as one page carries them. */
export interface WorkshopBookmarkBrowserSession {
  sessionId: string;
  title: string;
  /** ISO time it was last saved. */
  savedAt: string;
  /** Thread order. */
  bookmarks: WorkshopBookmarkBrowserRow[];
}

/** Ask for one page of saved sessions' bookmarks. */
export interface WorkshopRequestBookmarkPagePayload {
  requestId: string;
  /** The room on screen: the host answers only while it is still the room. */
  roomRevision: number;
  /** The previous page's `next`; absent for the first page. */
  after?: string;
}

export interface WorkshopRequestBookmarkPageMessage
  extends MessageEnvelope<WorkshopRequestBookmarkPagePayload> {
  type: MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE;
}

/** Stop the page being read (the screen closed, or the room changed). */
export interface WorkshopCancelBookmarkPagePayload {
  requestId: string;
}

export interface WorkshopCancelBookmarkPageMessage
  extends MessageEnvelope<WorkshopCancelBookmarkPagePayload> {
  type: MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE;
}

export interface WorkshopBookmarkPage {
  /** Sessions this page read that hold bookmarks, newest file first. */
  sessions: WorkshopBookmarkBrowserSession[];
  /** Saved sessions this page read. */
  read: number;
  /** Session files this page could not read. */
  unreadable: number;
  /** Those of them it can name. Some could not even show their session id, so a duplicate among them is unknown. */
  unreadableSessions: Array<{ sessionId: string; title: string }>;
  /** Session files this page did not read because another file of the walk claims the same id (PR #216 F-01). */
  ambiguous: number;
  /** Those ids: every row of each, on this page or an earlier one, is one the screen won't open. */
  ambiguousSessionIds: string[];
  /** Session files not read yet. */
  remaining: number;
  /** Pass as `after` for the next page; absent once every session was read. */
  next?: string;
}

export interface WorkshopBookmarkPagePayload {
  requestId: string;
  roomRevision: number;
  /** Absent when the host refused; then `error` says why, naming no content. */
  page?: WorkshopBookmarkPage;
  error?: string;
}

export interface WorkshopBookmarkPageMessage extends MessageEnvelope<WorkshopBookmarkPagePayload> {
  type: MessageType.WORKSHOP_BOOKMARK_PAGE;
}

/** Ask for the open room's bookmarks, read from its full ledger. */
export interface WorkshopRequestLiveBookmarksPayload {
  requestId: string;
  roomRevision: number;
}

export interface WorkshopRequestLiveBookmarksMessage
  extends MessageEnvelope<WorkshopRequestLiveBookmarksPayload> {
  type: MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS;
}

export interface WorkshopLiveBookmarksPayload {
  requestId: string;
  roomRevision: number;
  /** Thread order; absent when the host refused. */
  bookmarks?: WorkshopBookmarkBrowserRow[];
  error?: string;
}

export interface WorkshopLiveBookmarksMessage extends MessageEnvelope<WorkshopLiveBookmarksPayload> {
  type: MessageType.WORKSHOP_LIVE_BOOKMARKS;
}

/** Ask for one saved session's turn, read-only, for the preview sheet. */
export interface WorkshopRequestSavedTurnPreviewPayload {
  requestId: string;
  sessionId: string;
  turnId: string;
}

export interface WorkshopRequestSavedTurnPreviewMessage
  extends MessageEnvelope<WorkshopRequestSavedTurnPreviewPayload> {
  type: MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW;
}

export interface WorkshopSavedTurnPreviewPayload {
  requestId: string;
  sessionId: string;
  turnId: string;
  /** Absent when the host refused; then `error` says why, naming no content. */
  turn?: WorkshopTurnPreview;
  error?: string;
}

export interface WorkshopSavedTurnPreviewMessage
  extends MessageEnvelope<WorkshopSavedTurnPreviewPayload> {
  type: MessageType.WORKSHOP_SAVED_TURN_PREVIEW;
}
