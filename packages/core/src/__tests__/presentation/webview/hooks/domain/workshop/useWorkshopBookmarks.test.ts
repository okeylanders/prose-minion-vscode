/** @jest-environment jsdom */

/**
 * useWorkshopBookmarks (ADR 2026-11-03 D5, D6): the snapshot's summaries are
 * the only truth the hook keeps; set and rename post and wait for the next
 * snapshot; the turn preview takes only the first reply to the request it is
 * waiting on, so a late answer to an earlier opening never fills a later one.
 * Nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopBookmarks } from '@hooks/domain/workshop/useWorkshopBookmarks';
import {
  MessageType,
  WorkshopBookmarkSummary,
  WorkshopSessionStateMessage,
  WorkshopTurnPreviewMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const summary = (id: string, turnId: string, inWindow = true): WorkshopBookmarkSummary => ({
  id,
  turnId,
  label: `Alice · ${turnId}`,
  participant: 'host',
  personaId: 'jill',
  inWindow
});

const snapshot = (bookmarks: WorkshopBookmarkSummary[]): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: { session: { bookmarks } }
} as unknown as WorkshopSessionStateMessage);

const preview = (payload: WorkshopTurnPreviewMessage['payload']): WorkshopTurnPreviewMessage => ({
  type: MessageType.WORKSHOP_TURN_PREVIEW,
  source: 'extension.workshop',
  payload,
  timestamp: 2
});

const turn = (content: string) => ({ kind: 'reply' as const, speaker: 'Jill', content, timestamp: 1 });

describe('useWorkshopBookmarks', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; source: string; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('keeps the latest snapshot summaries in order, with the turns they mark', () => {
    const { result } = renderHook(() => useWorkshopBookmarks());
    expect(result.current.bookmarks).toEqual([]);

    act(() => result.current.handleSessionState(snapshot([summary('bookmark-1-1', 'turn-2'), summary('bookmark-2-1', 'turn-5')])));
    expect(result.current.bookmarks.map((bookmark) => bookmark.id)).toEqual(['bookmark-1-1', 'bookmark-2-1']);
    expect([...result.current.bookmarkedTurnIds]).toEqual(['turn-2', 'turn-5']);

    act(() => result.current.handleSessionState(snapshot([])));
    expect(result.current.bookmarks).toEqual([]);
    expect(result.current.bookmarkedTurnIds.size).toBe(0);
  });

  it('posts a set and a rename as asked, clearing the room error first, and changes nothing locally', () => {
    const onBeforeChange = jest.fn();
    const { result } = renderHook(() => useWorkshopBookmarks({ onBeforeChange }));

    act(() => result.current.setTurnBookmark('turn-2', true));
    act(() => result.current.renameBookmark('bookmark-1-1', null));
    act(() => result.current.renameBookmark('bookmark-1-1', 'The lantern beat'));

    expect(posted(MessageType.WORKSHOP_SET_TURN_BOOKMARK).map((message) => message.payload))
      .toEqual([{ turnId: 'turn-2', bookmarked: true }]);
    expect(posted(MessageType.WORKSHOP_RENAME_BOOKMARK).map((message) => message.payload)).toEqual([
      { bookmarkId: 'bookmark-1-1', label: null },
      { bookmarkId: 'bookmark-1-1', label: 'The lantern beat' }
    ]);
    expect(onBeforeChange).toHaveBeenCalledTimes(3);
    expect(result.current.bookmarks).toEqual([]);
  });

  it('asks for a preview under a fresh request id and takes its first reply only', () => {
    const { result } = renderHook(() => useWorkshopBookmarks());
    let requestId = '';
    act(() => { requestId = result.current.requestTurnPreview('turn-2'); });

    const [request] = posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW);
    expect(request.payload).toEqual({ requestId, turnId: 'turn-2' });
    expect(result.current.turnPreview).toEqual({ requestId, turnId: 'turn-2' });

    act(() => result.current.handleTurnPreview(preview({ requestId, turnId: 'turn-2', turn: turn('First') })));
    act(() => result.current.handleTurnPreview(preview({ requestId, turnId: 'turn-2', turn: turn('Second') })));

    expect(result.current.turnPreview?.turn?.content).toBe('First');
  });

  it('never lets an earlier opening of the same turn fill a later one', () => {
    const { result } = renderHook(() => useWorkshopBookmarks());
    let first = '';
    let second = '';
    act(() => { first = result.current.requestTurnPreview('turn-2'); });
    act(() => result.current.clearTurnPreview());
    act(() => { second = result.current.requestTurnPreview('turn-2'); });
    expect(second).not.toBe(first);

    act(() => result.current.handleTurnPreview(preview({ requestId: first, turnId: 'turn-2', turn: turn('Late') })));
    expect(result.current.turnPreview).toEqual({ requestId: second, turnId: 'turn-2' });

    act(() => result.current.handleTurnPreview(preview({ requestId: second, turnId: 'turn-2', turn: turn('Current') })));
    expect(result.current.turnPreview?.turn?.content).toBe('Current');
  });

  it('ignores replies once cleared, and a reply naming another turn under the same id', () => {
    const { result } = renderHook(() => useWorkshopBookmarks());
    let requestId = '';
    act(() => { requestId = result.current.requestTurnPreview('turn-2'); });

    act(() => result.current.handleTurnPreview(preview({ requestId, turnId: 'turn-9', turn: turn('Wrong') })));
    expect(result.current.turnPreview?.turn).toBeUndefined();

    act(() => result.current.clearTurnPreview());
    act(() => result.current.handleTurnPreview(preview({ requestId, turnId: 'turn-2', turn: turn('Late') })));
    expect(result.current.turnPreview).toBeNull();
  });

  it('keeps a refusal as the reply, with a fallback when the host gave no reason', () => {
    const { result } = renderHook(() => useWorkshopBookmarks());
    let requestId = '';
    act(() => { requestId = result.current.requestTurnPreview('turn-2'); });
    act(() => result.current.handleTurnPreview(preview({
      requestId,
      turnId: 'turn-2',
      error: 'That message is no longer in this session.'
    })));
    expect(result.current.turnPreview).toEqual({
      requestId,
      turnId: 'turn-2',
      error: 'That message is no longer in this session.'
    });

    act(() => { requestId = result.current.requestTurnPreview('turn-3'); });
    act(() => result.current.handleTurnPreview(preview({ requestId, turnId: 'turn-3' })));
    expect(result.current.turnPreview?.error).toBe('That message could not be shown.');
  });

  it('persists nothing', () => {
    const { result } = renderHook(() => useWorkshopBookmarks());
    expect(result.current.persistedState).toEqual({});
  });
});
