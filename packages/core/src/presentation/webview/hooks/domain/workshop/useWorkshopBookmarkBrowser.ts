/**
 * The Bookmarks screen's transport (ADR 2026-11-05 D8): whether it is open,
 * the open room's rows, saved sessions page by page, the search, and a
 * saved turn's preview.
 *
 * Correlation follows the turn preview's rule: every request carries an id
 * this hook mints (under a per-webview prefix), and only the pending
 * request's first answer is taken.
 * - **The open room's rows** are asked for the room on screen
 *   (`roomRevision`); an answer for another room is dropped.
 * - **Pages** are asked one at a time by the host's cursor. Closing the
 *   screen, or the room changing under it, cancels the page in flight (the
 *   host stops reading it) and drops any late answer; a changed room reads
 *   its rows and pages again from the start.
 * - **A saved turn's preview** is one request at a time, like the room's.
 *
 * Nothing is persisted: the sessions own their bookmarks, and the screen is
 * read again each time it opens.
 */

import * as React from 'react';
import {
  MessageType,
  WorkshopBookmarkBrowserRow,
  WorkshopBookmarkBrowserSession,
  WorkshopBookmarkPageMessage,
  WorkshopLiveBookmarksMessage,
  WorkshopSavedTurnPreviewMessage,
  WorkshopSessionStateMessage,
  WorkshopTurnPreview
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import type { WorkshopBookmarkBrowserCoverage } from '@hooks/domain/workshop/bookmarks/workshopBookmarkBrowserView';

export interface WorkshopBookmarkBrowserLive {
  status: 'idle' | 'loading' | 'ready' | 'error';
  rows: readonly WorkshopBookmarkBrowserRow[];
  error?: string;
}

export interface WorkshopBookmarkBrowserSaved {
  sessions: readonly WorkshopBookmarkBrowserSession[];
  unreadableSessions: ReadonlyArray<{ sessionId: string; title: string }>;
  coverage: WorkshopBookmarkBrowserCoverage;
  /** The cursor for the next page; undefined once every session was read. */
  next?: string;
  loading: boolean;
  error?: string;
}

export interface WorkshopSavedTurnPreviewState {
  requestId: string;
  sessionId: string;
  turnId: string;
  turn?: WorkshopTurnPreview;
  error?: string;
}

export interface WorkshopBookmarkBrowserState {
  browserOpen: boolean;
  live: WorkshopBookmarkBrowserLive;
  saved: WorkshopBookmarkBrowserSaved;
  query: string;
  savedTurnPreview: WorkshopSavedTurnPreviewState | null;
  /** The room on screen, from the latest snapshot. */
  roomRevision: number | undefined;
}

export interface WorkshopBookmarkBrowserActions {
  openBrowser: () => void;
  closeBrowser: () => void;
  setQuery: (query: string) => void;
  /** Ask for the next page, when one remains and none is in flight. */
  loadMore: () => void;
  /** Asks for one saved turn, read-only, and returns the request's id. */
  requestSavedTurnPreview: (sessionId: string, turnId: string) => string;
  clearSavedTurnPreview: () => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  handleBookmarkPage: (message: WorkshopBookmarkPageMessage) => void;
  handleLiveBookmarks: (message: WorkshopLiveBookmarksMessage) => void;
  handleSavedTurnPreview: (message: WorkshopSavedTurnPreviewMessage) => void;
}

export interface WorkshopBookmarkBrowserPersistence {
  // Sessions own their bookmarks; the screen reads them again each time it opens.
}

export type UseWorkshopBookmarkBrowserReturn = WorkshopBookmarkBrowserState &
  WorkshopBookmarkBrowserActions & {
    persistedState: WorkshopBookmarkBrowserPersistence;
  };

const SOURCE = 'webview.workshop.bookmarkBrowser';
const NO_ROWS: readonly WorkshopBookmarkBrowserRow[] = [];
const IDLE_LIVE: WorkshopBookmarkBrowserLive = { status: 'idle', rows: NO_ROWS };
const EMPTY_SAVED: WorkshopBookmarkBrowserSaved = {
  sessions: [],
  unreadableSessions: [],
  coverage: { read: 0, unreadable: 0, remaining: 0, started: false },
  loading: false
};

export function useWorkshopBookmarkBrowser(): UseWorkshopBookmarkBrowserReturn {
  const vscode = useVSCodeApi();
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [live, setLive] = React.useState<WorkshopBookmarkBrowserLive>(IDLE_LIVE);
  const [saved, setSaved] = React.useState<WorkshopBookmarkBrowserSaved>(EMPTY_SAVED);
  const [query, setQuery] = React.useState('');
  const [savedTurnPreview, setSavedTurnPreview] = React.useState<WorkshopSavedTurnPreviewState | null>(null);
  const [roomRevision, setRoomRevision] = React.useState<number | undefined>(undefined);
  const roomRevisionRef = React.useRef<number | undefined>(undefined);
  const openRef = React.useRef(false);
  const pendingLiveRef = React.useRef<string | undefined>(undefined);
  const pendingPageRef = React.useRef<string | undefined>(undefined);
  const pendingPreviewRef = React.useRef<string | undefined>(undefined);
  const ids = React.useRef({ prefix: `ws-bookmark-browser-${Math.random().toString(36).slice(2, 10)}`, count: 0 });
  const mintRequestId = React.useCallback((): string => {
    ids.current.count += 1;
    return `${ids.current.prefix}-${ids.current.count}`;
  }, []);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  /** Stop the page in flight, here and at the host. */
  const cancelPage = React.useCallback(() => {
    const pending = pendingPageRef.current;
    if (pending !== undefined) {
      pendingPageRef.current = undefined;
      post(MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE, { requestId: pending });
    }
  }, [post]);

  const requestPage = React.useCallback((after?: string) => {
    const requestId = mintRequestId();
    pendingPageRef.current = requestId;
    setSaved((current) => ({ ...current, loading: true, error: undefined }));
    post(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, {
      requestId,
      roomRevision: roomRevisionRef.current ?? -1,
      ...(after !== undefined ? { after } : {})
    });
  }, [mintRequestId, post]);

  /** Read the open room's rows and the first page, from nothing. */
  const readFromStart = React.useCallback(() => {
    cancelPage();
    const liveId = mintRequestId();
    pendingLiveRef.current = liveId;
    setLive({ status: 'loading', rows: NO_ROWS });
    setSaved(EMPTY_SAVED);
    post(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS, { requestId: liveId, roomRevision: roomRevisionRef.current ?? -1 });
    requestPage();
  }, [cancelPage, mintRequestId, post, requestPage]);

  const openBrowser = React.useCallback(() => {
    openRef.current = true;
    setBrowserOpen(true);
    setQuery('');
    readFromStart();
  }, [readFromStart]);

  const closeBrowser = React.useCallback(() => {
    openRef.current = false;
    setBrowserOpen(false);
    cancelPage();
    pendingLiveRef.current = undefined;
  }, [cancelPage]);

  const loadMore = React.useCallback(() => {
    if (pendingPageRef.current !== undefined || saved.next === undefined) {
      return;
    }
    requestPage(saved.next);
  }, [requestPage, saved.next]);

  const requestSavedTurnPreview = React.useCallback((sessionId: string, turnId: string): string => {
    const requestId = mintRequestId();
    pendingPreviewRef.current = requestId;
    setSavedTurnPreview({ requestId, sessionId, turnId });
    post(MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW, { requestId, sessionId, turnId });
    return requestId;
  }, [mintRequestId, post]);

  const clearSavedTurnPreview = React.useCallback(() => {
    pendingPreviewRef.current = undefined;
    setSavedTurnPreview(null);
  }, []);

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    const next = message.payload.session.roomRevision;
    const previous = roomRevisionRef.current;
    roomRevisionRef.current = next;
    setRoomRevision(next);
    // Another room under an open screen: what it showed belongs to the old one.
    if (openRef.current && previous !== undefined && previous !== next) {
      readFromStart();
    }
  }, [readFromStart]);

  const handleBookmarkPage = React.useCallback((message: WorkshopBookmarkPageMessage) => {
    const { requestId, page, error } = message.payload;
    if (requestId !== pendingPageRef.current) {
      return;
    }
    pendingPageRef.current = undefined;
    if (!page) {
      setSaved((current) => ({ ...current, loading: false, error: error ?? 'The saved sessions couldn’t be read just now.' }));
      return;
    }
    setSaved((current) => ({
      sessions: [...current.sessions, ...page.sessions],
      unreadableSessions: [...current.unreadableSessions, ...page.unreadableSessions],
      coverage: {
        read: current.coverage.read + page.read,
        unreadable: current.coverage.unreadable + page.unreadable,
        remaining: page.remaining,
        started: true
      },
      ...(page.next !== undefined ? { next: page.next } : {}),
      loading: false
    }));
  }, []);

  const handleLiveBookmarks = React.useCallback((message: WorkshopLiveBookmarksMessage) => {
    const { requestId, roomRevision: answered, bookmarks, error } = message.payload;
    if (requestId !== pendingLiveRef.current || answered !== roomRevisionRef.current) {
      return;
    }
    pendingLiveRef.current = undefined;
    setLive(bookmarks
      ? { status: 'ready', rows: bookmarks }
      : { status: 'error', rows: NO_ROWS, error: error ?? 'This room’s bookmarks couldn’t be read.' });
  }, []);

  const handleSavedTurnPreview = React.useCallback((message: WorkshopSavedTurnPreviewMessage) => {
    const { requestId, sessionId, turnId, turn, error } = message.payload;
    if (requestId !== pendingPreviewRef.current) {
      return;
    }
    pendingPreviewRef.current = undefined;
    setSavedTurnPreview((current) => current !== null && current.requestId === requestId
      && current.sessionId === sessionId && current.turnId === turnId
      ? { ...current, ...(turn ? { turn } : { error: error ?? 'That message could not be shown.' }) }
      : current);
  }, []);

  return {
    browserOpen,
    live,
    saved,
    query,
    savedTurnPreview,
    roomRevision,
    openBrowser,
    closeBrowser,
    setQuery,
    loadMore,
    requestSavedTurnPreview,
    clearSavedTurnPreview,
    handleSessionState,
    handleBookmarkPage,
    handleLiveBookmarks,
    handleSavedTurnPreview,
    persistedState: {}
  };
}
