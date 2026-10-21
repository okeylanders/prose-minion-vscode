/**
 * What group D's quotes witness, fresh, carried and brought (PR #155):
 * - F-02: a handoff between two sentences with the same words is two roles,
 *   and Bring sends both;
 * - F-03: a familiar phrase is witnessed by a quote whose span holds a whole
 *   occurrence of it in the paragraph, never by a quote cut inside a longer
 *   word;
 * - N-01: a carried handoff follows its intact pair to another paragraph,
 *   even when a copy of its first sentence stayed behind, and words that
 *   still stand are never called gone;
 * - F-01: Bring refuses a numbers reading whose figure does not stand out.
 * Through the production codec, verifier, gates, carry and Bring. The short
 * paragraphs are synthetic sentences written for these tests; the numbers
 * board reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain) against synthetic averages.
 */
import type { LightboxBoard, LightboxLensId, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { LIGHTBOX_TILE_HANDOFF_REFUSALS, prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { frame, readWorkedExample } from './lightboxReadingFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are written as plain JSON. */
type Body = Record<string, any>;

/** Group D read on `paragraphs`, as the board would hold it. */
function readOn(paragraphs: readonly string[], lenses: LightboxLensId[], body: Body, board?: LightboxBoard): LightboxReadingGroup {
  const decoded = decodeLightboxGroup(frame('D', body), { group: 'D', lenses, columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `w${++id}`,
    standouts: lightboxStandoutRows(board?.measured.numbers.rows)
  });
  return {
    group: 'D', status: 'ok', lenses, tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

const carry = (group: LightboxReadingGroup, after: readonly string[]) =>
  carryLightboxReadings([group], { readAgainst: 'old', paragraphs: after, averageWordsPerSentence: 4 })[0];

/** A board holding `group` as its group D, for Bring. */
function boardOf(group: LightboxReadingGroup, paragraphCount: number, base: LightboxBoard = makeBoard(paragraphCount)): LightboxBoard {
  return { ...base, readings: LIGHTBOX_READING_GROUPS.map((id) => (id === 'D' ? group : emptyLightboxReadingGroup(id))) };
}

const bring = (board: LightboxBoard, tile: LightboxReadingTile, paragraphs: readonly string[]) =>
  prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, paragraphs);

const ofKind = (group: { tiles: LightboxReadingTile[] }, kind: LightboxReadingTile['kind']) => group.tiles.filter((tile) => tile.kind === kind);

describe('a handoff between two sentences with the same words (PR #155 F-02)', () => {
  const rhythm = (paragraphs: readonly string[], from: string, to: string): Body => ({
    version: 1,
    rhythm: {
      endings: paragraphs.map(() => 'holds'),
      movement: 'The line says itself again.',
      evidence: [{ para: 1, quote: from }],
      handoffs: [{ from: { para: 1, quote: from }, to: { para: 1, quote: to }, carried: 'The waiting.', changes: 'Nothing, and that is the point.', effect: 'pause' }],
      friction: 'A repetition is one reading among several.'
    }
  });

  it('is drawn fresh, carried and brought with both roles, in order', () => {
    const repeated = ['She waited. She waited.'];
    const fresh = readOn(repeated, ['rhythm'], rhythm(repeated, 'She waited', 'She waited'));
    const [handoff] = ofKind(fresh, 'handoff');
    expect(handoff?.evidence).toEqual([
      { paragraph: 1, text: 'She waited', match: 'exact' },
      { paragraph: 1, text: 'She waited', match: 'exact' }
    ]);
    // Carried onto text where the pair moved down a paragraph: both roles, at ¶2.
    const [carried] = ofKind(carry(fresh, ['A bell rang.', ...repeated]), 'handoff');
    expect(carried?.evidence.map((quote) => [quote.paragraph, quote.text])).toEqual([[2, 'She waited'], [2, 'She waited']]);
    // Bring sends both: the verifier proved two adjacent occurrences, so neither is dropped as a duplicate.
    const brought = bring(boardOf(fresh, 1), handoff, repeated);
    expect(brought.ok && brought.handoff.tile.quotes).toEqual([
      { paragraph: 1, text: 'She waited' },
      { paragraph: 1, text: 'She waited' }
    ]);

    // Controls: two different sentences travel in order; one occurrence is never read as two.
    const plain = ['She waited. Nobody came.'];
    const different = readOn(plain, ['rhythm'], rhythm(plain, 'She waited', 'Nobody came'));
    const sent = bring(boardOf(different, 1), ofKind(different, 'handoff')[0], plain);
    expect(sent.ok && sent.handoff.tile.quotes.map((quote) => quote.text)).toEqual(['She waited', 'Nobody came']);
    const once = ['She waited. A bell rang.'];
    expect(readOn(once, ['rhythm'], rhythm(once, 'She waited', 'She waited')).withheldClaims.map((claim) => claim.reason))
      .toEqual([LIGHTBOX_GATE_REASONS.handoffNotAdjacent.fresh]);
  });
});

describe('a familiar phrase is witnessed by a whole occurrence in its quote (PR #155 F-03)', () => {
  const stock = (phrase: string, quote: string): Body => ({
    version: 1,
    stock: {
      economy: { note: 'Too short to tier.', beats: [] },
      signature: [],
      familiar: [{ phrase, kind: 'idiom', note: 'A plain intensifier.', evidence: [{ para: 1, quote }] }],
      airLocks: [],
      echoes: [],
      friction: 'Two lines are thin ground.'
    }
  });
  const familiar = (paragraphs: readonly string[], phrase: string, quote: string) => {
    const group = readOn(paragraphs, ['stock'], stock(phrase, quote));
    return {
      group,
      drawn: ofKind(group, 'familiar-phrase').map((tile) => tile.title),
      withheld: group.withheldClaims.filter((claim) => claim.kind === 'familiar-phrase').map((claim) => claim.reason)
    };
  };
  const CLIPPED = ['We watched every bright window.', 'The road was very quiet.'];
  const GENUINE = ['We watched a very bright window.', 'The road was very quiet.'];

  it('withholds a quote cut inside a longer word, fresh, though the phrase stands elsewhere', () => {
    expect(familiar(CLIPPED, 'very', 'very bright window')).toMatchObject({ drawn: [], withheld: [LIGHTBOX_GATE_REASONS.familiarUnquoted] });
    // Controls: the whole longer word holds no "very"; a real one is drawn; with none anywhere, nothing is counted.
    expect(familiar(CLIPPED, 'very', 'every bright window').withheld).toEqual([LIGHTBOX_GATE_REASONS.familiarUnquoted]);
    expect(familiar(GENUINE, 'very', 'very bright window')).toMatchObject({ drawn: ['very'], withheld: [] });
    expect(familiar(['We watched every bright window.', 'The road was quiet.'], 'very', 'very bright window').withheld)
      .toEqual([LIGHTBOX_GATE_REASONS.familiarUncounted.fresh]);
    // The words stand twice in one paragraph, once inside "every": the whole occurrence witnesses it.
    expect(familiar(['We watched every bright window, then a very bright window.'], 'very', 'very bright window').drawn).toEqual(['very']);
    // Found with typography folded, the span still holds the whole phrase.
    const folded = familiar(['It was the Queen’s very own window.'], 'very own', 'Queen\'s very own');
    expect(folded.drawn).toEqual(['very own']);
    expect(ofKind(folded.group, 'familiar-phrase')[0].evidence[0]).toMatchObject({ text: 'Queen’s very own', match: 'normalized' });
  });

  it('withholds a carried phrase once its quote stands only inside a longer word', () => {
    const read = familiar(GENUINE, 'very', 'very bright window').group;
    expect(ofKind(read, 'familiar-phrase')).toHaveLength(1);
    const carried = carry(read, CLIPPED);
    expect(ofKind(carried, 'familiar-phrase')).toEqual([]);
    expect(carried.withheldClaims.filter((claim) => claim.kind === 'familiar-phrase').map((claim) => claim.reason))
      .toEqual([LIGHTBOX_GATE_REASONS.familiarUnquoted]);
    // Control: unchanged text keeps it.
    expect(ofKind(carry(read, GENUINE), 'familiar-phrase')).toHaveLength(1);
  });

  it('refuses to bring a phrase whose quote, as the chapter has it, holds no whole occurrence', () => {
    const read = familiar(GENUINE, 'very', 'very bright window').group;
    const [tile] = ofKind(read, 'familiar-phrase');
    const board = boardOf(read, 2);
    expect(bring(board, tile, GENUINE).ok).toBe(true);
    expect(bring(board, tile, CLIPPED)).toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.phraseGone });
  });
});

describe('a carried handoff whose pair moved (PR #155 N-01)', () => {
  const BEFORE = ['She waited. Nobody came.', 'The clock kept ticking.'];
  const read = () => readOn(BEFORE, ['rhythm'], {
    version: 1,
    rhythm: {
      endings: ['holds', 'opens'],
      movement: 'Short lines that stop.',
      evidence: [{ para: 2, quote: 'The clock kept ticking.' }],
      handoffs: [{ from: { para: 1, quote: 'She waited' }, to: { para: 1, quote: 'Nobody came' }, carried: 'The waiting.', changes: 'No one answers.', effect: 'continues' }],
      friction: 'Two paragraphs are thin ground.'
    }
  });

  it('follows the intact pair to another paragraph, though a copy of its first sentence stayed behind', () => {
    const carried = carry(read(), ['She waited. A bell rang.', 'She waited. Nobody came.']);
    expect(ofKind(carried, 'handoff').map((tile) => (tile.kind === 'handoff' ? [tile.from.paragraph, tile.to.paragraph] : [])))
      .toEqual([[2, 2]]);
  });

  it('says a pair whose words still stand is no longer adjacent, never gone; and gone only when they are', () => {
    const handoffClaims = (group: LightboxReadingGroup) => group.withheldClaims.filter((claim) => claim.kind === 'handoff');
    const apart = carry(read(), ['She waited. A bell rang.', 'Nobody came.']);
    expect(handoffClaims(apart)).toEqual([expect.objectContaining({
      kind: 'handoff', reason: LIGHTBOX_GATE_REASONS.handoffNotAdjacent.carried, quotes: []
    })]);
    const gone = carry(read(), ['She waited. A bell rang.', 'The clock kept ticking.']);
    expect(handoffClaims(gone)).toEqual([expect.objectContaining({
      kind: 'handoff', reason: LIGHTBOX_GATE_REASONS.handoffGone.carried, quotes: [{ paragraph: 1, reason: 'no-longer-in-chapter' }]
    })]);
  });
});

describe('Bring and a numbers reading (PR #155 F-01)', () => {
  it('refuses a usage whose figure does not stand out on the board, and brings it while it does', async () => {
    const alice = readWorkedExample('D').paragraphs;
    const measured = await boardWithNumbers(alice);
    const example = readWorkedExample('D');
    const group = readOn(alice, example.lenses, JSON.parse(example.response.split('\n').slice(1, -1).join('\n')) as Body, measured);
    const board = boardOf(group, alice.length, measured);
    const usage = ofKind(group, 'number-usage').find((tile) => tile.kind === 'number-usage' && tile.stat === 'sentence-length') as LightboxReadingTile;
    expect(bring(board, usage, alice).ok).toBe(true);
    const unmeasured: LightboxBoard = {
      ...board,
      measured: { ...board.measured, numbers: { ...board.measured.numbers, rows: board.measured.numbers.rows.map(({ standout: _standout, ...row }) => row) } }
    };
    expect(bring(unmeasured, usage, alice)).toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.notStandout });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
