/**
 * The webview's view of a board's readings (ADR 2026-10-19 D3, D7): lens
 * states from the host's group status, tallies of checked and withheld
 * quotes, withheld-quote wording, group-result merging, and the reading items
 * the inspector shows with their evidence.
 */
import type { LightboxBoard } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  lightboxLensView,
  lightboxQuoteTally,
  lightboxTensionScores,
  lightboxWithheldQuoteText,
  mergeLightboxGroupResult
} from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxItemsTouching, parseLightboxItemRef, resolveLightboxItem } from '@hooks/domain/lightbox/lightboxItems';
import { buildLightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { makeBoard } from './lightboxBoardFixtures';
import { makeReadBoard, readGroup } from './lightboxReadingBoardFixtures';

const tileId = (board: LightboxBoard, title: string): string => {
  const tile = board.readings.flatMap((group) => group.tiles).find((candidate) => candidate.title === title);
  if (!tile) {
    throw new Error(`no tile ${title}`);
  }
  return tile.id;
};

describe('lens views', () => {
  it('reads not-run, reading, ok, failed and cancelled from the group', () => {
    const board = makeBoard(8);
    expect(lightboxLensView(board, 'motif').phase).toBe('not-run');

    const running = { ...board, readings: [{ ...emptyLightboxReadingGroup('A'), status: 'running' as const, pending: ['motif' as const] }] };
    expect(lightboxLensView(running, 'motif').phase).toBe('reading');
    expect(lightboxLensView(running, 'headline').phase).toBe('not-run');

    const read = makeReadBoard();
    expect(lightboxLensView(read, 'motif')).toMatchObject({ phase: 'ok', tiles: expect.any(Array) });
    expect(lightboxLensView(read, 'motif').friction).toContain('Going down');

    const failed = { ...board, readings: [{ ...emptyLightboxReadingGroup('B'), status: 'failed' as const, error: 'Rate limited.' }] };
    expect(lightboxLensView(failed, 'voice')).toMatchObject({ phase: 'failed', notice: 'Rate limited.' });

    // A failed re-read keeps the earlier reading it asked for, marked earlier with the failure (Slice 4J); a reading
    // the call never asked for says nothing of it (PR #170 N-01).
    const rereadFailed = { ...read, readings: read.readings.map((group) => (group.group === 'A'
      ? { ...group, status: 'failed' as const, error: 'Timed out.', earlierLenses: [{ lens: 'motif' as const, reason: 'Timed out.' }] }
      : group)) };
    expect(lightboxLensView(rereadFailed, 'motif')).toMatchObject({ phase: 'ok', earlier: 'Timed out.' });
    expect(lightboxLensView(rereadFailed, 'motif').notice).toBeUndefined();
    expect(lightboxLensView(rereadFailed, 'headline')).toMatchObject({ phase: 'ok' });
    expect(lightboxLensView(rereadFailed, 'headline').notice).toBeUndefined();
    expect(lightboxLensView(rereadFailed, 'headline').earlier).toBeUndefined();
  });

  it('keeps an empty lens honest: no tiles, but its friction', () => {
    const board = makeReadBoard();
    const emptied = {
      ...board,
      readings: board.readings.map((group) => (group.group === 'A' ? { ...group, tiles: group.tiles.filter((tile) => tile.kind !== 'motif') } : group))
    };
    const view = lightboxLensView(emptied, 'motif');
    expect(view).toMatchObject({ phase: 'ok', tiles: [] });
    expect(view.friction).toBeTruthy();
  });
});

describe('tallies and wording', () => {
  it('counts every checked quote, and the withheld ones, across the board', () => {
    const tally = lightboxQuoteTally(makeReadBoard({ paraphraseOne: true }));
    expect(tally.withheld).toBe(1);
    expect(tally.checked).toBeGreaterThan(20);
    // Groups A–E, craft steering (Slice 4F) and the Opinion (Slice 4D).
    expect(tally.calls).toBe(7);
  });

  it('says why a quote was withheld, never with the quote itself', () => {
    expect(lightboxWithheldQuoteText({ paragraph: 14, reason: 'not-in-paragraph', foundIn: [15] }))
      .toBe('Not in ¶14; the words stand in ¶15. A quote must stand in the paragraph it names.');
    expect(lightboxWithheldQuoteText({ paragraph: 40, reason: 'undeclared-paragraph' })).toBe('The chapter has no ¶40.');
    expect(lightboxWithheldQuoteText({ paragraph: 6, reason: 'not-in-chapter' })).toContain('Only the chapter can be quoted.');
    expect(lightboxWithheldQuoteText({ paragraph: 6, reason: 'no-longer-in-chapter' }))
      .toBe('No longer in the chapter: the text changed after this was read, and these words are gone.');
  });

  it('labels a lens read against an earlier text stale, in its view and in the inspector (D4)', () => {
    const read = makeReadBoard();
    const stale = {
      ...read,
      readings: read.readings.map((group) => (group.group === 'A'
        ? { ...group, staleLenses: [{ lens: 'motif' as const, readAgainst: 'earlier-hash' }] }
        : group))
    };
    expect(lightboxLensView(stale, 'motif').stale).toBe(true);
    expect(lightboxLensView(stale, 'headline').stale).toBe(false);
    expect(lightboxLensView(read, 'motif').stale).toBe(false);
    const motif = buildLightboxInspectorView(stale, { kind: 'reading', tileId: tileId(stale, 'Going down') });
    expect(motif?.reading?.stale).toBe(true);
    const headline = buildLightboxInspectorView(stale, { kind: 'reading', tileId: stale.readings[0].tiles[0].id });
    expect(headline?.reading?.stale).toBe(false);
  });

  it('merges a group result into the board it names, and ignores one for another board', () => {
    const board = makeBoard(8);
    const group = readGroup('B');
    expect(mergeLightboxGroupResult(board, { boardId: board.boardId, token: 't', group }).readings[1]).toBe(group);
    expect(mergeLightboxGroupResult(board, { boardId: 'other', token: 't', group })).toBe(board);
  });

  it('draws tension scores only when they fit the ribbon', () => {
    expect(lightboxTensionScores(makeReadBoard())).toEqual([0, 1, 3, 6, 7, 8, 3, 2]);
    const short = { ...makeReadBoard(), ribbon: makeBoard(9).ribbon };
    expect(lightboxTensionScores(short)).toBeUndefined();
  });
});

describe('reading items and the inspector', () => {
  it('pins a reading by its host-minted id, which survives a reload as a preference', () => {
    expect(parseLightboxItemRef({ kind: 'reading', tileId: 'lbt-1-A-2' })).toEqual({ kind: 'reading', tileId: 'lbt-1-A-2' });
    expect(parseLightboxItemRef({ kind: 'reading' })).toBeNull();
    // A pin from an earlier run resolves to nothing rather than to a newer reading.
    expect(resolveLightboxItem(makeReadBoard(), { kind: 'reading', tileId: 'lbt-old-A-2' })).toBeUndefined();
  });

  it('resolves a motif in the read register with its counted support', () => {
    const board = makeReadBoard();
    const item = resolveLightboxItem(board, { kind: 'reading', tileId: tileId(board, 'Going down') });
    expect(item).toMatchObject({ register: 'read', where: 'Theme & motif · Motif', title: 'Going down' });
    expect(item?.support).toEqual(['down ×9']);
  });

  it('shows a reading\'s evidence, its withheld quote, its fields and where it strains', () => {
    const board = makeReadBoard({ paraphraseOne: true });
    const view = buildLightboxInspectorView(board, { kind: 'reading', tileId: tileId(board, 'Going down') });
    expect(view?.reading?.evidence.map((quote) => [quote.paragraph, quote.matchLabel])).toEqual([
      [5, 'found verbatim'],
      [8, 'found verbatim']
    ]);
    expect(view?.reading?.withheld).toEqual([
      { paragraph: 6, text: 'Not found in the chapter: a paraphrase, or words from somewhere else. Only the chapter can be quoted.' }
    ]);
    expect(view?.reading?.details).toEqual([{ label: 'How it moves', value: 'Every movement is downward, and none of it is chosen twice.' }]);
    expect(view?.reading?.friction).toContain('“Going down” rests partly on how common the word is');
    expect(view?.reading?.lens).toBe('motif');
  });

  it('labels genre affinity a claim and puts the voice\'s measured figure beside its music', () => {
    const board = makeReadBoard();
    const genre = buildLightboxInspectorView(board, { kind: 'reading', tileId: tileId(board, 'Survival thriller') });
    expect(genre?.reading?.details).toEqual([
      { label: 'Claimed affinity', value: '0.12 · a claim, not a score' },
      { label: 'Near miss', value: expect.stringContaining('A fall with no way out matches') }
    ]);
    const voice = buildLightboxInspectorView(board, { kind: 'reading', tileId: tileId(board, 'Narrative voice') });
    expect(voice?.register).toBe('counted-read');
    expect(voice?.reading?.details.find((detail) => detail.label === 'Sentence music')?.measured).toBe('8.4 avg');
  });

  it('says a headline once, and names readings that touch a pinned paragraph', () => {
    const board = makeReadBoard();
    const headline = buildLightboxInspectorView(board, { kind: 'reading', tileId: tileId(board, 'A bored girl follows a hurried white rabbit down a hole and keeps on falling.') });
    expect(headline?.claim).toBe('');
    const paragraph = buildLightboxInspectorView(board, { kind: 'paragraphs', from: 4, to: 4 });
    expect(paragraph?.touching.map((touch) => touch.label)).toEqual(expect.arrayContaining(['Going down']));
    expect(lightboxItemsTouching(board, 4).map((touch) => touch.title)).toEqual(expect.arrayContaining(['Going down', 'White Rabbit']));
  });
});
