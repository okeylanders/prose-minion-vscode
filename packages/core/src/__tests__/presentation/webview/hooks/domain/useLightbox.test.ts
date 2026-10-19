/** @jest-environment jsdom */

/**
 * useLightbox (ADR 2026-10-19 D10, D12): the domain hook owns the Lightbox
 * transport and persists UI preferences only, never the board.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useLightbox } from '@hooks/domain/useLightbox';

const envelope = <T,>(type: MessageType, payload: T) => ({
  type,
  source: 'extension.lightbox' as const,
  payload,
  timestamp: 1
});

describe('useLightbox', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('asks the host for the latest board on mount, as webview.lightbox', () => {
    renderHook(() => useLightbox());
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.LIGHTBOX_REQUEST_BOARD,
      source: 'webview.lightbox',
      payload: {}
    }));
  });

  it('holds the board and the refusal, and a new board clears the refusal', () => {
    const { result } = renderHook(() => useLightbox());
    expect(result.current.board).toBeUndefined();

    act(() => result.current.handleSourceRefused(envelope(MessageType.LIGHTBOX_SOURCE_REFUSED, {
      refusal: { reason: 'over-ceiling', message: 'Too long.', wordCount: 60_000, ceilingWords: 50_000 }
    }) as never));
    expect(result.current.refusal?.reason).toBe('over-ceiling');

    const board = makeBoard(6);
    act(() => result.current.handleBoard(envelope(MessageType.LIGHTBOX_BOARD, { board }) as never));
    expect(result.current.board).toBe(board);
    expect(result.current.refusal).toBeNull();
  });

  it('posts the source actions and tracks a re-read until the host answers', () => {
    const { result } = renderHook(() => useLightbox());
    act(() => result.current.pickSourceFile());
    act(() => result.current.refreshSource());

    const types = vscode.postMessage.mock.calls.map(([message]) => message.type);
    expect(types).toEqual([
      MessageType.LIGHTBOX_REQUEST_BOARD,
      MessageType.LIGHTBOX_PICK_SOURCE_FILE,
      MessageType.LIGHTBOX_REFRESH_SOURCE
    ]);
    expect(result.current.rereading).toBe(true);
    act(() => result.current.handleBoard(envelope(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6) }) as never));
    expect(result.current.rereading).toBe(false);
  });

  it('persists the filter, the pinned item and the lenses that are off, never the board', () => {
    const { result } = renderHook(() => useLightbox());
    act(() => {
      result.current.handleBoard(envelope(MessageType.LIGHTBOX_BOARD, { board: makeBoard(6) }) as never);
      result.current.setFilter('measured');
      result.current.selectItem({ kind: 'word', word: 'alice' });
      result.current.toggleLens('voice');
    });

    expect(result.current.persistedState).toEqual({
      lightboxFilter: 'measured',
      lightboxSelectedItem: { kind: 'word', word: 'alice' },
      lightboxLensesOff: ['voice']
    });
    act(() => result.current.toggleLens('voice'));
    expect(result.current.persistedState.lightboxLensesOff).toEqual([]);
  });

  it('restores valid preferences and drops malformed ones', () => {
    vscode.getState.mockReturnValue({
      lightboxFilter: 'read',
      lightboxSelectedItem: { kind: 'paragraphs', from: 3, to: 5 },
      lightboxLensesOff: ['genre', 'palette', 'genre', 7]
    });
    const restored = renderHook(() => useLightbox()).result.current;
    expect(restored.filter).toBe('read');
    expect(restored.selected).toEqual({ kind: 'paragraphs', from: 3, to: 5 });
    expect(restored.lensesOff).toEqual(['genre']);

    vscode.getState.mockReturnValue({ lightboxFilter: 'everything', lightboxSelectedItem: { kind: 'word' } });
    const fallback = renderHook(() => useLightbox()).result.current;
    expect(fallback.filter).toBe('all');
    expect(fallback.selected).toBeNull();
    expect(fallback.lensesOff).toEqual([]);
  });
});
