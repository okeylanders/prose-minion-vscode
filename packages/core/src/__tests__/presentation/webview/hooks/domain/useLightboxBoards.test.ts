/** @jest-environment jsdom */

/**
 * useLightboxBoards (Slice 5A): the rail asks for the shelf of the board on
 * screen on mount (naming no board when it has none, which lets the host
 * restore one) and on each new board; it takes only the pending request's
 * answer, and a pushed save only for the board on screen; Open and Delete
 * name the host's file id; nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import { LightboxBoard, LightboxBoardShelf, LightboxBoardsMessage, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useLightboxBoards } from '@hooks/domain/useLightboxBoards';

const FILE = 'drafts-alice-1-md/2026-10-22T14-05-09-123Z.board.json';
const shelfOf = (count: number): LightboxBoardShelf => ({
  availability: { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false },
  boards: Array.from({ length: count }, (_, index) => ({
    fileId: `drafts-alice-1-md/2026-10-22T14-0${5 + index}-09-123Z.board.json`,
    savedAt: 1_792_677_909_123 + index * 60_000,
    wordCount: 508,
    lenses: [],
    staleLenses: [],
    onScreen: index === 0
  })),
  unreadable: 0
});

function reply(requestId: string | null, boardId: string | null, shelf: LightboxBoardShelf): LightboxBoardsMessage {
  return { type: MessageType.LIGHTBOX_BOARDS, source: 'extension.lightbox', payload: { requestId, boardId, shelf }, timestamp: 1 };
}

describe('useLightboxBoards', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const sent = () => vscode.postMessage.mock.calls.map(([message]) => message);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  function mount(board: LightboxBoard | null) {
    return renderHook((props: { board: LightboxBoard | null }) => useLightboxBoards(props), { initialProps: { board } });
  }

  it('asks on a mount with no board, naming none, and not again when the answer\'s board arrives', () => {
    const { result, rerender } = mount(null);
    expect(sent()).toEqual([expect.objectContaining({
      type: MessageType.LIGHTBOX_REQUEST_BOARDS,
      source: 'webview.lightbox.boards',
      payload: { requestId: expect.stringMatching(/^lbx-brd-[a-z0-9]+-1$/), boardId: null }
    })]);
    const { requestId } = sent()[0].payload;

    // The host restored board-6 and answered for it; the board itself comes as LIGHTBOX_BOARD.
    act(() => result.current.handleBoards(reply(requestId, 'board-6', shelfOf(2))));
    expect(result.current.shelf).toBeNull();
    rerender({ board: makeBoard(6) });
    expect(result.current.shelf).toEqual(shelfOf(2));
    expect(sent()).toHaveLength(1);
    expect(result.current.persistedState).toEqual({});
  });

  it('asks again for a new board, and takes only the pending request\'s answer', () => {
    const { result, rerender } = mount(makeBoard(6));
    const first = sent()[0].payload.requestId;
    rerender({ board: makeBoard(7) });
    expect(sent().map((message) => message.payload.boardId)).toEqual(['board-6', 'board-7']);
    const second = sent()[1].payload.requestId;

    act(() => result.current.handleBoards(reply(first, 'board-6', shelfOf(1))));
    expect(result.current.shelf).toBeNull();
    act(() => result.current.handleBoards(reply('lbx-brd-other-1', 'board-7', shelfOf(1))));
    expect(result.current.shelf).toBeNull();
    act(() => result.current.handleBoards(reply(second, 'board-7', shelfOf(3))));
    expect(result.current.shelf).toEqual(shelfOf(3));
    // Taken once: a repeat changes nothing.
    act(() => result.current.handleBoards(reply(second, 'board-7', shelfOf(1))));
    expect(result.current.shelf).toEqual(shelfOf(3));
  });

  it('takes a pushed save only for the board on screen', () => {
    const { result } = mount(makeBoard(6));
    act(() => result.current.handleBoards(reply(null, 'board-9', shelfOf(4))));
    expect(result.current.shelf).toBeNull();
    act(() => result.current.handleBoards(reply(null, 'board-6', shelfOf(2))));
    expect(result.current.shelf).toEqual(shelfOf(2));
  });

  it('opens by the host\'s file id, says which until the answer, and deletes naming the board on screen', () => {
    const { result } = mount(makeBoard(6));
    act(() => result.current.openBoard(FILE));
    expect(result.current.opening).toBe(FILE);
    const open = sent()[1];
    expect(open).toEqual(expect.objectContaining({
      type: MessageType.LIGHTBOX_OPEN_BOARD,
      payload: { requestId: expect.stringMatching(/-2$/), fileId: FILE }
    }));
    act(() => result.current.handleBoards(reply(open.payload.requestId, 'board-6', { ...shelfOf(1), notice: 'A run is reading this board.' })));
    expect(result.current.opening).toBeNull();
    expect(result.current.shelf?.notice).toBe('A run is reading this board.');

    act(() => result.current.deleteBoard(FILE));
    expect(sent()[2]).toEqual(expect.objectContaining({
      type: MessageType.LIGHTBOX_DELETE_BOARD,
      payload: { requestId: expect.stringMatching(/-3$/), boardId: 'board-6', fileId: FILE }
    }));
  });
});
