/**
 * The inspector's wells as drawn (Slice 4E): which passage a pin asks for,
 * and what the well says while it waits, once it lands, past its bounds, and
 * when the host refuses. An answer is shown only for the board on screen,
 * the same text and the same item; for the same pin over a newer board, the
 * well says the text changed and shows none of the older text. Text from
 * Lewis Carroll's "Alice's Adventures in Wonderland" (1865, public domain).
 */

import type { LightboxBoard, LightboxPassage } from '@messages';
import {
  LightboxPassageAnswer,
  buildLightboxPassageWellView,
  lightboxPassageItemKey,
  lightboxPassageItemOf,
  lightboxPassageRequestKey
} from '@hooks/domain/lightbox/lightboxPassages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

const ALICE = { kind: 'word', word: 'alice' } as const;

/** An answer to `ref` on `board`, as `useLightboxPassages` takes it. */
function answerTo(board: LightboxBoard, ref: LightboxItemRef, passage: LightboxPassage): LightboxPassageAnswer {
  const item = lightboxPassageItemOf(board, ref);
  if (!item) {
    throw new Error('No passage for this pin.');
  }
  return {
    key: lightboxPassageRequestKey(board, item),
    itemKey: lightboxPassageItemKey(item),
    boardId: board.boardId,
    contentHash: board.source.contentHash,
    passage
  };
}

describe('which passage a pin asks for', () => {
  it('asks for a paragraph range, with the term it was reached from while the board lists it', () => {
    const board = makeBoard(6);
    expect(lightboxPassageItemOf(board, { kind: 'paragraphs', from: 2, to: 2, via: ALICE }))
      .toEqual({ kind: 'paragraphs', from: 2, to: 2, via: ALICE });
    expect(lightboxPassageItemOf(board, { kind: 'paragraphs', from: 2, to: 2, via: { kind: 'word', word: 'jabberwock' } }))
      .toEqual({ kind: 'paragraphs', from: 2, to: 2 });
    expect(lightboxPassageItemOf(board, { kind: 'paragraphs', from: 6, to: 7 })).toBeNull();
  });

  it('asks for the sentences of every counted term the board lists, and nothing for other items', () => {
    const board = makeBoard(6);
    for (const term of [ALICE, { kind: 'pos', pos: 'verbs', word: 'thought' }, { kind: 'phrase', phrase: 'thought alice' },
      { kind: 'hapax', word: 'tunnel' }, { kind: 'flag', flag: 'adverbs' }] as const) {
      expect(lightboxPassageItemOf(board, term)).toEqual({ kind: 'instances', term });
    }
    for (const ref of [{ kind: 'word', word: 'jabberwock' }, { kind: 'flag', flag: 'weak-verbs' }, { kind: 'lane', lane: 'rhythm' },
      { kind: 'standout', stat: 'dialogue' }, { kind: 'reading', tileId: 'lbt-1-A-1' }] as const) {
      expect(lightboxPassageItemOf(board, ref)).toBeNull();
    }
  });

  it('keys a request by board, text and item, the term a paragraph came from included', () => {
    const board = makeBoard(6);
    expect(lightboxPassageRequestKey(board, { kind: 'paragraphs', from: 2, to: 2, via: ALICE }))
      .toBe(`board-6|${'a'.repeat(64)}|paragraphs:2-2:via:word:alice`);
    expect(lightboxPassageRequestKey(board, { kind: 'instances', term: ALICE })).toBe(`board-6|${'a'.repeat(64)}|instances:word:alice`);
  });
});

describe('the well', () => {
  const board = makeBoard(6);
  const sentences: LightboxPassage = {
    kind: 'instances',
    instances: 5,
    sentences: 4,
    rows: [{ sentences: [{ paragraph: 2, sentence: 1, segments: [{ text: 'thought ' }, { text: 'Alice', instances: [0] }] }] }],
    more: { rows: 0, sentences: 0, instances: 0 }
  };

  it('waits for the sentences, then counts instances and sentences in agreement with their numbers', () => {
    expect(buildLightboxPassageWellView(board, ALICE, null)).toEqual({
      kind: 'instances',
      status: 'loading',
      label: 'Sentences',
      regionLabel: 'Sentences holding “alice”',
      term: ALICE,
      note: 'Finding the sentences…'
    });
    expect(buildLightboxPassageWellView(board, ALICE, answerTo(board, ALICE, sentences))).toEqual({
      kind: 'instances',
      status: 'ready',
      label: 'Sentences',
      regionLabel: 'Sentences holding “alice”',
      term: ALICE,
      passage: sentences,
      header: '5 instances in 4 sentences'
    });
    const one: LightboxPassage = { ...sentences, instances: 1, sentences: 1 };
    expect(buildLightboxPassageWellView(board, ALICE, answerTo(board, ALICE, one))?.header).toBe('1 instance in 1 sentence');
  });

  it('states its row bound and what lies past it', () => {
    const bounded: LightboxPassage = { ...sentences, instances: 240, sentences: 214, more: { rows: 164, sentences: 164, instances: 190 } };
    expect(buildLightboxPassageWellView(board, ALICE, answerTo(board, ALICE, bounded))?.more)
      .toBe('The well lists up to 50 rows: 164 more sentences with 190 instances are not listed.');
    const single: LightboxPassage = { ...sentences, more: { rows: 1, sentences: 1, instances: 1 } };
    expect(buildLightboxPassageWellView(board, ALICE, answerTo(board, ALICE, single))?.more)
      .toBe('The well lists up to 50 rows: 1 more sentence with 1 instance is not listed.');
  });

  it('shows a paragraph whole, lit by the term the writer came from, with the way back', () => {
    const ref: LightboxItemRef = { kind: 'paragraphs', from: 2, to: 2, via: ALICE };
    const text: LightboxPassage = {
      kind: 'paragraphs',
      paragraphs: [{ index: 2, segments: [{ text: 'Alice', instances: [0] }, { text: ' was beginning to get very tired.' }] }],
      moreParagraphs: 0,
      lit: 1
    };
    expect(buildLightboxPassageWellView(board, ref, null)).toEqual(expect.objectContaining({
      status: 'loading', note: 'Reading ¶2 from the text the board counted…', label: 'The text · as counted', regionLabel: 'Text of ¶2'
    }));
    expect(buildLightboxPassageWellView(board, ref, answerTo(board, ref, text))).toEqual({
      kind: 'paragraphs',
      status: 'ready',
      label: 'The text · as counted',
      regionLabel: 'Text of ¶2',
      back: { ref: ALICE, label: 'Back to “alice”' },
      passage: text,
      lit: 'Lit: “alice”, 1 instance here.'
    });
  });

  it('states a range\'s bound', () => {
    const wide = makeBoard(30);
    const ref: LightboxItemRef = { kind: 'paragraphs', from: 3, to: 20 };
    const text: LightboxPassage = {
      kind: 'paragraphs',
      paragraphs: Array.from({ length: 10 }, (_unused, offset) => ({ index: 3 + offset, segments: [{ text: 'Down, down, down.' }] })),
      moreParagraphs: 8
    };
    expect(buildLightboxPassageWellView(wide, ref, answerTo(wide, ref, text))).toEqual(expect.objectContaining({
      label: 'The text · ¶3–¶12 of ¶3–¶20',
      regionLabel: 'Text of ¶3–¶12',
      more: 'The well shows up to 10 paragraphs: ¶13–¶20 are not shown. Pin one below to read it.'
    }));
  });

  it('says the text changed, and shows none of it, while the same pin waits on a newer board', () => {
    const older = makeBoard(6);
    const newer: LightboxBoard = { ...older, boardId: 'board-6b', source: { ...older.source, contentHash: 'b'.repeat(64) } };
    const ref: LightboxItemRef = { kind: 'paragraphs', from: 2, to: 2 };
    const old: LightboxPassage = { kind: 'paragraphs', paragraphs: [{ index: 2, segments: [{ text: 'The old text.' }] }], moreParagraphs: 0 };
    const view = buildLightboxPassageWellView(newer, ref, answerTo(older, ref, old));
    expect(view).toEqual(expect.objectContaining({
      status: 'loading',
      note: 'The text changed since this was shown. Reading it again from the board as it stands…'
    }));
    expect(view?.passage).toBeUndefined();
    // Same board id, other text: still not this board's.
    const rehashed: LightboxBoard = { ...older, source: { ...older.source, contentHash: 'c'.repeat(64) } };
    expect(buildLightboxPassageWellView(rehashed, ref, answerTo(older, ref, old))?.passage).toBeUndefined();
    // Another pin's answer is no change of text, only waiting.
    expect(buildLightboxPassageWellView(older, { kind: 'paragraphs', from: 3, to: 3 }, answerTo(older, ref, old))?.note)
      .toBe('Reading ¶3 from the text the board counted…');
  });

  it('says why the host refused', () => {
    const ref: LightboxItemRef = { kind: 'paragraphs', from: 2, to: 2 };
    expect(buildLightboxPassageWellView(board, ref, answerTo(board, ref, { kind: 'refused', reason: 'changed' }))).toEqual(expect.objectContaining({
      status: 'refused',
      note: 'The text changed since this board was counted, so this passage is not shown. Re-read the file to count it again.'
    }));
    expect(buildLightboxPassageWellView(board, ALICE, answerTo(board, ALICE, { kind: 'refused', reason: 'not-on-board' }))?.note)
      .toBe('This item is not on the board any more.');
    expect(buildLightboxPassageWellView(board, ref, answerTo(board, ref, { kind: 'refused', reason: 'not-on-board' }))?.note)
      .toBe('This paragraph is not on the board any more.');
  });

  it('has no well for a pin without a passage', () => {
    expect(buildLightboxPassageWellView(board, { kind: 'lane', lane: 'dialogue' }, null)).toBeNull();
  });
});
