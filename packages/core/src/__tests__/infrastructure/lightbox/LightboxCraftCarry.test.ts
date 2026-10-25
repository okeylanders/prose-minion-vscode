/**
 * Group D on changed text (ADR 2026-10-19 D4; Slice 4B). Through the real
 * service, an ending follows its column's text as a tension score does, and
 * a numbers reading is held to the figures the new board measures. Through
 * the carry itself, a handoff is found again as two adjacent sentences, and
 * a fresh reading of the changed text decides the same. The door and
 * three-line paragraphs are synthetic sentences written for these tests; the
 * numbers case reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865,
 * public domain) against the fixture writer's synthetic averages.
 */
import type {
  LightboxBoard,
  LightboxLensId,
  LightboxReadingGroup,
  LightboxRhythmEndingsTile
} from '@messages';
import { LightboxService, LightboxSourceInput } from '@/infrastructure/lightbox/LightboxService';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { WRITER_AVERAGES } from './lightboxCraftFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are edited as plain JSON. */
type Body = Record<string, any>;

function craftService(): LightboxService {
  let id = 0;
  return new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => `board-${++id}` },
    { measure: async () => WRITER_AVERAGES }
  );
}

const source = (paragraphs: readonly string[]): LightboxSourceInput => ({
  kind: 'file',
  text: paragraphs.join('\n\n'),
  displayPath: 'Drafts/craft.md',
  sourceUri: 'file:///workspace/Drafts/craft.md',
  rereadPath: '/workspace/Drafts/craft.md'
});

async function boardOf(lightbox: LightboxService, paragraphs: readonly string[]): Promise<LightboxBoard> {
  const result = await lightbox.buildBoard(source(paragraphs));
  if (result.kind !== 'board') {
    throw new Error('expected a board');
  }
  return result.board;
}

/** Group D read on `board` as the runner reads it: its column keys and its standouts. */
function readD(board: LightboxBoard, paragraphs: readonly string[], lenses: LightboxLensId[], body: Body): LightboxReadingGroup {
  const decoded = decodeLightboxGroup(frame('D', body), { group: 'D', lenses, columnCount: board.ribbon.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `d${++id}`,
    columnKeys: lightboxColumnKeys(paragraphs, board.ribbon),
    standouts: lightboxStandoutRows(board.measured.numbers.rows)
  });
  return {
    group: 'D', status: 'ok', lenses, tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

/** Read `before`, then build the board of `after`: group D as the service carries it. */
async function carriedD(before: readonly string[], after: readonly string[], lenses: LightboxLensId[], body: Body) {
  const lightbox = craftService();
  const first = await boardOf(lightbox, before);
  lightbox.updateReadings(first.boardId, (readings) =>
    readings.map((group) => (group.group === 'D' ? readD(first, before, lenses, body) : group)));
  const changed = await boardOf(lightbox, after);
  const group = changed.readings.find((candidate) => candidate.group === 'D') as LightboxReadingGroup;
  expect(group.staleLenses?.map((mark) => mark.lens)).toEqual(lenses);
  return { changed, group };
}

describe('carried endings follow their paragraphs, as tension does', () => {
  const QUIET = 'A quiet morning came.';
  const BOMB = 'A bomb exploded nearby.';
  const WINDOW = 'The window stood open.';
  const rhythm = (count: number, endings: string[]): Body => ({
    version: 1,
    rhythm: {
      endings: endings.slice(0, count),
      movement: 'Each line stops where it starts.',
      evidence: [{ para: 1, quote: 'A quiet morning' }, { para: 3, quote: 'The window stood open' }],
      handoffs: [],
      friction: 'Three short paragraphs are a thin reading.'
    }
  });
  const endingsAfter = async (after: readonly string[]) => {
    const { changed, group } = await carriedD([QUIET, BOMB, WINDOW], after, ['rhythm'], rhythm(3, ['holds', 'lands', 'opens']));
    const tile = group.tiles.find((candidate): candidate is LightboxRhythmEndingsTile => candidate.kind === 'rhythm-endings');
    expect(tile?.endings).toHaveLength(changed.ribbon.length);
    return tile?.endings;
  };

  it('keeps every ending where its paragraph is unchanged', async () => {
    expect(await endingsAfter([QUIET, BOMB, WINDOW, 'A closing line came.'])).toEqual(['holds', 'lands', 'opens', null]);
  });

  it('moves an ending with its paragraph when paragraphs swap', async () => {
    expect(await endingsAfter([BOMB, QUIET, WINDOW])).toEqual(['lands', 'holds', 'opens']);
  });

  it('leaves a replaced paragraph without an ending, though the paragraph count is the same', async () => {
    expect(await endingsAfter([QUIET, 'A bird sang aloud.', WINDOW])).toEqual(['holds', null, 'opens']);
  });

  it('leaves an inserted paragraph without one, and drops a deleted paragraph\'s', async () => {
    expect(await endingsAfter(['A new line opened it.', QUIET, BOMB, WINDOW])).toEqual([null, 'holds', 'lands', 'opens']);
    expect(await endingsAfter([BOMB, WINDOW])).toEqual(['lands', 'opens']);
  });
});

describe('a carried handoff is found again as two adjacent sentences', () => {
  const DOOR = [
    'The door was shut. She knocked twice. Nobody came. She knocked again, louder.',
    'Inside, a clock ticked. It ticked on and on.'
  ];
  const body: Body = {
    version: 1,
    rhythm: {
      endings: ['opens', 'holds'],
      movement: 'Short sentences that stop and start again.',
      evidence: [{ para: 1, quote: 'The door was shut.' }],
      handoffs: [{
        from: { para: 1, quote: 'She knocked twice' },
        to: { para: 1, quote: 'Nobody came' },
        carried: 'The knocking.',
        changes: 'No one answers it.',
        effect: 'continues'
      }],
      friction: 'Endings are one reading aloud among several.'
    }
  };
  const assembleOn = (paragraphs: readonly string[]) => {
    const decoded = decodeLightboxGroup(frame('D', body), { group: 'D', lenses: ['rhythm'], columnCount: paragraphs.length });
    let id = 0;
    return assembleLightboxGroup(decoded, {
      verifier: createLightboxQuoteVerifier(paragraphs),
      counter: createLightboxTermCounter(paragraphs),
      mintId: () => `h${++id}`
    });
  };
  const carryOnto = (after: readonly string[]) => {
    const read = assembleOn(DOOR);
    const group: LightboxReadingGroup = {
      group: 'D', status: 'ok', lenses: ['rhythm'], tiles: read.tiles, withheldBlocks: read.withheldBlocks,
      withheldClaims: read.withheldClaims, frictions: read.frictions, quoteChecks: read.quoteChecks
    };
    const [carried] = carryLightboxReadings([group], { readAgainst: 'old', paragraphs: after, averageWordsPerSentence: 4 });
    return carried;
  };
  const handoffs = (group: { tiles: LightboxReadingGroup['tiles'] }) => group.tiles.flatMap((tile) =>
    (tile.kind === 'handoff' ? [[tile.from.paragraph, tile.from.text, tile.to.paragraph, tile.to.text]] : []));

  it('withholds it once a sentence stands between its two, as a fresh read of that text does', () => {
    const after = ['The door was shut. She knocked twice. A dog barked. Nobody came.', DOOR[1]];
    const carried = carryOnto(after);
    expect(handoffs(carried)).toEqual([]);
    expect(carried.withheldClaims.map((claim) => [claim.kind, claim.reason]))
      .toEqual([['handoff', LIGHTBOX_GATE_REASONS.handoffNotAdjacent.carried]]);
    expect(assembleOn(after).withheldClaims.map((claim) => claim.reason)).toEqual([LIGHTBOX_GATE_REASONS.handoffNotAdjacent.fresh]);
  });

  it('follows its sentences to the paragraph that now holds them', () => {
    const carried = carryOnto(['A new opening line.', ...DOOR]);
    expect(handoffs(carried)).toEqual([[2, 'She knocked twice', 2, 'Nobody came']]);
    expect(carried.tiles.find((tile) => tile.kind === 'handoff')?.evidence.map((quote) => quote.paragraph)).toEqual([2, 2]);
  });

  it('withholds it, counting the lost sentence, once one of its sentences is gone', () => {
    const carried = carryOnto(['The door was shut. She knocked twice. Somebody came at last.', DOOR[1]]);
    expect(carried.withheldClaims).toEqual([expect.objectContaining({
      kind: 'handoff', reason: LIGHTBOX_GATE_REASONS.handoffGone.carried, quotes: [{ paragraph: 1, reason: 'no-longer-in-chapter' }]
    })]);
  });
});

describe('a carried numbers reading is held to the figures the new board measures', () => {
  const ALICE = readWorkedExample('D').paragraphs;
  const numbersBody = (): Body => ({ version: 1, numbers: (framedJson(readWorkedExample('D').response) as Body).numbers });
  const readings = (group: LightboxReadingGroup) => ({
    drawn: group.tiles.map((tile) => (tile.kind === 'number-usage' ? tile.stat : tile.kind)),
    withheld: group.withheldClaims.map((claim) => [claim.title, claim.reason])
  });

  it('keeps each reading while its figure stands out and its quotes hold an instance', async () => {
    const edited = ALICE.map((text, index) => (index === 0 ? `${text} Again.` : text));
    const { group } = await carriedD(ALICE, edited, ['numbers'], numbersBody());
    expect(readings(group)).toEqual({ drawn: ['sentence-length', 'dialogue'], withheld: [] });
  });

  it('withholds a reading whose figure no longer stands out once the text changes', async () => {
    // ¶5 and ¶6 become speech: dialogue is no longer far below the writer's average.
    const spoken = ALICE.map((text, index) => (index === 4 || index === 5 ? `“${text}”` : text));
    const { changed, group } = await carriedD(ALICE, spoken, ['numbers'], numbersBody());
    expect(changed.measured.numbers.rows.find((row) => row.stat === 'dialogue')?.standout).toBeUndefined();
    expect(readings(group).drawn).toEqual(['sentence-length']);
    expect(readings(group).withheld).toEqual([['Dialogue', LIGHTBOX_GATE_REASONS.numberNotStandout.carried]]);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
