/**
 * The Workshop bookmarks' transport (ADR 2026-11-03 D5, D6): the snapshot's
 * bookmark summaries, the set and rename requests, and the read-only turn
 * preview that opens a turn outside the snapshot's window.
 *
 * Bookmarks are host-owned: the summaries arrive with each session snapshot,
 * in thread order, and this hook keeps only the latest. A set or rename posts
 * and waits for the next snapshot; nothing is applied optimistically.
 *
 * The preview follows the Read in reader's correlation rule (PR #186 F-01):
 * one request is pending at a time, under an id this hook mints, and only the
 * first reply to that id is taken. A turn id names a turn, not a request, so
 * a late answer to an earlier opening never paints into a later one. Each
 * request names the room it was made in (the snapshot's `roomRevision`): the
 * host answers only from that room, and a reply is dropped once the room on
 * screen is another (PR #189 F-02).
 *
 * A rename names its request too, and the host answers it, accepted or
 * refused; `renameOutcome` holds the answer to the pending one, so the field
 * keeps the writer's draft until the host has kept the name (PR #189 F-01).
 *
 * Nothing here is persisted: the session file owns bookmarks, and a preview
 * is read again each time it opens.
 */

import * as React from 'react';
import {
  MessageType,
  WorkshopBookmarkSummary,
  WorkshopRenameBookmarkResultMessage,
  WorkshopRenameBookmarkResultPayload,
  WorkshopSessionStateMessage,
  WorkshopTurnPreview,
  WorkshopTurnPreviewMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopTurnPreviewState {
  /** The request this state belongs to. */
  requestId: string;
  turnId: string;
  /** The room the request was made in. */
  roomRevision: number;
  /** Undefined until the host answers, or when it refused. */
  turn?: WorkshopTurnPreview;
  error?: string;
}

export interface WorkshopBookmarksState {
  /** The snapshot's summaries, in thread order. */
  bookmarks: readonly WorkshopBookmarkSummary[];
  /** Turn ids that carry a bookmark, for the thread's toggles. */
  bookmarkedTurnIds: ReadonlySet<string>;
  turnPreview: WorkshopTurnPreviewState | null;
  /** The host's answer to the pending rename, once it has answered. */
  renameOutcome: WorkshopRenameBookmarkResultPayload | null;
}

export interface WorkshopBookmarksActions {
  setTurnBookmark: (turnId: string, bookmarked: boolean) => void;
  /**
   * `null` restores the default label; the caller checks the label first.
   * Returns the request's id, which `renameOutcome` will answer.
   */
  renameBookmark: (bookmarkId: string, label: string | null) => string;
  /** Asks for one turn, read-only, and returns the request's id. */
  requestTurnPreview: (turnId: string) => string;
  clearTurnPreview: () => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  handleTurnPreview: (message: WorkshopTurnPreviewMessage) => void;
  handleRenameResult: (message: WorkshopRenameBookmarkResultMessage) => void;
}

export interface WorkshopBookmarksPersistence {
  // The session file owns bookmarks; nothing is kept in webview state.
}

export type UseWorkshopBookmarksReturn = WorkshopBookmarksState &
  WorkshopBookmarksActions & {
    persistedState: WorkshopBookmarksPersistence;
  };

export interface UseWorkshopBookmarksOptions {
  /**
   * Runs before a set or rename posts, so a refusal the host reports next is
   * the only error on screen (as a to-do action clears the room's error).
   */
  onBeforeChange?: () => void;
}

const SOURCE = 'webview.workshop.bookmarks';
const NO_BOOKMARKS: readonly WorkshopBookmarkSummary[] = [];

export function useWorkshopBookmarks({
  onBeforeChange
}: UseWorkshopBookmarksOptions = {}): UseWorkshopBookmarksReturn {
  const vscode = useVSCodeApi();
  const [bookmarks, setBookmarks] = React.useState<readonly WorkshopBookmarkSummary[]>(NO_BOOKMARKS);
  const [turnPreview, setTurnPreview] = React.useState<WorkshopTurnPreviewState | null>(null);
  const [renameOutcome, setRenameOutcome] = React.useState<WorkshopRenameBookmarkResultPayload | null>(null);
  // The room on screen, from the latest snapshot, and the rename awaiting its answer.
  const roomRevisionRef = React.useRef<number | undefined>(undefined);
  const pendingRenameRef = React.useRef<string | undefined>(undefined);
  // This webview's prefix, so a reloaded webview never takes an answer meant
  // for the one before it.
  const ids = React.useRef({ prefix: `ws-bookmarks-${Math.random().toString(36).slice(2, 10)}`, count: 0 });
  const mintRequestId = React.useCallback((): string => {
    ids.current.count += 1;
    return `${ids.current.prefix}-${ids.current.count}`;
  }, []);
  const beforeChangeRef = React.useRef(onBeforeChange);
  beforeChangeRef.current = onBeforeChange;

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const setTurnBookmark = React.useCallback((turnId: string, bookmarked: boolean) => {
    beforeChangeRef.current?.();
    post(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId, bookmarked });
  }, [post]);

  const renameBookmark = React.useCallback((bookmarkId: string, label: string | null): string => {
    beforeChangeRef.current?.();
    const requestId = mintRequestId();
    pendingRenameRef.current = requestId;
    setRenameOutcome(null);
    post(MessageType.WORKSHOP_RENAME_BOOKMARK, { requestId, bookmarkId, label });
    return requestId;
  }, [mintRequestId, post]);

  const requestTurnPreview = React.useCallback((turnId: string): string => {
    const requestId = mintRequestId();
    // Before the first snapshot there is no room to name; the host refuses -1.
    const roomRevision = roomRevisionRef.current ?? -1;
    setTurnPreview({ requestId, turnId, roomRevision });
    post(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW, { requestId, turnId, roomRevision });
    return requestId;
  }, [mintRequestId, post]);

  const clearTurnPreview = React.useCallback(() => setTurnPreview(null), []);

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    const { session } = message.payload;
    roomRevisionRef.current = session.roomRevision;
    setBookmarks(session.bookmarks ?? NO_BOOKMARKS);
  }, []);

  const handleTurnPreview = React.useCallback((message: WorkshopTurnPreviewMessage) => {
    const { requestId, turnId, roomRevision, turn, error } = message.payload;
    setTurnPreview((current) =>
      current !== null
        && current.requestId === requestId
        && current.turnId === turnId
        // A reply from another room, or for a room no longer on screen, is dropped.
        && current.roomRevision === roomRevision
        && current.roomRevision === roomRevisionRef.current
        && current.turn === undefined
        && current.error === undefined
        ? {
            ...current,
            ...(turn ? { turn } : {}),
            ...(turn ? {} : { error: error ?? 'That message could not be shown.' })
          }
        : current
    );
  }, []);

  const handleRenameResult = React.useCallback((message: WorkshopRenameBookmarkResultMessage) => {
    if (message.payload.requestId !== pendingRenameRef.current) {
      return;
    }
    pendingRenameRef.current = undefined;
    setRenameOutcome(message.payload);
  }, []);

  const bookmarkedTurnIds = React.useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.turnId)),
    [bookmarks]
  );

  return {
    bookmarks,
    bookmarkedTurnIds,
    turnPreview,
    renameOutcome,
    setTurnBookmark,
    renameBookmark,
    requestTurnPreview,
    clearTurnPreview,
    handleSessionState,
    handleTurnPreview,
    handleRenameResult,
    persistedState: {}
  };
}
