/**
 * Group D as the webview words it (Slice 4B), pure: shares of the host's
 * tier counts, a tally of the read endings by column, the endings lane's
 * honest notes, sentence lengths per column, and where a measured figure
 * sits on its bar. Nothing here counts the chapter; every number is the
 * host's. Boards are the hand-built fixtures (words from "Alice's Adventures
 * in Wonderland", 1865, public domain).
 */
import type { LightboxBoard, LightboxNumberRow, LightboxReadingGroup } from '@messages';
import { buildLightboxRibbon } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  lightboxBaselineLine,
  lightboxEndingTally,
  lightboxEndingsLane,
  lightboxNumberBar,
  lightboxNumberValue,
  lightboxSentenceColumns,
  lightboxStandoutLabel,
  lightboxTierShares,
  lightboxTierSummary
} from '@hooks/domain/lightbox/lightboxCraft';
import { makeBoard } from './lightboxBoardFixtures';
import { makeReadBoard, readGroup } from './lightboxReadingBoardFixtures';

const withGroupD = (board: LightboxBoard, group: LightboxReadingGroup): LightboxBoard =>
  ({ ...board, readings: board.readings.map((candidate) => (candidate.group === 'D' ? group : candidate)) });

describe('the tier mix', () => {
  it('shares the host\'s counts among the beats it found, in bar order', () => {
    const tile = { tiers: { functional: 6, decorated: 1, weighted: 1, signature: 8 }, classified: 16 };
    expect(lightboxTierShares(tile).map((share) => [share.tier, share.count, share.percent])).toEqual([
      ['functional', 6, 38], ['decorated', 1, 6], ['weighted', 1, 6], ['signature', 8, 50]
    ]);
    expect(lightboxTierSummary(tile)).toBe('16 beats classified and found: 6 functional stock, 1 decorated, 1 stock carrying weight, 8 signature');
    expect(lightboxTierShares({ tiers: { functional: 0, decorated: 0, weighted: 0, signature: 0 }, classified: 0 }).map((share) => share.percent))
      .toEqual([0, 0, 0, 0]);
  });
});

describe('paragraph endings', () => {
  it('tallies endings by column, naming the last paragraph of each column that opens, and counts unread columns', () => {
    const ribbon = [{ from: 1, to: 2 }, { from: 3, to: 3 }, { from: 4, to: 6 }, { from: 7, to: 7 }] as LightboxBoard['ribbon'];
    expect(lightboxEndingTally({ endings: ['opens', 'lands', 'opens', null] }, ribbon))
      .toEqual({ lands: 1, holds: 0, opens: 2, opensAt: [2, 6], unread: 1 });
  });

  it('draws the lane only from a reading that landed on these columns, and says why otherwise', () => {
    const read = makeReadBoard();
    const lane = lightboxEndingsLane(read, true);
    expect(lane.endings).toEqual(['opens', 'holds', 'opens', 'opens', 'opens', 'opens', 'lands', 'lands']);
    expect(lane).toMatchObject({ stale: false, note: 'How each paragraph ends, as read: lands, holds or opens.' });
    expect(lightboxEndingsLane(read, false)).toEqual({ stale: false, note: 'The rhythm lens is off.' });
    expect(lightboxEndingsLane(makeBoard(8), true)).toEqual({ stale: false, note: 'Endings are a reading. Not analyzed yet.' });

    const groupD = readGroup('D');
    const stale = withGroupD(read, { ...groupD, staleLenses: [{ lens: 'rhythm', readAgainst: 'old' }] });
    expect(lightboxEndingsLane(stale, true)).toMatchObject({
      stale: true, note: 'Read against an earlier version of this chapter: endings stand only on paragraphs unchanged since.'
    });
    // Slice 4J: read again, the earlier endings stay drawn until the new ones land.
    const reading = withGroupD(read, { ...groupD, status: 'running', pending: ['rhythm'] });
    expect(lightboxEndingsLane(reading, true)).toMatchObject({ endings: lane.endings, note: 'How each paragraph ends, as read: lands, holds or opens.' });
    // A first read in flight: nothing to keep, so the lane says it is reading.
    const first = withGroupD(read, { ...groupD, status: 'running', pending: ['rhythm'], tiles: groupD.tiles.filter((tile) => tile.lens !== 'rhythm') });
    expect(lightboxEndingsLane(first, true).note).toBe('Reading how the paragraphs end…');
    // A first read that failed: no lens of the group was read.
    const failed = withGroupD(read, { ...groupD, status: 'failed', lenses: [], tiles: [], error: 'No answer.' });
    expect(lightboxEndingsLane(failed, true)).toEqual({ stale: false, note: 'The paragraph endings did not come back.' });

    // Six columns now, eight endings read: nothing drawn, and the reason given.
    const fewer = { ...read, ribbon: buildLightboxRibbon(read.paragraphs.slice(0, 6), 96) };
    expect(lightboxEndingsLane(fewer, true).endings).toBeUndefined();
    expect(lightboxEndingsLane(fewer, true).note).toContain('cannot be drawn on these');
  });
});

describe('sentence lengths', () => {
  it('takes each column\'s mean and longest from the host\'s per-paragraph sentence lengths', () => {
    const board = makeBoard(6);
    const columns = lightboxSentenceColumns(board);
    expect(columns[0]).toEqual({ from: 1, to: 1, mean: 8, longest: 8, sentences: 4 });
    expect(columns[2]).toEqual({ from: 3, to: 3, mean: 40, longest: 40, sentences: 1 });
    const merged = lightboxSentenceColumns({ ...board, ribbon: [{ ...board.ribbon[0], from: 1, to: 3 }] });
    // (8 × 8 + 40) / 9 sentences.
    expect(merged).toEqual([{ from: 1, to: 3, mean: 11.6, longest: 40, sentences: 9 }]);
  });
});

describe('a measured figure', () => {
  const row = (overrides: Partial<LightboxNumberRow>): LightboxNumberRow => ({
    stat: 'intensifiers', label: 'Intensifiers and fillers', unit: 'per 1,000 words', value: 12, instances: 9,
    instanceLabel: 'intensifiers and fillers', paragraphs: [2, 4], ...overrides
  });

  it('sits on a bar from 0 to 100, with the preset\'s band and the writer\'s mark', () => {
    const bar = lightboxNumberBar(row({ value: 12, range: { min: 2, max: 8, status: 'above' }, writer: { average: 3, ratio: 4 } }));
    expect(bar).toEqual({ band: { left: 13.3, width: 40 }, writer: 20, dot: 80 });
    expect(lightboxNumberBar(row({ value: 0 }))).toEqual({ dot: 0 });
  });

  it('words its value, its ratio and its range, and whether it stands out', () => {
    expect(lightboxNumberValue(row({ writer: { average: 3, ratio: 4 }, range: { min: 2, max: 8, status: 'above' } })))
      .toBe('12 per 1,000 words · 4× your average of 3 · above the preset\'s 2–8');
    expect(lightboxNumberValue(row({ writer: { average: 0 } }))).toBe('12 per 1,000 words · none in your other chapters');
    expect(lightboxStandoutLabel(row({ standout: { direction: 'above', against: ['standards', 'writer'] } })))
      .toBe('Stands out above the preset and your average');
    expect(lightboxStandoutLabel(row({}))).toBeUndefined();
  });

  it('says what the figures are measured against, or why there is no average', () => {
    expect(lightboxBaselineLine({ rows: [], baseline: { kind: 'measured', group: 'chapters', files: 11, words: 20_000, capped: true } }, true))
      .toBe('Against your other chapters (11 files, 20,000 words, capped) and your publishing preset\'s ranges.');
    expect(lightboxBaselineLine({ rows: [], baseline: { kind: 'absent', note: 'No files.' } }, false)).toBe('No files.');
    expect(lightboxBaselineLine({ rows: [], baseline: { kind: 'absent', note: 'No files.' } }, true))
      .toBe('Against your publishing preset\'s ranges. No files.');
  });
});
