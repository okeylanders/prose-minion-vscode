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
