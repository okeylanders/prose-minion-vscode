/**
 * The Opinion keeps its reading until a new one lands (epic decision 47).
 *
 * When the Opinion's call runs on its own (its Analyze or Re-analyze, or
 * Run F / Rerun F: `{ mode: 'group', group: 'F' }`), the old Opinion is not
 * cleared when the call starts. It stays on the board, its group `running`
 * with the Opinion pending, until:
 * - **the new one lands**, and replaces it whole;
 * - **the call fails**, and it stays exactly as it was, standing and stale
 *   marks included, with the failure's reason; the board then saved holds
 *   it, and a reload restores it;
 * - **the writer stops it**, and it stays as it was; nothing is saved.
 * Since Slice 4J (decision 49) every call keeps its readings this way, and
 * so does the Opinion in a run of every call: decision 47 is its special
 * case. The press, adoption and observation guards hold.
 *
 * Real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`); only the engine's replies are stand-ins, held
 * or failed to order events exactly. The chapter is "Alice's Adventures in
 * Wonderland" (1865, public domain). No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType } from '@/shared/types/messages';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingGroupId } from '@/shared/types/messages';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { deferred } from './lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

type Host = ReturnType<typeof createLightboxBoardsHost>;
type Tab = ReturnType<Host['openTab']>;

const OPINION = { mode: 'group', group: 'F', lens: 'opinion' } as const;
const RUN_F = { mode: 'group', group: 'F' } as const;
/** What the stand-in engine says when it fails a call; the host shows only its category. */
const UNEXPECTED = 'The call failed before a reading came back. Press Finish or Analyze to try again.';
const STOPPED = 'Stopped before this group came back.';

/** A host whose group F reply can be held, then failed, and a tab with the chapter boarded and every call read. */
async function readBoard() {
  const engine: { holdF?: ReturnType<typeof deferred<void>>; failF: boolean } = { failF: false };
  const host = createLightboxBoardsHost({
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      const group = groupOf(request);
      if (group === 'F' && engine.holdF) {
        await engine.holdF.promise;
      }
      if (group === 'F' && engine.failF) {
        throw new Error('stub provider: no reply');
      }
      return ok(group, group === 'F' ? opinionReplyFor(request) : undefined);
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  expect(groupOn(host, 'F')).toMatchObject({ status: 'ok', lenses: ['opinion'] });
  return { host, tab, engine };
}

const boardIdOf = (host: Host): string => host.service.currentBoard()?.boardId as string;
const groupOn = (host: Host, group: LightboxReadingGroupId): LightboxReadingGroup | undefined =>
  host.service.currentBoard()?.readings.find((entry) => entry.group === group);
const posted = (tab: Tab, group: LightboxReadingGroupId): Array<LightboxReadingGroup | undefined> =>
  tab.boards().map((board) => board?.readings.find((entry) => entry.group === group));
const progress = (tab: Tab) => tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS)
  .map((message) => message.payload);
/** The Opinion as it stands on the board: its tiles, withheld lists, lenses and stale marks. */
const held = (group: LightboxReadingGroup | undefined) => ({
  lenses: group?.lenses,
  tiles: group?.tiles,
  withheldBlocks: group?.withheldBlocks,
  withheldClaims: group?.withheldClaims,
  frictions: group?.frictions,
  quoteChecks: group?.quoteChecks,
  staleLenses: group?.staleLenses
});

/** A saved file's bytes, as text. */
function fileBytes(host: Host, fileId: string): string {
  return new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', fileId)));
}

/** The board a saved file holds. */
function savedBoard(host: Host, fileId: string): LightboxBoard {
  const decoded = decodeLightboxBoardFile(fileBytes(host, fileId));
  if (decoded.kind !== 'board') {
    throw new Error(`${fileId} does not read as a board`);
  }
  const board = lightboxBoardOfFile(decoded.file);
  if (board.kind !== 'board') {
    throw new Error(`${fileId} holds several sources`);
  }
  return board.board;
}

describe('the Opinion run on its own keeps the old one until the new one lands (decision 47)', () => {
  it('keeps the old Opinion on the board while the new one is weighed, then replaces it whole', async () => {
    const { host, tab, engine } = await readBoard();
    const before = groupOn(host, 'F');
    const boards = tab.boards().length;
    engine.holdF = deferred<void>();

    await tab.run(OPINION);
    await quiet();

    // Started: running, the Opinion pending, the old one still there.
    expect(groupOn(host, 'F')).toMatchObject({ status: 'running', pending: ['opinion'] });
    expect(held(groupOn(host, 'F'))).toEqual(held(before));
    expect(posted(tab, 'F').slice(boards)[0]).toMatchObject({ status: 'running', pending: ['opinion'], tiles: before?.tiles });
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'started', groups: ['F'] });

    engine.holdF.resolve();
    engine.holdF = undefined;
    await quiet();

    const after = groupOn(host, 'F');
    expect(after).toMatchObject({ status: 'ok', lenses: ['opinion'] });
    expect(after?.error).toBeUndefined();
    expect(after?.pending).toBeUndefined();
    expect(after?.tiles).toHaveLength(1);
    // Replaced whole: none of the old Opinion's tiles is left.
    const oldIds = before?.tiles.map((tile) => tile.id) ?? [];
    expect(after?.tiles.some((tile) => oldIds.includes(tile.id))).toBe(false);
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'finished', groups: ['F'], groupsBack: 1 });
  });

  it.each([['its Analyze', OPINION], ['Run F', RUN_F]] as const)(
    'pressed from %s, keeps the old Opinion exactly as it was when the call fails, its standing and stale marks too, and says why',
    async (_from, scope) => {
      const { host, tab, engine } = await readBoard();
      // A stale mark the failure must keep, as a changed chapter would leave it.
      host.service.updateReadings(boardIdOf(host), (readings) => readings.map((group) => (group.group === 'F'
        ? { ...group, staleLenses: [{ lens: 'opinion' as const, readAgainst: 'an-earlier-text' }] }
        : group)));
      const board = host.service.currentBoard() as LightboxBoard;
      const before = groupOn(host, 'F');
      const standing = lightboxOpinionStanding(lightboxOpinionTile(board)!, board);
      const saved = host.savedFiles();
      expect(saved).toHaveLength(1);
      const bytesBefore = fileBytes(host, saved[0]);
      engine.failF = true;

      await tab.run(scope);
      await quiet();

      const after = groupOn(host, 'F');
      expect(after).toMatchObject({ status: 'failed', error: UNEXPECTED });
      expect(held(after)).toEqual(held(before));
      expect(after?.staleLenses).toEqual([{ lens: 'opinion', readAgainst: 'an-earlier-text' }]);
      const now = host.service.currentBoard() as LightboxBoard;
      expect(lightboxOpinionStanding(lightboxOpinionTile(now)!, now)).toEqual(standing);
      expect(progress(tab).at(-1)).toMatchObject({ phase: 'finished', groups: ['F'] });

      // The board saved after the failed call still holds the old Opinion, and a reload restores it.
      // One file per board (decision 46): the save rewrites the board's own file in place.
      expect(host.savedFiles()).toEqual(saved);
      expect(fileBytes(host, saved[0])).not.toEqual(bytesBefore);
      // The shelf that save pushes is observed after the ones before it, and lists the save as holding the Opinion.
      const shelves = tab.shelves();
      expect(shelves.at(-1)?.observation).toBeGreaterThan(shelves.at(-2)?.observation ?? -1);
      expect(shelves.at(-1)?.shelf.boards[0]).toMatchObject({ fileId: saved[0] });
      expect(shelves.at(-1)?.shelf.boards[0].lenses).toContain('opinion');
      expect(shelves.at(-1)?.shelf.boards[0].staleLenses).toContain('opinion');
      const file = savedBoard(host, saved[0]).readings.find((group) => group.group === 'F');
      expect(file).toMatchObject({ status: 'failed', error: UNEXPECTED });
      expect(file?.tiles).toEqual(before?.tiles);
      const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
      const reopened = next.openTab();
      await reopened.route(MessageType.LIGHTBOX_REQUEST_BOARD);
      await reopened.shelf(null);
      expect(next.service.currentBoard()?.readings.find((group) => group.group === 'F')?.tiles).toEqual(before?.tiles);
    }
  );

  it('keeps the old Opinion as it was when the writer stops the call, and saves nothing', async () => {
    const { host, tab, engine } = await readBoard();
    const before = groupOn(host, 'F');
    const saved = host.savedFiles();
    const bytesBefore = fileBytes(host, saved.at(-1) as string);
    engine.holdF = deferred<void>();
    await tab.run(RUN_F);
    await quiet();
    const run = host.runner.activeRun(boardIdOf(host));
    expect(run?.groups).toEqual(['F']);

    await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: run?.boardId, token: run?.token });
    engine.holdF.resolve();
    await quiet();

    const after = groupOn(host, 'F');
    expect(after).toMatchObject({ status: 'cancelled', error: STOPPED });
    expect(held(after)).toEqual(held(before));
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'cancelled', groups: ['F'] });
    expect(host.savedFiles()).toEqual(saved);
    // Nothing is saved: the board's one file (decision 46) is byte for byte as it was.
    expect(fileBytes(host, saved.at(-1) as string)).toBe(bytesBefore);
    // The last save still holds the Opinion that was on the board.
    expect(savedBoard(host, saved.at(-1) as string).readings.find((group) => group.group === 'F')?.tiles).toEqual(before?.tiles);
  });

  it('decision 49 generalizes it: another call run on its own keeps its readings too, and so does the Opinion in a run of every call', async () => {
    const { host, tab, engine } = await readBoard();
    const boards = tab.boards().length;
    const b = groupOn(host, 'B');
    await tab.run({ mode: 'group', group: 'B' });
    await quiet();
    expect(posted(tab, 'B').slice(boards)[0]).toMatchObject({ status: 'running', tiles: b?.tiles, lenses: b?.lenses });

    const again = tab.boards().length;
    const f = groupOn(host, 'F');
    engine.holdF = deferred<void>();
    await tab.run({ mode: 'all' });
    await quiet();
    expect(posted(tab, 'F').slice(again)[0]).toMatchObject({ status: 'running', tiles: f?.tiles, lenses: ['opinion'], pending: ['opinion'] });
    engine.holdF.resolve();
    engine.holdF = undefined;
    await quiet();
    expect(groupOn(host, 'F')).toMatchObject({ status: 'ok', lenses: ['opinion'] });
    expect(groupOn(host, 'F')?.tiles.some((tile) => f?.tiles.some((old) => old.id === tile.id))).toBe(false);
  });

  it('the guards hold: a saved board opened while the new Opinion is weighed is refused, and the new one lands on its own board', async () => {
    const { host, tab, engine } = await readBoard();
    const [first] = host.savedFiles();
    const before = groupOn(host, 'F');
    engine.holdF = deferred<void>();
    await tab.run(OPINION);
    await quiet();
    expect(groupOn(host, 'F')?.status).toBe('running');

    // The open is refused while a run reads the board on screen (Slice 5A): the board, and its old Opinion, stay.
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    await quiet();
    expect(host.logged()).toContain(`Open of ${first} refused: a run is reading the board on screen`);
    expect(groupOn(host, 'F')).toMatchObject({ status: 'running', pending: ['opinion'] });
    expect(held(groupOn(host, 'F'))).toEqual(held(before));

    engine.holdF.resolve();
    engine.holdF = undefined;
    await quiet();
    expect(groupOn(host, 'F')).toMatchObject({ status: 'ok', lenses: ['opinion'] });
    expect(groupOn(host, 'F')?.tiles.some((tile) => before?.tiles.some((old) => old.id === tile.id))).toBe(false);
    expect(host.service.currentBoard()?.readings.filter((group) => group.group !== 'F').every((group) => group.status === 'ok')).toBe(true);
  });
});
