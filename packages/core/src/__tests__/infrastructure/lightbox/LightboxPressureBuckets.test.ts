/**
 * The Pressure lane on a bucketed ribbon (PR #156 F-01): a thread planted and
 * resolved in one paragraph is open in no paragraph, so it adds nothing to
 * any column, wherever that paragraph falls in a column of several (its
 * start, its end, inside), fresh and carried. A thread that is open across a
 * paragraph still counts in the column holding it. Boards are built by the
 * production LightboxService (192 paragraphs make 96 columns of two; 288
 * make 96 of three); readings go through the production codec, verifier and
 * assembly, and the carry through the production rebuild. The text is
 * synthetic lines written for this test.
 */
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { lightboxPressureLane } from '@shared/constants/lightboxPlot';
import { lightboxPressureLaneView } from '@hooks/domain/lightbox/lightboxPlot';
import { readStory, tilesOf } from './lightboxPlotFixtures';

const LINE = 'The afternoon went slowly on the bank by the river.';
const JAR = 'She takes down a jar. To her disappointment it was empty.';
const TURN = 'She turns the corner. The hall is long and low.';

/** `count` paragraphs of `LINE`, with each `[paragraph, text]` placed at its paragraph (from 1). */
function chapter(count: number, ...texts: Array<[number, string]>): string[] {
  const placed = new Map(texts);
  return Array.from({ length: count }, (_unused, index) => placed.get(index + 1) ?? `${LINE} (${index + 1})`);
}

function newService(): LightboxService {
  let boards = 0;
  return new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => `board-${++boards}` }
  );
}

async function build(service: LightboxService, paragraphs: readonly string[]): Promise<{ board: LightboxBoard; carried: boolean }> {
  const built = await service.buildBoard({ kind: 'file', text: paragraphs.join('\n\n'), displayPath: 'chapter.md' });
  if (built.kind !== 'board') {
    throw new Error('expected a board');
  }
  return { board: built.board, carried: built.carried };
}

type Quote = { para: number; quote: string };
const thread = (planted: Quote, resolution: Quote | null) =>
  ({ question: 'What happens here?', planted, escalations: [], resolution, dormant: false });

/** Group E's pressure lens alone, read from `threads` on `paragraphs`. */
function pressureGroup(paragraphs: readonly string[], threads: object[]): LightboxReadingGroup {
  const body = { version: 1, pressure: { threads, friction: 'Each thread here is a test witness.' } };
  const { assembled } = readStory(body, paragraphs, ['pressure']);
  expect(assembled.withheldClaims).toEqual([]);
  return {
    group: 'E', status: 'ok', lenses: ['pressure'], tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

const laneOf = (board: LightboxBoard, group: LightboxReadingGroup) =>
  lightboxPressureLane(tilesOf(group, 'pressure-thread'), board.ribbon);

describe('a same-paragraph thread on a bucketed ribbon (PR #156 F-01)', () => {
  it('adds nothing to a column of two, whether its paragraph ends or opens the column', async () => {
    const atEnd = chapter(192, [2, JAR]);
    const { board } = await build(newService(), atEnd);
    expect(board.ribbon).toHaveLength(96);
    expect(board.ribbon[0]).toMatchObject({ from: 1, to: 2 });
    const end = pressureGroup(atEnd, [thread({ para: 2, quote: 'She takes down a jar' }, { para: 2, quote: 'it was empty' })]);
    expect(laneOf(board, end).every((count) => count === 0)).toBe(true);

    const atStart = chapter(192, [1, JAR]);
    const start = pressureGroup(atStart, [thread({ para: 1, quote: 'She takes down a jar' }, { para: 1, quote: 'it was empty' })]);
    expect(laneOf((await build(newService(), atStart)).board, start).every((count) => count === 0)).toBe(true);
  });

  it('adds nothing to a column of three when its paragraph is inside the column', async () => {
    const inside = chapter(288, [2, JAR]);
    const { board } = await build(newService(), inside);
    expect(board.ribbon[0]).toMatchObject({ from: 1, to: 3 });
    const group = pressureGroup(inside, [thread({ para: 2, quote: 'She takes down a jar' }, { para: 2, quote: 'it was empty' })]);
    expect(laneOf(board, group).every((count) => count === 0)).toBe(true);
  });

  it('still counts a thread open across a paragraph of the column (controls)', async () => {
    const paragraphs = chapter(192, [1, TURN], [2, JAR], [3, TURN]);
    const { board } = await build(newService(), paragraphs);
    // Planted in ¶1, resolved in ¶2: open in ¶1, so the ¶1–¶2 column counts it.
    const across = pressureGroup(paragraphs, [thread({ para: 1, quote: 'She turns the corner' }, { para: 2, quote: 'it was empty' })]);
    expect(laneOf(board, across).slice(0, 2)).toEqual([1, 0]);
    // Planted in ¶2, resolved in ¶3: open in ¶2 (the ¶1–¶2 column), closed by ¶3 (the ¶3–¶4 column).
    const next = pressureGroup(paragraphs, [thread({ para: 2, quote: 'She takes down a jar' }, { para: 3, quote: 'The hall is long and low' })]);
    expect(laneOf(board, next).slice(0, 2)).toEqual([1, 0]);
    // Still open at the end: every column from its plant on.
    const open = pressureGroup(paragraphs, [thread({ para: 2, quote: 'She takes down a jar' }, null)]);
    expect(laneOf(board, open).every((count) => count === 1)).toBe(true);
  });

  it('adds nothing after a carry onto changed text either, and the lane the webview draws says so', async () => {
    const service = newService();
    const before = chapter(192, [2, JAR], [3, TURN]);
    const first = await build(service, before);
    const group = pressureGroup(before, [
      thread({ para: 2, quote: 'She takes down a jar' }, { para: 2, quote: 'it was empty' }),
      thread({ para: 2, quote: 'She takes down a jar' }, { para: 3, quote: 'The hall is long and low' })
    ]);
    service.updateReadings(first.board.boardId, (readings) => readings.map((candidate) => (candidate.group === 'E' ? group : candidate)));
    // ¶100 changes: the readings come along stale, re-found on the new text.
    const second = await build(service, before.map((text, index) => (index === 99 ? 'The light changed.' : text)));
    expect(second.carried).toBe(true);
    const carried = second.board.readings.find((candidate) => candidate.group === 'E') as LightboxReadingGroup;
    expect(carried.staleLenses?.map((mark) => mark.lens)).toEqual(['pressure']);
    expect(tilesOf(carried, 'pressure-thread')).toHaveLength(2);
    // Only the ¶2→¶3 thread is open anywhere: in ¶2, the first column.
    expect(laneOf(second.board, carried).slice(0, 3)).toEqual([1, 0, 0]);
    expect(lightboxPressureLaneView(second.board, true).counts?.slice(0, 3)).toEqual([1, 0, 0]);
  });
});
