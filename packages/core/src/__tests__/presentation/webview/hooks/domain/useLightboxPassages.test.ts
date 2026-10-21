/** @jest-environment jsdom */

/**
 * useLightboxPassages (Slice 4E): one request per pin, board and text, named
 * by a webview-minted id; only the pending request's answer, for the board
 * on screen, is taken; a new board for the same pin asks again and says the
 * text changed until it lands; nothing persists. Text from Lewis Carroll's
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */

import { act, renderHook } from '@testing-library/react';
import { LightboxBoard, LightboxPassage, LightboxPassageMessage, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useLightboxPassages } from '@hooks/domain/useLightboxPassages';

const PARAGRAPH: LightboxItemRef = { kind: 'paragraphs', from: 2, to: 2 };
const TEXT = (text: string): LightboxPassage => ({ kind: 'paragraphs', paragraphs: [{ index: 2, segments: [{ text }] }], moreParagraphs: 0 });

function reply(payload: Partial<LightboxPassageMessage['payload']>): LightboxPassageMessage {
  return { type: MessageType.LIGHTBOX_PASSAGE, source: 'extension.lightbox', payload: payload as LightboxPassageMessage['payload'], timestamp: 1 };
}

describe('useLightboxPassages', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const requests = () => vscode.postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === MessageType.LIGHTBOX_REQUEST_PASSAGE);

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  function mount(board: LightboxBoard, selected: LightboxItemRef | null) {
    return renderHook((props: { board: LightboxBoard; selected: LightboxItemRef | null }) => useLightboxPassages(props), {
      initialProps: { board, selected }
    });
  }

  it('asks once for the pin\'s passage, naming the board and its text, and again for nothing that changes only the readings', () => {
    const board = makeBoard(6);
    const { rerender, result } = mount(board, PARAGRAPH);
    expect(requests()).toHaveLength(1);
    expect(requests()[0]).toEqual(expect.objectContaining({
      source: 'webview.lightbox',
      payload: { requestId: expect.stringMatching(/^lbx-psg-[a-z0-9]+-1$/), boardId: 'board-6', contentHash: 'a'.repeat(64), item: { kind: 'paragraphs', from: 2, to: 2 } }
    }));
    rerender({ board: { ...board, readings: [...board.readings] }, selected: PARAGRAPH });
    expect(requests()).toHaveLength(1);
    expect(result.current.persistedState).toEqual({});
  });

  it('asks nothing for a pin without a passage', () => {
    mount(makeBoard(6), { kind: 'lane', lane: 'rhythm' });
    mount(makeBoard(6), null);
    expect(requests()).toEqual([]);
  });

  it('takes only the pending request\'s answer, for the board and text it named', () => {
    const board = makeBoard(6);
    const { result } = mount(board, PARAGRAPH);
    const { requestId } = requests()[0].payload;
    const named = { boardId: board.boardId, contentHash: board.source.contentHash };

    act(() => result.current.handlePassage(reply({ requestId: 'lbx-psg-other-1', ...named, passage: TEXT('Not this one.') })));
    act(() => result.current.handlePassage(reply({ requestId, boardId: 'board-x', contentHash: named.contentHash, passage: TEXT('Another board.') })));
    act(() => result.current.handlePassage(reply({ requestId, boardId: named.boardId, contentHash: 'f'.repeat(64), passage: TEXT('Other text.') })));
    expect(result.current.well?.status).toBe('loading');

    act(() => result.current.handlePassage(reply({ requestId, ...named, passage: TEXT('Alice was beginning to get very tired.') })));
    expect(result.current.well?.status).toBe('ready');
    expect(result.current.well?.passage).toEqual(TEXT('Alice was beginning to get very tired.'));
    // Taken once: a repeat of the same answer changes nothing.
    act(() => result.current.handlePassage(reply({ requestId, ...named, passage: TEXT('A repeat.') })));
    expect(result.current.well?.passage).toEqual(TEXT('Alice was beginning to get very tired.'));
  });

  it('says the text changed while a newer board answers for the same pin, and never takes the older board\'s late answer', () => {
    const older = makeBoard(6);
    const { result, rerender } = mount(older, PARAGRAPH);
    const first = requests()[0].payload;
    act(() => result.current.handlePassage(reply({ requestId: first.requestId, boardId: older.boardId, contentHash: older.source.contentHash, passage: TEXT('The old text.') })));
    expect(result.current.well?.status).toBe('ready');

    const newer: LightboxBoard = { ...older, boardId: 'board-6b', source: { ...older.source, contentHash: 'b'.repeat(64) } };
    rerender({ board: newer, selected: PARAGRAPH });
    expect(requests()).toHaveLength(2);
    const second = requests()[1].payload;
    expect(second).toEqual(expect.objectContaining({ boardId: 'board-6b', contentHash: 'b'.repeat(64) }));
    expect(second.requestId).not.toBe(first.requestId);
    expect(result.current.well).toEqual(expect.objectContaining({
      status: 'loading',
      note: 'The text changed since this was shown. Reading it again from the board as it stands…'
    }));
    expect(result.current.well?.passage).toBeUndefined();

    // The older board's answer, late, is not this board's.
    act(() => result.current.handlePassage(reply({ requestId: first.requestId, boardId: older.boardId, contentHash: older.source.contentHash, passage: TEXT('The old text.') })));
    expect(result.current.well?.passage).toBeUndefined();

    act(() => result.current.handlePassage(reply({ requestId: second.requestId, boardId: 'board-6b', contentHash: 'b'.repeat(64), passage: TEXT('The new text.') })));
    expect(result.current.well?.passage).toEqual(TEXT('The new text.'));
  });

  describe('going back to a pin whose answer it holds (PR #159 F-01)', () => {
    const OTHER: LightboxItemRef = { kind: 'paragraphs', from: 3, to: 3 };
    const answerOf = (board: LightboxBoard, index: number, text: string) => {
      const { requestId } = requests()[index].payload;
      return reply({ requestId, boardId: board.boardId, contentHash: board.source.contentHash, passage: TEXT(text) });
    };

    it('shows the held answer, asks nothing, and never takes the other pin\'s late answer', () => {
      const board = makeBoard(6);
      const { result, rerender } = mount(board, PARAGRAPH);
      act(() => result.current.handlePassage(answerOf(board, 0, 'Alice was beginning to get very tired.')));

      rerender({ board, selected: OTHER });
      expect(requests()).toHaveLength(2);
      rerender({ board, selected: PARAGRAPH });
      expect(requests()).toHaveLength(2);
      expect(result.current.well?.passage).toEqual(TEXT('Alice was beginning to get very tired.'));

      // ¶3's answer, late: ¶2 is still shown, and nothing waits.
      act(() => result.current.handlePassage(answerOf(board, 1, 'So she was considering in her own mind.')));
      expect(result.current.well?.status).toBe('ready');
      expect(result.current.well?.passage).toEqual(TEXT('Alice was beginning to get very tired.'));
      // Nor does a board message that changes only the readings ask again.
      rerender({ board: { ...board, readings: [...board.readings] }, selected: PARAGRAPH });
      expect(requests()).toHaveLength(2);
    });

    it('does the same for a board it holds the answer for, after a newer board asked', () => {
      const older = makeBoard(6);
      const newer: LightboxBoard = { ...older, boardId: 'board-6b', source: { ...older.source, contentHash: 'b'.repeat(64) } };
      const { result, rerender } = mount(older, PARAGRAPH);
      act(() => result.current.handlePassage(answerOf(older, 0, 'The old text.')));

      rerender({ board: newer, selected: PARAGRAPH });
      expect(requests()).toHaveLength(2);
      rerender({ board: older, selected: PARAGRAPH });
      expect(requests()).toHaveLength(2);
      expect(result.current.well?.passage).toEqual(TEXT('The old text.'));

      act(() => result.current.handlePassage(answerOf(newer, 1, 'The new text.')));
      expect(result.current.well?.status).toBe('ready');
      expect(result.current.well?.passage).toEqual(TEXT('The old text.'));
    });

    it('asks again, under a new id, for the pin it dropped, and takes only that answer', () => {
      const board = makeBoard(6);
      const { result, rerender } = mount(board, PARAGRAPH);
      act(() => result.current.handlePassage(answerOf(board, 0, 'Alice was beginning to get very tired.')));
      rerender({ board, selected: OTHER });
      rerender({ board, selected: PARAGRAPH });

      rerender({ board, selected: OTHER });
      expect(requests()).toHaveLength(3);
      expect(requests()[2].payload).toEqual(expect.objectContaining({ item: { kind: 'paragraphs', from: 3, to: 3 } }));
      expect(requests()[2].payload.requestId).not.toBe(requests()[1].payload.requestId);
      // The dropped request's answer is not this one's.
      act(() => result.current.handlePassage(answerOf(board, 1, 'The dropped answer.')));
      expect(result.current.well?.status).toBe('loading');
      act(() => result.current.handlePassage(answerOf(board, 2, 'So she was considering in her own mind.')));
      expect(result.current.well?.passage).toEqual(TEXT('So she was considering in her own mind.'));
    });
  });

  it('drops what it waited for when the pin goes, and asks again for a new pin', () => {
    const board = makeBoard(6);
    const { result, rerender } = mount(board, PARAGRAPH);
    const first = requests()[0].payload;
    rerender({ board, selected: null });
    act(() => result.current.handlePassage(reply({ requestId: first.requestId, boardId: board.boardId, contentHash: board.source.contentHash, passage: TEXT('Late.') })));
    expect(result.current.well).toBeNull();

    rerender({ board, selected: { kind: 'word', word: 'alice' } });
    expect(requests()).toHaveLength(2);
    expect(requests()[1].payload.item).toEqual({ kind: 'instances', term: { kind: 'word', word: 'alice' } });
  });
});
