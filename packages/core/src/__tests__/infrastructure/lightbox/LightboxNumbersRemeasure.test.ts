/**
 * A board rebuilt from the same text is measured again (PR #155 F-01): the
 * writer's average or the preset can change what stands out while every
 * word stays put. Through the real service, a number usage stays only while
 * its figure stands out the same way: same direction, same bases, same
 * reference. Groups A–C and the other craft lenses are untouched. The board
 * reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain);
 * the writer's averages are synthetic counts.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { LightboxService, type LightboxSourceInput } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxWriterAverages } from '@/infrastructure/lightbox/LightboxNumbers';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { readWorkedExample } from './lightboxReadingFixtures';
import { WRITER_AVERAGES } from './lightboxCraftFixtures';

const ALICE = readWorkedExample('D').paragraphs;
const SOURCE: LightboxSourceInput = {
  kind: 'file',
  text: ALICE.join('\n\n'),
  displayPath: 'Drafts/alice-1.md',
  sourceUri: 'file:///workspace/Drafts/alice-1.md',
  rereadPath: '/workspace/Drafts/alice-1.md'
};
const ABSENT: LightboxWriterAverages = { summary: { kind: 'absent', note: 'No chapter or manuscript files are configured.' } };

/** A writer like the fixture's, with some counts changed. */
const writerWith = (counts: Partial<NonNullable<LightboxWriterAverages['counts']>>): LightboxWriterAverages => ({
  summary: WRITER_AVERAGES.summary,
  counts: { ...(WRITER_AVERAGES.counts as NonNullable<LightboxWriterAverages['counts']>), ...counts }
});

/** A service whose writer's average and preset ranges the test can change between builds. */
function measuredService() {
  const measurement: { writer: LightboxWriterAverages; standards?: object } = { writer: WRITER_AVERAGES };
  let id = 0;
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => (measurement.standards ? { ...stats, comparison: measurement.standards } : stats) } as never,
    { mintBoardId: () => `board-${++id}` },
    { measure: async () => measurement.writer }
  );
  return { service, measurement };
}

async function build(service: LightboxService): Promise<LightboxBoard> {
  const result = await service.buildBoard(SOURCE);
  if (result.kind !== 'board') {
    throw new Error('expected a board');
  }
  return result.board;
}

/** A group read on `board` as the runner reads it, with the worked example's answer. */
function read(board: LightboxBoard, group: LightboxReadingGroupId): LightboxReadingGroup {
  const example = readWorkedExample(group);
  const decoded = decodeLightboxGroup(example.response, { group, lenses: example.lenses, columnCount: board.ribbon.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(ALICE),
    counter: createLightboxTermCounter(ALICE),
    mintId: () => `lbt-${group}-${++id}`,
    columnKeys: lightboxColumnKeys(ALICE, board.ribbon),
    standouts: lightboxStandoutRows(board.measured.numbers.rows)
  });
  return {
    group, status: 'ok', lenses: example.lenses, tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

/** Read groups A and D, then build the same text again after `change`. */
async function remeasure(change: (measurement: ReturnType<typeof measuredService>['measurement']) => void) {
  const { service, measurement } = measuredService();
  const first = await build(service);
  const groupA = read(first, 'A');
  const groupD = read(first, 'D');
  service.updateReadings(first.boardId, (groups) => groups.map((group) =>
    (group.group === 'A' ? groupA : group.group === 'D' ? groupD : group)));
  const before = service.currentBoard() as LightboxBoard;
  change(measurement);
  const after = await build(service);
  const groupOf = (board: LightboxBoard, id: LightboxReadingGroupId) => board.readings.find((group) => group.group === id) as LightboxReadingGroup;
  return { before, after, groupOf };
}

const usages = (group: LightboxReadingGroup) => group.tiles.flatMap((tile) => (tile.kind === 'number-usage' ? [tile.stat] : []));
const withheldUsages = (group: LightboxReadingGroup) => group.withheldClaims
  .filter((claim) => claim.kind === 'number-usage')
  .map((claim) => [claim.title, claim.reason]);
const otherTiles = (group: LightboxReadingGroup) => group.tiles.filter((tile) => tile.kind !== 'number-usage');

describe('number usages on a board measured again from the same text (PR #155 F-01)', () => {
  it('withholds every usage once the writer\'s average is gone and nothing stands out, and Bring refuses them', async () => {
    // Control: measured the same way again, every reading stays as it was.
    const same = await remeasure(() => undefined);
    expect(same.after.boardId).toBe(same.before.boardId);
    expect(same.after.readings).toEqual(same.before.readings);

    const { before, after, groupOf } = await remeasure((measurement) => { measurement.writer = ABSENT; });
    expect(after.boardId).toBe(before.boardId);
    expect(after.measured.numbers.rows.filter((row) => row.standout)).toEqual([]);
    // Intensifiers stand out too, but craft steering reads them (Slice 4F): the numbers lens read only these two.
    expect(usages(groupOf(before, 'D'))).toEqual(['sentence-length', 'dialogue']);
    expect(usages(groupOf(after, 'D'))).toEqual([]);
    expect(withheldUsages(groupOf(after, 'D'))).toEqual([
      ['Sentence length', LIGHTBOX_GATE_REASONS.numberNotStandout.carried],
      ['Dialogue', LIGHTBOX_GATE_REASONS.numberNotStandout.carried]
    ]);
    // Nothing else moves: group A, and the stock and rhythm readings.
    expect(groupOf(after, 'A')).toEqual(groupOf(before, 'A'));
    expect(otherTiles(groupOf(after, 'D'))).toEqual(otherTiles(groupOf(before, 'D')));
    expect(groupOf(after, 'D').staleLenses).toBeUndefined();
    // A usage the board no longer holds cannot be brought.
    const old = groupOf(before, 'D').tiles.find((tile) => tile.kind === 'number-usage');
    expect(prepareLightboxTileHandoff({ kind: 'tile', boardId: after.boardId, tileId: old?.id as string }, after, ALICE).ok).toBe(false);
  });

  it('withholds only the usage whose reference changed while its figure still stands out', async () => {
    // The writer now averages 12 words a sentence, not 14.3: long sentences are measured from 12.
    const { before, after, groupOf } = await remeasure((measurement) => { measurement.writer = writerWith({ sentences: 1_667 }); });
    const reference = (board: LightboxBoard) => board.measured.numbers.rows.find((row) => row.stat === 'sentence-length')?.standout;
    expect(reference(before)).toMatchObject({ direction: 'above', reference: 14 });
    expect(reference(after)).toMatchObject({ direction: 'above', reference: 12 });
    expect(usages(groupOf(after, 'D'))).toEqual(['dialogue']);
    expect(withheldUsages(groupOf(after, 'D'))).toEqual([['Sentence length', LIGHTBOX_GATE_REASONS.numberRemeasured]]);
  });

  it('withholds the usage whose direction changed while its figure still stands out', async () => {
    // The writer's other chapters now hold hardly any dialogue: this chapter's share stands out above it, not below.
    const { after, groupOf } = await remeasure((measurement) => { measurement.writer = writerWith({ dialogueWords: 600 }); });
    expect(after.measured.numbers.rows.find((row) => row.stat === 'dialogue')?.standout).toMatchObject({ direction: 'above' });
    expect(usages(groupOf(after, 'D'))).toEqual(['sentence-length']);
    expect(withheldUsages(groupOf(after, 'D'))).toEqual([['Dialogue', LIGHTBOX_GATE_REASONS.numberRemeasured]]);
  });

  it('withholds the usages whose bases changed when only the preset changed', async () => {
    const { after, groupOf } = await remeasure((measurement) => {
      measurement.standards = {
        items: [
          { key: 'avg_words_per_sentence', label: 'Words per sentence', value: 29.9, standard: { min: 10, max: 14 }, status: 'above' },
          { key: 'dialogue_percentage', label: 'Dialogue %', value: 12.2, standard: { min: 50, max: 65 }, status: 'below' }
        ]
      };
    });
    expect(after.measured.numbers.rows.filter((row) => row.standout).map((row) => [row.stat, row.standout?.against])).toEqual([
      ['sentence-length', ['standards', 'writer']], ['dialogue', ['standards', 'writer']], ['intensifiers', ['writer']]
    ]);
    expect(usages(groupOf(after, 'D'))).toEqual([]);
    expect(withheldUsages(groupOf(after, 'D'))).toEqual([
      ['Sentence length', LIGHTBOX_GATE_REASONS.numberRemeasured],
      ['Dialogue', LIGHTBOX_GATE_REASONS.numberRemeasured]
    ]);
  });
});
