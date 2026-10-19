/**
 * Stale readings (ADR 2026-10-19 D4): when the chapter changes, the board's
 * readings stay, marked stale, every quote checked again against the new
 * paragraphs and every count recounted; an unchanged re-read changes
 * nothing, and a fresh reading clears the mark. The readings are group A's
 * worked example, decoded and verified by the production pipeline against
 * its own excerpt of "Alice's Adventures in Wonderland" (1865, public domain).
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { LightboxService, LightboxSourceInput } from '@/infrastructure/lightbox/LightboxService';
import {
  LIGHTBOX_CHANGED_WHILE_READING,
  carryLightboxReadings
} from '@/infrastructure/lightbox/LightboxStaleReadings';
import { settleLightboxGroup, startLightboxGroups } from '@/infrastructure/lightbox/LightboxReadingState';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

const PARAGRAPHS = readWorkedExample('A').paragraphs;
const CHAPTER = PARAGRAPHS.join('\n\n');
const HASH = lightboxContentHash(CHAPTER);

const tileTitled = (group: LightboxReadingGroup, title: string): LightboxReadingTile | undefined =>
  group.tiles.find((tile) => tile.title === title);

/** ¶6 without the words "and then dipped suddenly down, so suddenly that". */
function withoutTheDrop(paragraphs: readonly string[]): string[] {
  return paragraphs.map((paragraph, index) => (index === 5
    ? 'The rabbit-hole went straight on like a tunnel for some way, and Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.'
    : paragraph));
}

describe('carrying readings onto a changed text (D4)', () => {
  const read = readGroup('A');

  it('marks every lens stale with the hash it was read against, and keeps each quote that still stands', () => {
    const [carried] = carryLightboxReadings([read], { readAgainst: HASH, paragraphs: PARAGRAPHS, averageWordsPerSentence: 9 });
    expect(carried.staleLenses).toEqual(read.lenses.map((lens) => ({ lens, readAgainst: HASH })));
    expect(carried.tiles.map((tile) => tile.id)).toEqual(read.tiles.map((tile) => tile.id));
    expect(carried.tiles.flatMap((tile) => tile.evidence)).toEqual(read.tiles.flatMap((tile) => tile.evidence));
    expect(carried.withheldClaims).toEqual(read.withheldClaims);
  });

  it('moves a quote with its paragraph when a paragraph is inserted before it', () => {
    const inserted = [PARAGRAPHS[0], 'A paragraph the writer added after the heading.', ...PARAGRAPHS.slice(1)];
    const [carried] = carryLightboxReadings([read], { readAgainst: HASH, paragraphs: inserted, averageWordsPerSentence: 9 });
    const before = read.tiles.flatMap((tile) => tile.evidence);
    const after = carried.tiles.flatMap((tile) => tile.evidence);
    expect(after.map((quote) => quote.text)).toEqual(before.map((quote) => quote.text));
    expect(after.map((quote) => quote.paragraph)).toEqual(before.map((quote) => (quote.paragraph >= 2 ? quote.paragraph + 1 : quote.paragraph)));
    expect(carried.tiles.flatMap((tile) => tile.withheldQuotes)).toEqual([]);
    const down = tileTitled(carried, 'Going down')?.support.find((term) => term.term === 'down');
    // The heading (¶1) stays put; everything after it moves down one.
    expect(down?.paragraphs).toEqual(
      tileTitled(read, 'Going down')?.support[0].paragraphs.map((index) => (index >= 2 ? index + 1 : index))
    );
  });

  it('withholds a quote whose words are gone as no longer in the chapter, and recounts its terms', () => {
    const [carried] = carryLightboxReadings([read], {
      readAgainst: HASH,
      paragraphs: withoutTheDrop(PARAGRAPHS),
      averageWordsPerSentence: 9
    });
    const goingDown = tileTitled(carried, 'Going down');
    expect(goingDown?.evidence.map((quote) => quote.paragraph)).toEqual([5, 8]);
    expect(goingDown?.withheldQuotes).toEqual([{ paragraph: 6, reason: 'no-longer-in-chapter' }]);
    const countBefore = tileTitled(read, 'Going down')?.support.find((term) => term.term === 'down')?.count ?? 0;
    expect(goingDown?.support.find((term) => term.term === 'down')?.count).toBe(countBefore - 1);
    // The arc keeps its other peak.
    const arc = carried.tiles.find((tile) => tile.kind === 'tension-arc');
    expect(arc?.evidence.map((quote) => quote.paragraph)).toEqual([4]);
    expect(arc?.withheldQuotes).toEqual([{ paragraph: 6, reason: 'no-longer-in-chapter' }]);
  });

  it('withholds a claim left with no quote, by title, and a motif left in one paragraph', () => {
    const paragraphs = PARAGRAPHS.map((paragraph, index) => (index === 6
      ? paragraph.replace('here and there she saw maps and pictures hung upon pegs', 'here and there were things on pegs')
      : paragraph));
    const [carried] = carryLightboxReadings([read], { readAgainst: HASH, paragraphs, averageWordsPerSentence: 9 });
    expect(tileTitled(carried, 'Pictures and conversations')).toBeUndefined();
    expect(carried.withheldClaims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'motif',
        title: 'Pictures and conversations',
        reason: 'A motif recurs, but its quotes now stand in only one paragraph.',
        quotes: [{ paragraph: 7, reason: 'no-longer-in-chapter' }]
      })
    ]));
  });

  it('sets aside a group still being read, and leaves a group never read as it was', () => {
    const [running] = startLightboxGroups([read], [{ group: 'A', lenses: ['motif'] }], 'motif');
    const notRun: LightboxReadingGroup = { group: 'B', status: 'not-run', lenses: [], tiles: [], withheldBlocks: [], withheldClaims: [], frictions: [] };
    const [carried, untouched] = carryLightboxReadings([running, notRun], { readAgainst: HASH, paragraphs: PARAGRAPHS, averageWordsPerSentence: 9 });
    expect(carried).toMatchObject({ status: 'cancelled', error: LIGHTBOX_CHANGED_WHILE_READING });
    expect(carried.pending).toBeUndefined();
    expect(carried.tiles.length).toBe(read.tiles.length);
    expect(untouched).toBe(notRun);
  });

  it('keeps an already-stale lens on the hash it was first read against', () => {
    const [once] = carryLightboxReadings([read], { readAgainst: 'hash-1', paragraphs: PARAGRAPHS, averageWordsPerSentence: 9 });
    const [twice] = carryLightboxReadings([once], { readAgainst: 'hash-2', paragraphs: PARAGRAPHS, averageWordsPerSentence: 9 });
    expect(twice.staleLenses?.every((mark) => mark.readAgainst === 'hash-1')).toBe(true);
  });

  it('clears a lens\'s mark when a fresh reading of it lands, and keeps it when the re-read fails', () => {
    const [carried] = carryLightboxReadings([read], { readAgainst: HASH, paragraphs: PARAGRAPHS, averageWordsPerSentence: 9 });
    const motif = carried.tiles.filter((tile) => tile.lens === 'motif');
    const fresh = settleLightboxGroup(carried, {
      group: 'A', lenses: ['motif'], status: 'ok', tiles: motif, withheldBlocks: [], withheldClaims: [], frictions: [],
      quotesChecked: 1, quotesWithheld: 0
    }, 'motif');
    expect(fresh.staleLenses?.map((mark) => mark.lens)).not.toContain('motif');
    expect(fresh.staleLenses?.length).toBe((carried.staleLenses?.length ?? 0) - 1);

    const failed = settleLightboxGroup(carried, {
      group: 'A', lenses: ['motif'], status: 'failed', tiles: [], withheldBlocks: [], withheldClaims: [], frictions: [],
      error: 'nope', quotesChecked: 0, quotesWithheld: 0
    }, 'motif');
    expect(failed.staleLenses).toEqual(carried.staleLenses);

    const [restarted] = startLightboxGroups([carried], [{ group: 'A', lenses: read.lenses }]);
    expect(restarted.staleLenses).toBeUndefined();
  });
});

describe('LightboxService across a changed text (D4)', () => {
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
  const source = (text: string): LightboxSourceInput => ({
    kind: 'file',
    text,
    displayPath: 'Drafts/alice-1.md',
    sourceUri: 'file:///workspace/Drafts/alice-1.md',
    rereadPath: '/workspace/Drafts/alice-1.md'
  });
  async function boardOf(lightbox: LightboxService, text: string): Promise<LightboxBoard> {
    const result = await lightbox.buildBoard(source(text));
    if (result.kind !== 'board') {
      throw new Error('expected a board');
    }
    return result.board;
  }

  it('keeps the readings of a changed chapter on its new board, stale and checked again', async () => {
    const lightbox = service();
    const first = await boardOf(lightbox, CHAPTER);
    lightbox.updateReadings(first.boardId, (readings) => readings.map((group) => (group.group === 'A' ? readGroup('A') : group)));

    const changed = await boardOf(lightbox, withoutTheDrop(PARAGRAPHS).join('\n\n'));
    expect(changed.boardId).not.toBe(first.boardId);
    const [groupA, groupB] = changed.readings;
    expect(groupA.status).toBe('ok');
    expect(groupA.staleLenses?.every((mark) => mark.readAgainst === first.source.contentHash)).toBe(true);
    expect(groupA.tiles.flatMap((tile) => tile.withheldQuotes)).toEqual(expect.arrayContaining([
      { paragraph: 6, reason: 'no-longer-in-chapter' }
    ]));
    expect(groupB.status).toBe('not-run');
    expect(groupB.staleLenses).toBeUndefined();
    // The changed board's own text is what a later run reads.
    expect(lightbox.readingSource(changed.boardId)?.paragraphTexts[5]).not.toContain('dipped');
  });

  it('keeps an unchanged re-read exactly as it was: same board, readings, no stale mark', async () => {
    const lightbox = service();
    const first = await boardOf(lightbox, CHAPTER);
    lightbox.updateReadings(first.boardId, (readings) => readings.map((group) => (group.group === 'A' ? readGroup('A') : group)));
    const again = await boardOf(lightbox, CHAPTER);
    expect(again.boardId).toBe(first.boardId);
    expect(again.readings[0]).toEqual(readGroup('A'));
    expect(again.readings[0].staleLenses).toBeUndefined();
  });

  it('starts a changed board with no readings when nothing was read', async () => {
    const lightbox = service();
    await boardOf(lightbox, CHAPTER);
    const changed = await boardOf(lightbox, withoutTheDrop(PARAGRAPHS).join('\n\n'));
    expect(changed.readings.every((group) => group.status === 'not-run' && !group.staleLenses)).toBe(true);
  });
});
