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
 * a late answer to an earlier opening never paints into a later one.
 *
 * Nothing here is persisted: the session file owns bookmarks, and a preview
 * is read again each time it opens.
 */

import * as React from 'react';
import {
  MessageType,
  WorkshopBookmarkSummary,
  WorkshopSessionStateMessage,
  WorkshopTurnPreview,
  WorkshopTurnPreviewMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopTurnPreviewState {
  /** The request this state belongs to. */
  requestId: string;
  turnId: string;
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
}

export interface WorkshopBookmarksActions {
  setTurnBookmark: (turnId: string, bookmarked: boolean) => void;
  /** `null` restores the default label; the caller checks the label first. */
  renameBookmark: (bookmarkId: string, label: string | null) => void;
  /** Asks for one turn, read-only, and returns the request's id. */
  requestTurnPreview: (turnId: string) => string;
  clearTurnPreview: () => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  handleTurnPreview: (message: WorkshopTurnPreviewMessage) => void;
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
  // This webview's prefix, so a reloaded webview never takes an answer meant
  // for the one before it.
  const ids = React.useRef({ prefix: `ws-preview-${Math.random().toString(36).slice(2, 10)}`, count: 0 });
  const beforeChangeRef = React.useRef(onBeforeChange);
  beforeChangeRef.current = onBeforeChange;

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const setTurnBookmark = React.useCallback((turnId: string, bookmarked: boolean) => {
    beforeChangeRef.current?.();
    post(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId, bookmarked });
  }, [post]);

  const renameBookmark = React.useCallback((bookmarkId: string, label: string | null) => {
    beforeChangeRef.current?.();
    post(MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId, label });
  }, [post]);

  const requestTurnPreview = React.useCallback((turnId: string): string => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    setTurnPreview({ requestId, turnId });
    post(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW, { requestId, turnId });
    return requestId;
  }, [post]);

  const clearTurnPreview = React.useCallback(() => setTurnPreview(null), []);

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    setBookmarks(message.payload.session.bookmarks ?? NO_BOOKMARKS);
  }, []);

  const handleTurnPreview = React.useCallback((message: WorkshopTurnPreviewMessage) => {
    const { requestId, turnId, turn, error } = message.payload;
    setTurnPreview((current) =>
      current !== null
        && current.requestId === requestId
        && current.turnId === turnId
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

  const bookmarkedTurnIds = React.useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.turnId)),
    [bookmarks]
  );

  return {
    bookmarks,
    bookmarkedTurnIds,
    turnPreview,
    setTurnBookmark,
    renameBookmark,
    requestTurnPreview,
    clearTurnPreview,
    handleSessionState,
    handleTurnPreview,
    persistedState: {}
  };
}
