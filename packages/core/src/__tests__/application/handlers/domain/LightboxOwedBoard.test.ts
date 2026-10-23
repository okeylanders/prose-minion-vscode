/**
 * `owedBoard`: what a save a finished run is owed writes at its turn in the
 * store's queue (PR #167 F-01 and its re-review). It writes the readings its
 * own run settled, exactly as captured, whatever has happened to the board
 * since (a group cleared and running, or cleared and stopped with nothing
 * back, or read again); from the board as it then stands it takes only the
 * writer's own: the file and revision the board holds, its name, and each
 * spark's set-aside mark.
 *
 * The board is real: the chapter (¶1–¶8 of "Alice's Adventures in
 * Wonderland", 1865, public domain) read through the production handlers
 * with the worked examples' replies (`lightboxBoardsHarness`). No provider is
 * called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType, type LightboxReadingGroup, type LightboxReadingGroupId, type LightboxSparkTile } from '@/shared/types/messages';
import { owedBoard } from '@/application/services/lightbox/LightboxBoardSaves';
import { setLightboxSparkDismissed } from '@/infrastructure/lightbox/LightboxSparkLane';
import type { LightboxSavableBoard } from '@/infrastructure/lightbox/LightboxService';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

/** The chapter boarded, saved and read for every call: the board a run's save captured. */
async function captured(): Promise<LightboxSavableBoard> {
  const host = createLightboxBoardsHost({
    respond: async (request) => ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined)
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  const savable = host.service.savable('board-1');
  if (!savable) {
    throw new Error('no board');
  }
  expect(savable.savedFileId).toBeDefined();
  return savable;
}

const group = (board: LightboxSavableBoard, id: LightboxReadingGroupId) =>
  board.board.readings.find((entry) => entry.group === id) as LightboxReadingGroup;
const sparks = (board: LightboxSavableBoard): LightboxSparkTile[] =>
  board.board.readings.flatMap((entry) => entry.tiles).filter((tile): tile is LightboxSparkTile => tile.kind === 'spark');
/** The board with group `id` replaced by `as`. */
function withGroup(board: LightboxSavableBoard, id: LightboxReadingGroupId, as: Partial<LightboxReadingGroup>): LightboxSavableBoard {
  return {
    ...board,
    board: { ...board.board, readings: board.board.readings.map((entry) => (entry.group === id ? { ...entry, ...as } : entry)) }
  };
}
/** Ownership as a later save or rewrite left it: a new revision, a name. */
const owned = (board: LightboxSavableBoard): LightboxSavableBoard => ({ ...board, savedRevision: 'revision-after', name: 'alice-1 - after' });

describe('owedBoard (PR #167 F-01)', () => {
  it('a group cleared and stopped with nothing back since (decision 42): the captured group, under the board\'s file, revision and name now', async () => {
    const owed = await captured();
    const now = owned(withGroup(owed, 'B', { status: 'cancelled', tiles: [], lenses: [], error: 'Stopped before this group came back.' }));

    const written = owedBoard(owed, now);

    expect(written.board.readings).toEqual(owed.board.readings);
    expect(written.board.rules).toEqual(owed.board.rules);
    expect(written).toMatchObject({ savedFileId: owed.savedFileId, savedRevision: 'revision-after', name: 'alice-1 - after' });
  });

  it('a group cleared and running since: the captured group; nothing in flight is written', async () => {
    const owed = await captured();
    const now = withGroup(owed, 'B', { status: 'running', tiles: [], lenses: [], pending: ['characters'] });

    const written = owedBoard(owed, now);

    expect(group(written, 'B')).toEqual(group(owed, 'B'));
    expect(written.board.readings.every((entry) => entry.status !== 'running' && entry.pending === undefined)).toBe(true);
  });

  it('a group read again since: still the captured group; the later run\'s own save writes the new one', async () => {
    const owed = await captured();
    const now = withGroup(owed, 'B', { tiles: group(owed, 'B').tiles.slice(0, 1) });

    expect(group(owedBoard(owed, now), 'B')).toEqual(group(owed, 'B'));
  });

  it('carries the writer\'s spark marks: one set aside since, and one brought back since', async () => {
    const owed = await captured();
    const [first, second] = sparks(owed);
    expect(second).toBeDefined();
    const markedBefore = setLightboxSparkDismissed(owed.board.readings, second.id, true);
    if (!markedBefore.ok) {
      throw new Error('could not mark');
    }
    // Captured with the second spark set aside; since, the first set aside and the second brought back.
    const capturedWithMark = { ...owed, board: { ...owed.board, readings: markedBefore.readings } };
    const setAside = setLightboxSparkDismissed(capturedWithMark.board.readings, first.id, true);
    const broughtBack = setAside.ok ? setLightboxSparkDismissed(setAside.readings, second.id, false) : setAside;
    if (!broughtBack.ok) {
      throw new Error('could not mark');
    }
    const now = withGroup({ ...capturedWithMark, board: { ...capturedWithMark.board, readings: broughtBack.readings } }, 'B', { status: 'cancelled', tiles: [], lenses: [] });

    const written = owedBoard(capturedWithMark, now);

    const marks = Object.fromEntries(sparks(written).map((tile) => [tile.id, tile.dismissedOrder]));
    expect(marks[first.id]).toBe(sparks(now).find((tile) => tile.id === first.id)?.dismissedOrder);
    expect(marks[first.id]).toBeDefined();
    expect(marks[second.id]).toBeUndefined();
    // Nothing else moved: group B is the captured one.
    expect(group(written, 'B')).toEqual(group(capturedWithMark, 'B'));
  });

  it('a spark the board no longer holds (its group cleared since) keeps the mark it was captured with', async () => {
    const owed = await captured();
    const [spark] = sparks(owed);
    const marked = setLightboxSparkDismissed(owed.board.readings, spark.id, true);
    if (!marked.ok) {
      throw new Error('could not mark');
    }
    const capturedWithMark = { ...owed, board: { ...owed.board, readings: marked.readings } };
    const now = withGroup(capturedWithMark, 'C', { status: 'cancelled', tiles: [], lenses: [] });

    expect(sparks(owedBoard(capturedWithMark, now)).find((tile) => tile.id === spark.id)?.dismissedOrder).toBeDefined();
  });

  it('with no board now (gone, or replaced by a snapshot of the same id): the captured board as it was', async () => {
    const owed = await captured();
    expect(owedBoard(owed, undefined)).toBe(owed);
  });
});
