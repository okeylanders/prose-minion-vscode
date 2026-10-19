/**
 * Stale tension (PR #150 F-06): a tension score belongs to the paragraphs it
 * was read on, not to a column position. Carrying the arc onto changed text
 * moves each score with its unchanged paragraph and leaves a changed or new
 * paragraph unscored, so no old score lands on a paragraph it never read.
 * Synthetic sentences written for these tests, through the real service.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxTensionArcTile } from '@messages';
import { LightboxService, LightboxSourceInput } from '@/infrastructure/lightbox/LightboxService';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxTension, lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { frame } from './lightboxReadingFixtures';

const QUIET = 'A quiet morning.';
const BOMB = 'A bomb exploded.';
const WINDOW = 'The window was open.';

function service(): LightboxService {
  let id = 0;
  return new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => `board-${++id}` }
  );
}

const source = (paragraphs: readonly string[]): LightboxSourceInput => ({
  kind: 'file',
  text: paragraphs.join('\n\n'),
  displayPath: 'Drafts/tension.md',
  sourceUri: 'file:///workspace/Drafts/tension.md',
  rereadPath: '/workspace/Drafts/tension.md'
});

async function boardOf(lightbox: LightboxService, paragraphs: readonly string[]): Promise<LightboxBoard> {
  const result = await lightbox.buildBoard(source(paragraphs));
  if (result.kind !== 'board') {
    throw new Error('expected a board');
  }
  return result.board;
}

/** Tension [1, 9, 1] on QUIET, BOMB, WINDOW, its peaks verified at ¶2 and ¶3. */
function tensionRead(board: LightboxBoard, paragraphs: readonly string[]): LightboxReadingGroup {
  const body = {
    version: 1,
    tension: {
      scores: [1, 9, 1],
      claim: 'The explosion is the peak.',
      peaks: [
        { para: 2, quote: 'A bomb exploded', note: 'The blast.' },
        { para: 3, quote: 'The window was open', note: 'The aftermath.' }
      ],
      friction: 'Three paragraphs is a short arc.'
    }
  };
  const decoded = decodeLightboxGroup(frame('A', body), { group: 'A', lenses: ['tension'], columnCount: 3 });
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => 'tension-1',
    columnKeys: lightboxColumnKeys(paragraphs, board.ribbon)
  });
  return {
    group: 'A', status: 'ok', lenses: ['tension'], tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

async function carriedArc(after: readonly string[]): Promise<LightboxTensionArcTile> {
  const lightbox = service();
  const before = [QUIET, BOMB, WINDOW];
  const first = await boardOf(lightbox, before);
  lightbox.updateReadings(first.boardId, (readings) => readings.map((group) => (group.group === 'A' ? tensionRead(first, before) : group)));
  const changed = await boardOf(lightbox, after);
  expect(changed.readings[0].staleLenses?.map((mark) => mark.lens)).toEqual(['tension']);
  const arc = changed.readings[0].tiles.find((tile): tile is LightboxTensionArcTile => tile.kind === 'tension-arc');
  if (!arc) {
    throw new Error('expected the carried arc');
  }
  expect(arc.scores).toHaveLength(changed.ribbon.length);
  return arc;
}

describe('carried tension scores follow their paragraphs (PR #150 F-06)', () => {
  it('keeps every score where every paragraph is unchanged, whatever else changed', async () => {
    expect((await carriedArc([QUIET, BOMB, WINDOW, 'A closing line.'])).scores).toEqual([1, 9, 1, null]);
    expect(carryLightboxTension({ scores: [1, 9, 1], columnKeys: ['a', 'b', 'c'] }, ['a', 'b', 'c']))
      .toEqual({ scores: [1, 9, 1], columnKeys: ['a', 'b', 'c'] });
    // An arc with no keys (read before keys were kept) projects nothing.
    expect(carryLightboxTension({ scores: [1, 9, 1], columnKeys: [] }, ['a', 'b', 'c']).scores).toEqual([null, null, null]);
  });

  it('moves the 9 with the explosion when the first two paragraphs swap, as its verified peak moves', async () => {
    const arc = await carriedArc([BOMB, QUIET, WINDOW]);
    expect(arc.scores).toEqual([9, 1, 1]);
    expect(arc.evidence.map((quote) => quote.paragraph)).toEqual([1, 3]);
  });

  it('leaves a replaced paragraph unscored, though the paragraph count is the same', async () => {
    expect((await carriedArc([QUIET, 'A bird sang.', WINDOW])).scores).toEqual([1, null, 1]);
  });

  it('leaves an inserted paragraph unscored and moves the rest with their paragraphs', async () => {
    expect((await carriedArc(['A new opening line.', QUIET, BOMB, WINDOW])).scores).toEqual([null, 1, 9, 1]);
  });

  it('drops a deleted paragraph\'s score and keeps the others in order', async () => {
    expect((await carriedArc([BOMB, WINDOW])).scores).toEqual([9, 1]);
  });
});
