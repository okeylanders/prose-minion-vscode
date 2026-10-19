/** @jest-environment jsdom */

/**
 * The Lightbox inspector's view model (ADR 2026-10-19 D3, D4): what a pinned
 * measured item shows, with exact paragraph numbers even when the ribbon
 * buckets them.
 */

import { act, renderHook } from '@testing-library/react';
import type { LightboxBoard } from '@messages';
import {
  LIGHTBOX_PARAGRAPH_PAGE_SIZE,
  buildLightboxInspectorView,
  lightboxParagraphJump,
  pageLightboxParagraphs,
  useLightboxInspector
} from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { LightboxItemRef, parseLightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

describe('buildLightboxInspectorView', () => {
  it('shows a pinned word as a measured count with every paragraph it lives in', () => {
    const view = buildLightboxInspectorView(makeBoard(6), { kind: 'word', word: 'alice' });

    expect(view).toEqual({
      register: 'measured',
      registerLabel: 'Measured',
      registerNote: 'Counted by code. No model was asked.',
      where: 'Measure · Word',
      title: 'alice',
      claim: 'Appears 5 times across 4 paragraphs. Counted by code; nothing here is a reading.',
      paragraphs: [2, 4, 5, 6],
      paragraphLabel: '4 paragraphs',
      support: ['alice ×5', '0.5% of words'],
      touching: []
    });
  });

  it('names tagged words and repeated phrases by kind', () => {
    const board = makeBoard(6);
    expect(buildLightboxInspectorView(board, { kind: 'pos', pos: 'adverbs', word: 'suddenly' }))
      .toEqual(expect.objectContaining({ where: 'Measure · Adverb', paragraphs: [3, 5] }));
    expect(buildLightboxInspectorView(board, { kind: 'phrase', phrase: 'thought alice' }))
      .toEqual(expect.objectContaining({ where: 'Measure · Repeated phrase', title: '“thought alice”' }));
  });

  it('pools a bucketed column and lists its exact paragraphs', () => {
    const board = makeBoard(200);
    const column = board.ribbon[10];
    const view = buildLightboxInspectorView(board, { kind: 'paragraphs', from: column.from, to: column.to });
    const expected = Array.from({ length: column.to - column.from + 1 }, (_, offset) => column.from + offset);

    expect(view?.title).toBe(`¶${column.from}–¶${column.to}`);
    expect(view?.paragraphs).toEqual(expected);
    expect(view?.where).toBe('Chapter · Paragraphs');
    expect(view?.claim).toMatch(/^\d+ words in \d+ sentences · [\d.]+ words per sentence · \d+% dialogue\.$/);
  });

  it('offers the measured items touching a single paragraph', () => {
    const view = buildLightboxInspectorView(makeBoard(6), { kind: 'paragraphs', from: 2, to: 2 });

    expect(view?.title).toBe('¶2');
    expect(view?.touching.map((touch) => touch.label)).toEqual(['alice', '“thought alice”']);
  });

  it('selects the long-running paragraphs for the rhythm lane and the speaking ones for dialogue', () => {
    const board = makeBoard(6);
    expect(buildLightboxInspectorView(board, { kind: 'lane', lane: 'rhythm' })?.paragraphs).toEqual([3]);
    expect(buildLightboxInspectorView(board, { kind: 'lane', lane: 'dialogue' })).toEqual(expect.objectContaining({
      paragraphs: [2, 4, 6],
      claim: expect.stringContaining('against a standard of 40–55%')
    }));
  });

  it('shows nothing for no board, no pin, or a pin the board no longer has', () => {
    expect(buildLightboxInspectorView(null, { kind: 'word', word: 'alice' })).toBeNull();
    expect(buildLightboxInspectorView(makeBoard(6), null)).toBeNull();
    expect(buildLightboxInspectorView(makeBoard(6), { kind: 'word', word: 'cheshire' })).toBeNull();
    expect(buildLightboxInspectorView(makeBoard(6), { kind: 'paragraphs', from: 40, to: 41 })).toBeNull();
  });
});

describe('useLightboxInspector', () => {
  it('pins a paragraph and clears through the injected setter, persisting nothing itself', () => {
    const onSelect = jest.fn();
    const { result } = renderHook(() =>
      useLightboxInspector({ board: makeBoard(6), selected: { kind: 'word', word: 'down' }, onSelect })
    );

    expect(result.current.view?.title).toBe('down');
    act(() => result.current.pinParagraph(4));
    expect(onSelect).toHaveBeenLastCalledWith({ kind: 'paragraphs', from: 4, to: 4 });
    act(() => result.current.clear());
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(result.current.persistedState).toEqual({});
  });
});

describe('paging the inspector\'s addresses (PR #148 F-04)', () => {
  const range = (from: number, to: number, step = 1) =>
    Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, offset) => from + offset * step);

  it('pages every address, never more than a page at once, clamped to the pages there are', () => {
    const bucket = range(1, 52);
    expect(LIGHTBOX_PARAGRAPH_PAGE_SIZE).toBe(48);
    expect(pageLightboxParagraphs(bucket, 0)).toEqual({
      page: 0, pageCount: 2, shown: range(1, 48), from: 1, to: 48, total: 52, target: undefined
    });
    expect(pageLightboxParagraphs(bucket, 1)).toEqual({
      page: 1, pageCount: 2, shown: [49, 50, 51, 52], from: 49, to: 52, total: 52, target: undefined
    });
    expect(pageLightboxParagraphs(bucket, 9).page).toBe(1);
    expect(pageLightboxParagraphs(bucket, -3).page).toBe(0);
    expect(pageLightboxParagraphs([], 0)).toEqual(expect.objectContaining({ pageCount: 1, shown: [], total: 0 }));

    const everyAddress = range(1, 5_000);
    const pages = pageLightboxParagraphs(everyAddress, 0).pageCount;
    const seen = Array.from({ length: pages }, (_, page) => pageLightboxParagraphs(everyAddress, page).shown).flat();
    expect(seen).toEqual(everyAddress);
  });

  it('jumps to an address, or the next one the item has, or its last', () => {
    const odd = range(1, 199, 2);
    expect(lightboxParagraphJump(odd, 101)).toEqual({ page: 1, target: 101 });
    expect(lightboxParagraphJump(odd, 100)).toEqual({ page: 1, target: 101 });
    expect(lightboxParagraphJump(odd, 199)).toEqual({ page: 2, target: 199 });
    expect(lightboxParagraphJump(odd, 5_000)).toEqual({ page: 2, target: 199 });
    expect(lightboxParagraphJump(odd, 1)).toEqual({ page: 0, target: 1 });
    expect(lightboxParagraphJump([], 4)).toBeUndefined();
  });

  it('pages and jumps without touching the pin, and a new pin starts on the first page', () => {
    const onSelect = jest.fn();
    const pin: LightboxItemRef = { kind: 'paragraphs', from: 1, to: 200 };
    const { result, rerender } = renderHook(
      ({ board, selected }: { board: LightboxBoard; selected: LightboxItemRef }) =>
        useLightboxInspector({ board, selected, onSelect }),
      { initialProps: { board: makeBoard(200), selected: pin } }
    );
    expect(result.current.paragraphPage).toEqual(expect.objectContaining({ page: 0, pageCount: 5, from: 1, to: 48 }));

    act(() => result.current.showParagraphPage(4));
    expect(result.current.paragraphPage).toEqual(expect.objectContaining({ page: 4, shown: range(193, 200) }));
    act(() => result.current.jumpToParagraph(150));
    expect(result.current.paragraphPage).toEqual(expect.objectContaining({ page: 3, target: 150 }));
    expect(onSelect).not.toHaveBeenCalled();

    // A rebuilt board keeps the page under the same pin; pinning the item anew starts over.
    rerender({ board: makeBoard(200), selected: pin });
    expect(result.current.paragraphPage).toEqual(expect.objectContaining({ page: 3 }));
    rerender({ board: makeBoard(200), selected: { kind: 'paragraphs', from: 1, to: 200 } });
    expect(result.current.paragraphPage).toEqual(expect.objectContaining({ page: 0, target: undefined }));
  });
});

describe('parseLightboxItemRef', () => {
  it.each([
    [{ kind: 'word', word: 'alice' }],
    [{ kind: 'pos', pos: 'nouns', word: 'rabbit' }],
    [{ kind: 'phrase', phrase: 'thought alice' }],
    [{ kind: 'lane', lane: 'dialogue' }],
    [{ kind: 'paragraphs', from: 3, to: 9 }]
  ])('restores %j', (ref) => {
    expect(parseLightboxItemRef(ref)).toEqual(ref);
  });

  it.each([
    [undefined],
    ['alice'],
    [{ kind: 'word' }],
    [{ kind: 'pos', pos: 'pronouns', word: 'she' }],
    [{ kind: 'lane', lane: 'tension' }],
    [{ kind: 'paragraphs', from: 9, to: 3 }],
    [{ kind: 'paragraphs', from: 0, to: 3 }],
    [{ kind: 'motif', title: 'falling' }]
  ])('rejects %j', (value) => {
    expect(parseLightboxItemRef(value)).toBeNull();
  });
});
