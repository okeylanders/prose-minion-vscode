/** @jest-environment jsdom */

/**
 * The Lightbox inspector's view model (ADR 2026-10-19 D3, D4): what a pinned
 * measured item shows, with exact paragraph numbers even when the ribbon
 * buckets them.
 */

import { act, renderHook } from '@testing-library/react';
import {
  buildLightboxInspectorView,
  useLightboxInspector
} from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { parseLightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
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
