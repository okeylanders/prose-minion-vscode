/** @jest-environment jsdom */

/**
 * The Lightbox focus controller (ADR 2026-10-19 D4): hovering or pinning an
 * item lights the ribbon columns of the paragraphs it touches, bucket-aware.
 */

import { act, renderHook } from '@testing-library/react';
import {
  lightboxLitColumns,
  useLightboxFocus
} from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

const litIndexes = (lit: readonly boolean[]) =>
  lit.flatMap((on, column) => (on ? [column] : []));

describe('lightboxLitColumns', () => {
  it('lights one column per paragraph a word touches when the ribbon is unbucketed', () => {
    const board = makeBoard(6);
    const alice = board.measured.topWords[0];

    expect(litIndexes(lightboxLitColumns(board.ribbon, alice.paragraphs))).toEqual([1, 3, 4, 5]);
  });

  it('lights the column whose range holds a paragraph once the ribbon buckets', () => {
    const board = makeBoard(200);
    expect(board.ribbon).toHaveLength(96);
    // ¶200 is in the last column; ¶1 in the first; ¶100 in the column that ranges over it.
    const columnOf100 = board.ribbon.findIndex((column) => column.from <= 100 && column.to >= 100);

    expect(litIndexes(lightboxLitColumns(board.ribbon, [1, 100, 200]))).toEqual([0, columnOf100, 95]);
    expect(board.ribbon[columnOf100].to).toBeGreaterThan(board.ribbon[columnOf100].from);
  });

  it('lights exactly the columns of a bucketed range, and nothing for paragraphs off the board', () => {
    const board = makeBoard(200);
    const range = Array.from({ length: 25 }, (_, offset) => 51 + offset); // ¶51–¶75
    const expected = board.ribbon
      .map((column, index) => (column.to >= 51 && column.from <= 75 ? index : -1))
      .filter((index) => index >= 0);

    expect(litIndexes(lightboxLitColumns(board.ribbon, range))).toEqual(expected);
    expect(litIndexes(lightboxLitColumns(board.ribbon, [0, 201, 999]))).toEqual([]);
    expect(lightboxLitColumns([], [1])).toEqual([]);
  });
});

describe('useLightboxFocus', () => {
  const render = (selected: LightboxItemRef | null = null, paragraphCount = 6) => {
    const onSelect = jest.fn();
    const board = makeBoard(paragraphCount);
    const hook = renderHook(
      ({ current }) => useLightboxFocus({ board, selected: current, onSelect }),
      { initialProps: { current: selected } }
    );
    return { ...hook, onSelect, board };
  };

  it('lights the hovered word, then falls back to the pinned item when the pointer leaves', () => {
    const word: LightboxItemRef = { kind: 'word', word: 'alice' };
    const pinned: LightboxItemRef = { kind: 'phrase', phrase: 'thought alice' };
    const { result } = render(pinned);

    expect(litIndexes(result.current.litColumns)).toEqual([1, 5]);
    act(() => result.current.bind(word).handlers.onMouseEnter());
    expect(result.current.focusedItem?.title).toBe('alice');
    expect([...result.current.focusedParagraphs]).toEqual([2, 4, 5, 6]);
    expect(litIndexes(result.current.litColumns)).toEqual([1, 3, 4, 5]);
    expect(result.current.bind(word).isHot).toBe(true);

    act(() => result.current.bind(word).handlers.onMouseLeave());
    expect(result.current.focusedItem?.title).toBe('“thought alice”');
  });

  it('lights a hovered ribbon column by its range on a bucketed board', () => {
    const { result, board } = render(null, 200);
    const column = board.ribbon[40];
    act(() => result.current.bind({ kind: 'paragraphs', from: column.from, to: column.to }).handlers.onFocus());

    expect(litIndexes(result.current.litColumns)).toEqual([40]);
    expect(result.current.focusedItem?.title).toBe(`¶${column.from}–¶${column.to}`);
  });

  it('pins on click and unpins a click on the pinned item', () => {
    const word: LightboxItemRef = { kind: 'word', word: 'rabbit' };
    const { result, onSelect, rerender } = render();

    act(() => result.current.bind(word).handlers.onClick());
    expect(onSelect).toHaveBeenLastCalledWith(word);

    rerender({ current: word });
    expect(result.current.bind(word).isSelected).toBe(true);
    act(() => result.current.bind(word).handlers.onClick());
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('ignores a leave from an item that is no longer the hovered one', () => {
    const first: LightboxItemRef = { kind: 'word', word: 'alice' };
    const second: LightboxItemRef = { kind: 'word', word: 'down' };
    const { result } = render();

    act(() => result.current.bind(first).handlers.onMouseEnter());
    act(() => result.current.bind(second).handlers.onMouseEnter());
    act(() => result.current.bind(first).handlers.onMouseLeave());
    expect(result.current.focusedItem?.title).toBe('down');
  });

  it('declares an empty persistence contract: hover is transient', () => {
    expect(render().result.current.persistedState).toEqual({});
  });
});
