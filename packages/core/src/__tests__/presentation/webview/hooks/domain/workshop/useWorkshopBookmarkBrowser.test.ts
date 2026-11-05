/** @jest-environment jsdom */

/**
 * useWorkshopBookmarkBrowser (ADR 2026-11-05 D8): opening reads the open
 * room's rows and the first page; pages accumulate by the host's cursor;
 * only the pending request's first answer is taken; closing, or the room
 * changing, cancels the page in flight and drops late answers; a saved
 * turn's preview is correlated the same way. Nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import {
  MessageType,
  WorkshopBookmarkBrowserRow,
  WorkshopBookmarkPage,
  WorkshopBookmarkPageMessage,
  WorkshopLiveBookmarksMessage,
  WorkshopSavedTurnPreviewMessage,
  WorkshopSessionStateMessage
} from '@messages';
import { useWorkshopBookmarkBrowser } from '@hooks/domain/workshop/useWorkshopBookmarkBrowser';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const snapshot = (roomRevision: number): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: { session: { bookmarks: [], roomRevision } }
} as unknown as WorkshopSessionStateMessage);

const row = (bookmarkId: string): WorkshopBookmarkBrowserRow => ({
  bookmarkId,
  turnId: `turn-${bookmarkId}`,
  label: `Alice ${bookmarkId}`,
  createdAt: 1,
  speaker: 'Jill'
});

const page = (requestId: string, body: Partial<WorkshopBookmarkPage> | undefined, error?: string): WorkshopBookmarkPageMessage => ({
  type: MessageType.WORKSHOP_BOOKMARK_PAGE,
  source: 'extension.workshop',
  payload: {
    requestId,
    roomRevision: 1,
    ...(body ? { page: { sessions: [], read: 0, unreadable: 0, unreadableSessions: [], ambiguous: 0, ambiguousSessionIds: [], remaining: 0, ...body } } : {}),
    ...(error ? { error } : {})
  },
  timestamp: 1
});

const liveAnswer = (requestId: string, roomRevision: number, bookmarks: WorkshopBookmarkBrowserRow[]): WorkshopLiveBookmarksMessage => ({
  type: MessageType.WORKSHOP_LIVE_BOOKMARKS,
  source: 'extension.workshop',
  payload: { requestId, roomRevision, bookmarks },
  timestamp: 1
});

describe('useWorkshopBookmarkBrowser', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const sent = (type: MessageType) => vscode.postMessage.mock.calls.map(([entry]) => entry).filter((entry) => entry.type === type);
  const lastPayload = (type: MessageType) => sent(type).at(-1).payload;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  const opened = () => {
    const hook = renderHook(() => useWorkshopBookmarkBrowser());
    act(() => hook.result.current.handleSessionState(snapshot(1)));
    act(() => hook.result.current.openBrowser());
    return hook;
  };

  it('opens by asking for the room\'s rows and the first page, for the room on screen', () => {
    const { result } = opened();
    expect(result.current.browserOpen).toBe(true);
    expect(lastPayload(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS)).toEqual({ requestId: expect.any(String), roomRevision: 1 });
    expect(lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE)).toEqual({ requestId: expect.any(String), roomRevision: 1 });
    expect(result.current.live.status).toBe('loading');
    expect(result.current.saved.loading).toBe(true);
    expect(result.current.persistedState).toEqual({});
  });

  it('accumulates pages by the host\'s cursor and counts what they cover', () => {
    const { result } = opened();
    const first = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE).requestId;
    act(() => result.current.handleBookmarkPage(page(first, {
      sessions: [{ sessionId: 's2', title: 'Tea party', savedAt: '', bookmarks: [row('b1')] }],
      read: 25, unreadable: 1, unreadableSessions: [{ sessionId: 'sx', title: 'Broken' }], remaining: 30, next: 'cursor-1'
    })));
    expect(result.current.saved).toMatchObject({ next: 'cursor-1', loading: false, coverage: { read: 25, unreadable: 1, ambiguous: 0, remaining: 30, started: true } });

    act(() => result.current.loadMore());
    const second = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE);
    expect(second).toMatchObject({ after: 'cursor-1', roomRevision: 1 });
    // One page at a time.
    act(() => result.current.loadMore());
    expect(sent(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE)).toHaveLength(2);
    act(() => result.current.handleBookmarkPage(page(second.requestId, {
      sessions: [{ sessionId: 's1', title: 'Garden', savedAt: '', bookmarks: [row('b1')] }], read: 30, remaining: 0
    })));
    expect(result.current.saved.sessions.map((session) => session.sessionId)).toEqual(['s2', 's1']);
    expect(result.current.saved.coverage).toEqual({ read: 55, unreadable: 1, ambiguous: 0, remaining: 0, started: true });
    expect(result.current.saved.next).toBeUndefined();
    expect(result.current.saved.unreadableSessions).toEqual([{ sessionId: 'sx', title: 'Broken' }]);
    expect(result.current.saved.ambiguousSessionIds.size).toBe(0);
  });

  it('takes only the pending request\'s first answer', () => {
    const { result } = opened();
    const pending = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE).requestId;
    act(() => result.current.handleBookmarkPage(page('someone-else', { read: 99 })));
    expect(result.current.saved.coverage.started).toBe(false);
    act(() => result.current.handleBookmarkPage(page(pending, { read: 1 })));
    act(() => result.current.handleBookmarkPage(page(pending, { read: 50 })));
    expect(result.current.saved.coverage.read).toBe(1);
  });

  it('drops the room\'s rows answered for another room', () => {
    const { result } = opened();
    const pending = lastPayload(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS).requestId;
    act(() => result.current.handleLiveBookmarks(liveAnswer(pending, 0, [row('stale')])));
    expect(result.current.live.status).toBe('loading');
    act(() => result.current.handleLiveBookmarks(liveAnswer(pending, 1, [row('b1')])));
    expect(result.current.live).toEqual({ status: 'ready', rows: [row('b1')] });
  });

  it('cancels the page in flight when it closes, and drops its late answer', () => {
    const { result } = opened();
    const pending = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE).requestId;
    act(() => result.current.closeBrowser());
    expect(lastPayload(MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE)).toEqual({ requestId: pending });
    act(() => result.current.handleBookmarkPage(page(pending, { read: 3 })));
    expect(result.current.browserOpen).toBe(false);
    expect(result.current.saved.coverage.started).toBe(false);
  });

  it('reads again from the start when the room changes under it, dropping the old room\'s answers', () => {
    const { result } = opened();
    const oldPage = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE).requestId;
    const oldLive = lastPayload(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS).requestId;
    act(() => result.current.handleSessionState(snapshot(2)));
    expect(lastPayload(MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE)).toEqual({ requestId: oldPage });
    expect(lastPayload(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS)).toMatchObject({ roomRevision: 2 });
    act(() => result.current.handleLiveBookmarks(liveAnswer(oldLive, 1, [row('stale')])));
    act(() => result.current.handleBookmarkPage(page(oldPage, { read: 7 })));
    expect(result.current.live.status).toBe('loading');
    expect(result.current.saved.coverage.started).toBe(false);
    // The same room again is no change.
    const count = sent(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS).length;
    act(() => result.current.handleSessionState(snapshot(2)));
    expect(sent(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS)).toHaveLength(count);
  });

  it('correlates a saved turn\'s preview by its request', () => {
    const { result } = opened();
    let first = '';
    act(() => { first = result.current.requestSavedTurnPreview('s1', 'turn-3'); });
    let second = '';
    act(() => { second = result.current.requestSavedTurnPreview('s1', 'turn-4'); });
    const answer = (requestId: string, turnId: string): WorkshopSavedTurnPreviewMessage => ({
      type: MessageType.WORKSHOP_SAVED_TURN_PREVIEW,
      source: 'extension.workshop',
      payload: { requestId, sessionId: 's1', turnId, turn: { kind: 'reply', speaker: 'Jill', content: turnId, timestamp: 1 } },
      timestamp: 1
    });
    act(() => result.current.handleSavedTurnPreview(answer(first, 'turn-3')));
    expect(result.current.savedTurnPreview).toEqual({ requestId: second, sessionId: 's1', turnId: 'turn-4' });
    act(() => result.current.handleSavedTurnPreview(answer(second, 'turn-4')));
    expect(result.current.savedTurnPreview?.turn?.content).toBe('turn-4');
    act(() => result.current.clearSavedTurnPreview());
    expect(result.current.savedTurnPreview).toBeNull();
  });

  it('accumulates ambiguous session ids across pages, so an earlier page\'s rows are marked too (PR #216 F-03)', () => {
    const { result } = opened();
    const first = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE).requestId;
    act(() => result.current.handleBookmarkPage(page(first, {
      sessions: [{ sessionId: 's2', title: 'Tea party', savedAt: '', bookmarks: [row('b1')] }], read: 1, remaining: 1, next: 'c1'
    })));
    act(() => result.current.loadMore());
    const second = lastPayload(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE).requestId;
    act(() => result.current.handleBookmarkPage(page(second, { ambiguous: 1, ambiguousSessionIds: ['s2'], remaining: 0 })));
    expect([...result.current.saved.ambiguousSessionIds]).toEqual(['s2']);
    expect(result.current.saved.coverage).toMatchObject({ read: 1, ambiguous: 1 });
  });
});
