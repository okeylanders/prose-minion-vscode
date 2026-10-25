/**
 * The save a finished run is owed (PR #167 F-01; Slice 5A.2, epic decision
 * 46). A run that landed a group queues its board's save; the store's queue
 * may hold it while the writer starts another run on the same board. At its
 * turn the save writes the settled board its run finished with, never the
 * board with a reading in flight, so a cancelled later run cannot leave the
 * landed reading off disk while the menu says Saved.
 *
 * The real Lightbox handlers, service, runner, store and library
 * (`lightboxBoardsHarness`), with the store's read of the board's file held
 * and group C's reply held. The chapter is ¶1–¶8 of "Alice's Adventures in
 * Wonderland" (1865, public domain). No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType, type LightboxBoard, type LightboxReadingGroupId } from '@/shared/types/messages';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { deferred } from './lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

/** The board's one file: its first save, measured, rewritten in place by each later save. */
const OWN = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';

function savedFile(host: ReturnType<typeof createLightboxBoardsHost>, fileId = OWN) {
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', fileId))));
  if (decoded.kind !== 'board') {
    throw new Error(`${fileId} does not read as a board`);
  }
  return decoded.file;
}

function savedBoard(host: ReturnType<typeof createLightboxBoardsHost>, fileId = OWN): LightboxBoard {
  const held = lightboxBoardOfFile(savedFile(host, fileId));
  if (held?.kind !== 'board') {
    throw new Error(`${fileId} does not read as a board`);
  }
  return held.board;
}

const status = (board: LightboxBoard | null | undefined, group: LightboxReadingGroupId) =>
  board?.readings.find((entry) => entry.group === group)?.status;

/** A host with the chapter measured and saved, whose group C replies wait for `release`. */
async function boarded() {
  const groupC = deferred<void>();
  const host = createLightboxBoardsHost({
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      if (groupOf(request) === 'C') {
        await groupC.promise;
      }
      return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  expect(host.savedFiles()).toEqual([OWN]);
  return { host, tab, releaseC: () => groupC.resolve() };
}

/** Group B read (Characters) while the store's read of the board's file is held, so its save waits in the queue. */
async function readBWithTheSaveHeld(host: Awaited<ReturnType<typeof boarded>>['host'], tab: Awaited<ReturnType<typeof boarded>>['tab']) {
  const read = host.holdBoardRead();
  await tab.press('characters');
  await quiet();
  expect(status(host.service.currentBoard(), 'B')).toBe('ok');
  // The save is owed and waiting: the file still holds the measured board.
  expect(status(savedBoard(host), 'B')).toBe('not-run');
  return read;
}

describe('a finished run\'s save, held in the queue while another run starts (PR #167 F-01)', () => {
  it('writes the settled reading it was owed, though a later run is in flight at its turn; a cancelled later run cannot take it off disk', async () => {
    const { host, tab, releaseC } = await boarded();
    const read = await readBWithTheSaveHeld(host, tab);
    // Genre, group C: its reply waits, so the board is running when B's save gets its turn.
    await tab.press('genre');
    await quiet();
    expect(status(host.service.currentBoard(), 'C')).toBe('running');

    read.release();
    await quiet();
    expect(status(savedBoard(host), 'B')).toBe('ok');
    expect(status(savedBoard(host), 'C')).toBe('not-run');

    // C is cancelled before any group comes back: nothing saves after it, and nothing needs to.
    await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: 'board-1', token: 'run-2-token' });
    releaseC();
    await quiet();

    expect(host.savedFiles()).toEqual([OWN]);
    expect(savedBoard(host).readings.find((group) => group.group === 'B')?.tiles.length).toBeGreaterThan(0);
    const shelf = (await tab.shelf('board-1')).shelf;
    expect(shelf.availability).toEqual({ kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false });
    expect(shelf.boards.find((row) => row.onScreen)?.lenses).toEqual(['characters']);
    expect(host.logged()).not.toContain('would not read back whole');

    // A new session restores group B from disk.
    const reloaded = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const again = reloaded.openTab();
    await again.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await again.shelf(null);
    await quiet();
    expect(status(reloaded.service.currentBoard(), 'B')).toBe('ok');
  });

  it('control, no second run: the owed save writes group B, and nothing failed', async () => {
    const { host, tab } = await boarded();
    const read = await readBWithTheSaveHeld(host, tab);
    read.release();
    await quiet();

    expect(host.savedFiles()).toEqual([OWN]);
    expect(status(savedBoard(host), 'B')).toBe('ok');
    expect((await tab.shelf('board-1')).shelf.availability).toMatchObject({ lastSaveFailed: false });
  });

  it('control, the later run succeeds: its own save adds group C to the same file, after B\'s', async () => {
    const { host, tab, releaseC } = await boarded();
    const read = await readBWithTheSaveHeld(host, tab);
    await tab.press('genre');
    await quiet();
    read.release();
    await quiet();
    releaseC();
    await quiet();

    expect(host.savedFiles()).toEqual([OWN]);
    expect([status(savedBoard(host), 'B'), status(savedBoard(host), 'C')]).toEqual(['ok', 'ok']);
    expect((await tab.shelf('board-1')).shelf.availability).toMatchObject({ lastSaveFailed: false });
  });

  it('a save whose writes failed says so; the next save, in place, says the boards are saved again (PR #167 N-01)', async () => {
    const { host, tab } = await boarded();
    const writes = jest.spyOn(host.fileSystem, 'writeFile').mockRejectedValue(new Error('EIO: i/o error'));
    await tab.press('characters');
    await quiet();
    expect((await tab.shelf('board-1')).shelf.availability).toMatchObject({ lastSaveFailed: true });
    expect(status(savedBoard(host), 'B')).toBe('not-run');
    writes.mockRestore();

    await tab.press('voice');
    await quiet();

    expect(host.savedFiles()).toEqual([OWN]);
    expect(status(savedBoard(host), 'B')).toBe('ok');
    expect((await tab.shelf('board-1')).shelf.availability).toMatchObject({ lastSaveFailed: false });
  });

  it('keeps the old Opinion through an owed save (decision 47): a failed Opinion call\'s save, held while the Opinion runs again, writes the failed call and the old Opinion, never the run', async () => {
    const engine: { failF: boolean; holdF?: ReturnType<typeof deferred<void>> } = { failF: false };
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
    const opinion = host.service.currentBoard()?.readings.find((group) => group.group === 'F')?.tiles;
    expect(opinion?.length).toBeGreaterThan(0);
    expect(savedBoard(host).readings.find((group) => group.group === 'F')?.tiles).toEqual(opinion);

    // The Opinion's call fails; its save waits in the queue.
    engine.failF = true;
    const read = host.holdBoardRead();
    await tab.run({ mode: 'group', group: 'F' });
    await quiet();
    expect(status(host.service.currentBoard(), 'F')).toBe('failed');

    // The writer runs the Opinion again: the old one stays on the board, running, until a new one lands.
    engine.failF = false;
    engine.holdF = deferred<void>();
    await tab.run({ mode: 'group', group: 'F' });
    await quiet();
    expect(host.service.currentBoard()?.readings.find((group) => group.group === 'F')).toMatchObject({ status: 'running', pending: ['opinion'], tiles: opinion });

    // The owed save writes the failed call, the old Opinion with it.
    read.release();
    await quiet();
    expect(savedBoard(host).readings.find((group) => group.group === 'F')).toMatchObject({ status: 'failed', tiles: opinion });
    expect(savedBoard(host).readings.find((group) => group.group === 'F')?.pending).toBeUndefined();

    // The second call is stopped: nothing saves, and the file still holds the old Opinion.
    const run = host.runner.activeRun('board-1');
    await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: run?.boardId, token: run?.token });
    engine.holdF.resolve();
    await quiet();

    expect(host.savedFiles()).toEqual([OWN]);
    expect(savedBoard(host).readings.find((group) => group.group === 'F')).toMatchObject({ status: 'failed', tiles: opinion });
    expect((await tab.shelf('board-1')).shelf.availability).toMatchObject({ lastSaveFailed: false });
    const reloaded = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const again = reloaded.openTab();
    await again.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await again.shelf(null);
    await quiet();
    expect(reloaded.service.currentBoard()?.readings.find((group) => group.group === 'F')?.tiles).toEqual(opinion);
  });

  describe('a call run on its own after it, stopped with nothing back (PR #167 F-01 re-review)', () => {
    /** A host with the chapter measured and saved, whose group B replies wait while `engine.holdB` is set. */
    async function boardedHoldingB() {
      const engine: { holdB?: ReturnType<typeof deferred<void>> } = {};
      const host = createLightboxBoardsHost({
        respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
          if (groupOf(request) === 'B' && engine.holdB) {
            await engine.holdB.promise;
          }
          return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
        }
      });
      host.writeChapter(CHAPTER_PATH, CHAPTER);
      const tab = host.openTab();
      await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
      await tab.shelf(null);
      await tab.choose(CHAPTER_PATH);
      await quiet();
      expect(host.savedFiles()).toEqual([OWN]);
      const read = await readBWithTheSaveHeld(host, tab);
      const landed = host.service.currentBoard()?.readings.find((group) => group.group === 'B')?.tiles ?? [];
      expect(landed.length).toBeGreaterThan(0);
      // Group B again, on its own (decision 42): cleared on screen, its reply held.
      engine.holdB = deferred<void>();
      await tab.run({ mode: 'group', group: 'B' });
      await quiet();
      expect(host.service.currentBoard()?.readings.find((group) => group.group === 'B')).toMatchObject({ status: 'running', tiles: [] });
      return { host, tab, read, landed, engine };
    }

    async function stop(host: Awaited<ReturnType<typeof boardedHoldingB>>['host'], tab: Awaited<ReturnType<typeof boardedHoldingB>>['tab']) {
      const run = host.runner.activeRun('board-1');
      expect(run?.groups).toEqual(['B']);
      await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: run?.boardId, token: run?.token });
      await quiet();
      const progress = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload;
      expect(progress).toMatchObject({ phase: 'cancelled', groups: ['B'], groupsBack: 0 });
      expect(host.service.currentBoard()?.readings.find((group) => group.group === 'B')).toMatchObject({ status: 'cancelled', tiles: [] });
    }

    async function expectBOnDisk(host: Awaited<ReturnType<typeof boardedHoldingB>>['host'], tab: Awaited<ReturnType<typeof boardedHoldingB>>['tab'], tiles: unknown[], lenses = ['characters']) {
      expect(host.savedFiles()).toEqual([OWN]);
      expect(savedBoard(host).readings.find((group) => group.group === 'B')).toMatchObject({ status: 'ok', tiles });
      const shelf = (await tab.shelf('board-1')).shelf;
      expect(shelf.availability).toMatchObject({ lastSaveFailed: false });
      expect(shelf.boards.find((row) => row.onScreen)?.lenses).toEqual(lenses);
      const reloaded = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
      const again = reloaded.openTab();
      await again.route(MessageType.LIGHTBOX_REQUEST_BOARD);
      await again.shelf(null);
      await quiet();
      expect(reloaded.service.currentBoard()?.readings.find((group) => group.group === 'B')).toMatchObject({ status: 'ok', tiles });
    }

    it('the reviewer\'s order, Stop before the queue lets the save go: the save writes the B its run landed, not the stopped one', async () => {
      const { host, tab, read, landed, engine } = await boardedHoldingB();
      await stop(host, tab);

      read.release();
      await quiet();
      engine.holdB?.resolve();
      await quiet();

      await expectBOnDisk(host, tab, landed);
    });

    it('control, the queue lets the save go before the Stop: the same B on disk, and the Stop saves nothing', async () => {
      const { host, tab, read, landed, engine } = await boardedHoldingB();
      read.release();
      await quiet();
      expect(savedBoard(host).readings.find((group) => group.group === 'B')).toMatchObject({ status: 'ok', tiles: landed });
      const bytes = host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN));

      await stop(host, tab);
      engine.holdB?.resolve();
      await quiet();

      expect(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN))).toEqual(bytes);
      await expectBOnDisk(host, tab, landed);
    });

    it('control, the rerun lands after the queue lets the save go: its own save writes the new B over the one owed', async () => {
      const { host, tab, read, landed, engine } = await boardedHoldingB();
      read.release();
      await quiet();
      engine.holdB?.resolve();
      await quiet();

      const fresh = host.service.currentBoard()?.readings.find((group) => group.group === 'B');
      expect(fresh?.status).toBe('ok');
      expect(fresh?.tiles.some((tile) => landed.some((old) => old.id === tile.id))).toBe(false);
      // The call reads every lens of B that is on (decision 42), so its own save lists them.
      await expectBOnDisk(host, tab, fresh?.tiles ?? [], fresh?.lenses);
    });
  });

  it('a later name given while the save waits is the one it writes', async () => {
    const { host, tab } = await boarded();
    const read = await readBWithTheSaveHeld(host, tab);
    await tab.press('genre');
    await quiet();
    // The rename queues behind the held save; the board takes the name at once.
    const renaming = tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename', boardId: 'board-1', fileId: null, name: 'alice-1 - before the change' });
    read.release();
    await renaming;
    await quiet();

    expect(savedFile(host).board.name).toBe('alice-1 - before the change');
    expect(status(savedBoard(host), 'B')).toBe('ok');
  });
});
