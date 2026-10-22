/** @jest-environment jsdom */

/**
 * useLightboxBoards (Slice 5A): the rail asks for the shelf of the board on
 * screen on mount (naming no board when it has none, which lets the host
 * restore one) and on each new board; it takes only the pending request's
 * answer, and a pushed save only for the board on screen; it never takes an
 * earlier adoption's shelf over a later one's for the same board (PR #163
 * F-02), nor, within one adoption, a shelf observed before the one held
 * (PR #163 F-05); a Delete makes the held shelf ask again (PR #163 N-01); Open and
 * Delete name the host's file id; nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import { LightboxBoard, LightboxBoardShelf, LightboxBoardsMessage, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useLightboxBoards } from '@hooks/domain/useLightboxBoards';

const FILE = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';
const shelfOf = (count: number): LightboxBoardShelf => ({
  availability: { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false },
  boards: Array.from({ length: count }, (_, index) => ({
    fileId: `drafts-alice-1-md-9b099095/2026-10-22T14-0${5 + index}-09-123Z.board.json`,
    savedAt: 1_792_677_909_123 + index * 60_000,
    wordCount: 508,
    lenses: [],
    staleLenses: [],
    onScreen: index === 0
  })),
  unreadable: 0
});

let observed = 0;
/**
 * The host's answer. `adoption` is the board's adoption generation (1 unless
 * a test says otherwise); `observation` is when the host began the shelf, the
 * next in order unless a test says otherwise.
 */
function reply(
  requestId: string | null,
  boardId: string | null,
  shelf: LightboxBoardShelf,
  adoption: number | null = 1,
  observation: number = ++observed
): LightboxBoardsMessage {
  return { type: MessageType.LIGHTBOX_BOARDS, source: 'extension.lightbox', payload: { requestId, boardId, adoption, observation, shelf }, timestamp: 1 };
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

  it('never takes an earlier adoption\'s shelf over a later one\'s for the same board: a late push keeps no stale notice (PR #163 F-02)', () => {
    const { result } = mount(makeBoard(6));
    const first = sent()[0].payload.requestId;
    // Adoption 5 is a saved snapshot opened from a file that has since changed; adoption 4 was the snapshot before it, same board id.
    const opened: LightboxBoardShelf = { ...shelfOf(2), snapshot: { fileId: FILE, savedAt: 1_792_677_909_123, file: 'changed', dropped: 0 } };
    const earlier: LightboxBoardShelf = {
      ...shelfOf(3), snapshot: { fileId: 'drafts-alice-1-md-9b099095/2026-10-22T14-06-09-123Z.board.json', savedAt: 1_792_677_969_123, file: 'same', dropped: 0 }
    };
    act(() => result.current.handleBoards(reply(first, 'board-6', opened, 5)));
    act(() => result.current.handleBoards(reply(null, 'board-6', earlier, 4)));
    expect(result.current.shelf).toEqual(opened);

    // Control, no change: a save pushed for the adoption on screen is taken.
    const saved: LightboxBoardShelf = { ...opened, boards: shelfOf(3).boards };
    act(() => result.current.handleBoards(reply(null, 'board-6', saved, 5)));
    expect(result.current.shelf).toEqual(saved);
    // Control, a later adoption of the board: taken.
    act(() => result.current.handleBoards(reply(null, 'board-6', earlier, 6)));
    expect(result.current.shelf).toEqual(earlier);
    // Control, another board: not taken, whatever its adoption.
    act(() => result.current.handleBoards(reply(null, 'board-9', opened, 9)));
    expect(result.current.shelf).toEqual(earlier);
  });

  describe('within one adoption (PR #163 F-05)', () => {
    const snapshot = { fileId: FILE, savedAt: 1_792_677_909_123, dropped: 0 };
    const changed: LightboxBoardShelf = { ...shelfOf(1), snapshot: { ...snapshot, file: 'changed' } };

    /** Board 6 at adoption 2: its shelf observed at 10, then a Delete whose answer, observed at 12, sees the file changed on disk. */
    function deletedAtTwelve() {
      const hook = mount(makeBoard(6));
      act(() => hook.result.current.handleBoards(reply(sent()[0].payload.requestId, 'board-6', { ...shelfOf(2), snapshot: { ...snapshot, file: 'same' } }, 2, 10)));
      act(() => hook.result.current.deleteBoard('drafts-alice-1-md-9b099095/2026-10-22T14-06-09-123Z.board.json'));
      act(() => hook.result.current.handleBoards(reply(sent()[1].payload.requestId, 'board-6', changed, 2, 12)));
      expect(hook.result.current.shelf).toEqual(changed);
      return hook;
    }

    it('never takes a shelf observed before the one held: a save\'s late push keeps no stale "same"', () => {
      const { result } = deletedAtTwelve();
      // A save's push the host observed at 11, before the Delete's answer, lands late at the same adoption.
      act(() => result.current.handleBoards(reply(null, 'board-6', { ...shelfOf(2), snapshot: { ...snapshot, file: 'same' } }, 2, 11)));
      expect(result.current.shelf).toEqual(changed);
    });

    it('control: a newer save at the same adoption is taken', () => {
      const { result } = deletedAtTwelve();
      const newer: LightboxBoardShelf = { ...changed, boards: shelfOf(2).boards };
      act(() => result.current.handleBoards(reply(null, 'board-6', newer, 2, 13)));
      expect(result.current.shelf).toEqual(newer);
    });
  });

  it('asks again for a board whose held shelf a Delete made stale, when the writer comes back to it (PR #163 N-01)', () => {
    const { result, rerender } = mount(makeBoard(6));
    act(() => result.current.handleBoards(reply(sent()[0].payload.requestId, 'board-6', shelfOf(2))));
    act(() => result.current.deleteBoard(FILE));
    // To another board kept in the session, and back, before any answer lands.
    rerender({ board: makeBoard(7) });
    rerender({ board: makeBoard(6) });
    expect(sent().map((message) => [message.type, message.payload.boardId])).toEqual([
      [MessageType.LIGHTBOX_REQUEST_BOARDS, 'board-6'],
      [MessageType.LIGHTBOX_DELETE_BOARD, 'board-6'],
      [MessageType.LIGHTBOX_REQUEST_BOARDS, 'board-7'],
      [MessageType.LIGHTBOX_REQUEST_BOARDS, 'board-6']
    ]);
    const deleted = shelfOf(2).boards.filter((board) => board.fileId !== FILE);
    act(() => result.current.handleBoards(reply(sent()[1].payload.requestId, 'board-6', { ...shelfOf(2), boards: deleted })));
    act(() => result.current.handleBoards(reply(sent()[3].payload.requestId, 'board-6', { ...shelfOf(2), boards: deleted })));
    expect(result.current.shelf?.boards.map((board) => board.fileId)).toEqual(deleted.map((board) => board.fileId));
    expect(result.current.shelf?.boards.map((board) => board.fileId)).not.toContain(FILE);
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
