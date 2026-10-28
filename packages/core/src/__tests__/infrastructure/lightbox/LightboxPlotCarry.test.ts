/**
 * Group E carried onto changed text (ADR 2026-10-19 D4; Slice 4C): the
 * movements as a set, each starting where its boundary quote now stands and
 * withheld whole when they no longer tile the chapter (never an old range
 * on new paragraphs); engagement with its movements; a thread re-found,
 * re-ordered and its span recomputed; an object recounted, its arc held to
 * order and its "planted, unused" checked again; the lanes following
 * content; and the Sections lane measured afresh with every board. The text
 * is the worked example's ¶1–¶8 of "Alice's Adventures in Wonderland"
 * (1865, public domain), edited for each case.
 */
import type { LightboxReadingGroup } from '@messages';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { LIGHTBOX_PLOT_GATE_REASONS } from '@/infrastructure/lightbox/LightboxPlotGates';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { lightboxEngagementColumns, lightboxPressureLane } from '@shared/constants/lightboxPlot';
import { ALICE, readStory, storyBody, storyGroup, tilesOf } from './lightboxPlotFixtures';

const R = LIGHTBOX_PLOT_GATE_REASONS;
const carry = (after: readonly string[], group: LightboxReadingGroup = storyGroup()): LightboxReadingGroup =>
  carryLightboxReadings([group], { readAgainst: 'old-hash', paragraphs: after, averageWordsPerSentence: 9 })[0];
const columnsOf = (paragraphs: readonly string[]) => paragraphs.map((_text, index) => ({ from: index + 1, to: index + 1 }));
const withheldOf = (group: LightboxReadingGroup, kind: string) =>
  group.withheldClaims.filter((claim) => claim.kind === kind).map((claim) => [claim.title, claim.reason]);

/** ¶`a` and ¶`b` (from 1) swapped. */
function swap(paragraphs: readonly string[], a: number, b: number): string[] {
  const next = [...paragraphs];
  [next[a - 1], next[b - 1]] = [next[b - 1], next[a - 1]];
  return next;
}

describe('group E carried onto changed text (Slice 4C)', () => {
  it('moves the movements with their boundaries after an insertion, and keeps engagement on them', () => {
    const after = [...ALICE.slice(0, 4), 'She ran across the field after it.', ...ALICE.slice(4)];
    const carried = carry(after);
    const movements = tilesOf(carried, 'movement');
    expect(movements.map((movement) => [movement.ordinal, movement.from, movement.to, movement.boundary.paragraph])).toEqual([
      [1, 1, 3, 1], [2, 4, 6, 4], [3, 7, 9, 7]
    ]);
    expect(movements[2].paragraphs).toEqual([7, 8, 9]);
    const [template] = tilesOf(carried, 'template');
    expect(template.engagement.map((mark) => [movements.findIndex((movement) => movement.id === mark.movementId), mark.level]))
      .toEqual([[0, 'low'], [1, 'high'], [2, 'medium']]);
    // The engagement lane follows the movements' new ranges, column by column.
    expect(lightboxEngagementColumns(template, movements, columnsOf(after)))
      .toEqual(['low', 'low', 'low', 'high', 'high', 'high', 'medium', 'medium', 'medium']);
    expect(carried.staleLenses?.map((mark) => mark.lens)).toEqual(['template', 'pressure', 'artifacts', 'summary']);
  });

  it('withholds the whole set, and engagement with it, when an edit deletes a boundary', () => {
    const after = ALICE.map((text, index) => (index === 5 ? text.replace('The rabbit-hole went straight on like a tunnel for some way, and then', 'It') : text));
    const carried = carry(after);
    expect(tilesOf(carried, 'movement')).toEqual([]);
    expect(withheldOf(carried, 'movement')).toEqual([['Movements', R.boundaryGone.carried]]);
    expect(carried.withheldClaims.find((claim) => claim.title === 'Movements')?.quotes).toEqual([{ paragraph: 6, reason: 'no-longer-in-chapter' }]);
    expect(tilesOf(carried, 'template')[0].engagement).toEqual([]);
    expect(withheldOf(carried, 'template')).toEqual([['Engagement', R.engagementNoMovements.carried]]);
    // Its quote is gone from one step of the rabbit-hole's arc too; the step before it stands.
    expect(tilesOf(carried, 'artifact').find((tile) => tile.title === 'The rabbit-hole')?.arc.map((step) => step.step)).toEqual(['dived into']);
    expect(carried.quoteChecks.find((checks) => checks.lens === 'summary')?.withheld).toBe(1);
  });

  it('withholds the set when the first boundary no longer opens the chapter, or the boundaries stand out of order', () => {
    const before = carry(['The day was hot.', ...ALICE]);
    expect(withheldOf(before, 'movement')).toEqual([['Movements', R.notFromStart.carried]]);
    // ¶4 and ¶6 swap places: movement II's opening now follows movement III's.
    const reordered = carry(swap(ALICE, 4, 6));
    expect(withheldOf(reordered, 'movement')).toEqual([['Movements', R.emptyRange.carried]]);
    expect(tilesOf(reordered, 'movement')).toEqual([]);
  });

  it('re-finds a thread\'s quotes, recomputes its span, and withholds one whose order breaks', () => {
    const inserted = carry([...ALICE.slice(0, 5), 'She thought of nothing at all.', ...ALICE.slice(5)]);
    const threads = tilesOf(inserted, 'pressure-thread');
    expect(threads.map((thread) => thread.span)).toEqual([{ from: 4, to: 9 }, { from: 5, to: 9 }, { from: 7, to: 9 }, { from: 8, to: 8 }]);
    expect(threads[2].paragraphs).toEqual([7, 8, 9]);
    // The lane counts where the threads now stand.
    expect(lightboxPressureLane(threads, columnsOf(Array(9).fill('')))).toEqual([0, 0, 0, 1, 2, 2, 3, 3, 3]);

    // ¶6 and ¶7 swap: the fall's escalation now stands before its plant.
    const swapped = carry(swap(ALICE, 6, 7));
    expect(withheldOf(swapped, 'pressure-thread')).toEqual([['Will the fall ever end?', R.threadOrder.carried]]);
    const jar = tilesOf(swapped, 'pressure-thread').find((thread) => thread.title === 'What is in the jar she takes down?');
    expect(jar?.span).toEqual({ from: 6, to: 6 });
  });

  it('withholds a carried thread whose resolution is gone, rather than showing it open', () => {
    const carried = carry(ALICE.map((text, index) => (index === 6 ? text.replace('to her great disappointment it was empty', 'it was full') : text)));
    expect(withheldOf(carried, 'pressure-thread')).toEqual([['What is in the jar she takes down?', R.resolutionGone.carried]]);
  });

  it('recounts an object\'s mentions, holds its arc to order again, and checks "planted, unused" against the new counts', () => {
    const thinned = ALICE.map((text, index) => (index === 3 ? text.replace(', or a watch to take out of it', '') : text));
    const watch = tilesOf(carry(thinned), 'artifact').find((tile) => tile.title === 'The watch');
    expect(watch).toMatchObject({ mentions: 1, firstParagraph: 4 });

    const reordered = tilesOf(carry(swap(ALICE, 4, 6)), 'artifact').find((tile) => tile.title === 'The rabbit-hole');
    expect(reordered?.arc.map((step) => [step.step, step.quote.paragraph])).toEqual([['dived into', 6]]);
    // Withheld at the paragraph it now stands in, before the step it follows.
    expect(reordered?.withheldQuotes).toEqual([{ paragraph: 4, reason: 'out-of-order' }]);

    // The book is mentioned again in ¶8, far from its plant: the reading's "unused" no longer stands.
    const later = ALICE.map((text, index) => (index === 7 ? `${text} She thought of the book.` : text));
    const book = tilesOf(carry(later), 'artifact').find((tile) => tile.title === "Her sister's book");
    expect(book).toMatchObject({ plantedUnused: false, unusedWithheld: R.unusedFar, mentions: 3 });
    // Carried back onto the original text, the flag stands again: it was the reading's, checked each time.
    const back = tilesOf(carry(ALICE, carry(later)), 'artifact').find((tile) => tile.title === "Her sister's book");
    expect(back?.plantedUnused).toBe(true);
    expect(back && 'unusedWithheld' in back).toBe(false);
  });

  it('carries onto unchanged text as a fresh read of it draws', () => {
    const carried = carry(ALICE);
    const fresh = readStory(storyBody(), ALICE).assembled;
    const project = (group: { tiles: LightboxReadingGroup['tiles'] }) => group.tiles.map(({ id: _id, ...tile }) => tile);
    expect(project(carried)).toEqual(project(fresh));
  });

  it('measures the Sections lane afresh with every board, never carried or stale', async () => {
    const service = new LightboxService(
      new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
      new WordFrequencyService({} as ToolOptionsProvider),
      new StyleFlagsService(),
      { enrichWithStandards: async (stats: object) => stats } as never,
      { mintBoardId: (() => { let id = 0; return () => `board-${++id}`; })() }
    );
    const source = (paragraphs: readonly string[]) => ({ kind: 'file' as const, text: paragraphs.join('\n\n'), displayPath: 'alice.md' });
    const first = await service.buildBoard(source(ALICE));
    if (first.kind !== 'board') {
      throw new Error('expected a board');
    }
    expect(first.board.measured.sections.signal).toBe('none');
    service.updateReadings(first.board.boardId, (readings) => readings.map((group) => (group.group === 'E' ? storyGroup() : group)));
    const changed = [...ALICE.slice(0, 3), '***', ...ALICE.slice(3)];
    const second = await service.buildBoard(source(changed));
    if (second.kind !== 'board') {
      throw new Error('expected a board');
    }
    expect(second.carried).toBe(true);
    expect(second.board.measured.sections.sections.map((section) => [section.from, section.to, section.label]))
      .toEqual([[1, 3, 'Scene 1'], [4, 9, 'Scene 2']]);
    const group = second.board.readings.find((candidate) => candidate.group === 'E') as LightboxReadingGroup;
    expect(group.staleLenses?.map((mark) => mark.lens)).toEqual(['template', 'pressure', 'artifacts', 'summary']);
    // The break paragraph moved movement II's boundary on by one; III follows; the set still tiles ¶1–¶9.
    expect(tilesOf(group, 'movement').map((movement) => [movement.from, movement.to])).toEqual([[1, 4], [5, 6], [7, 9]]);
  });
});
