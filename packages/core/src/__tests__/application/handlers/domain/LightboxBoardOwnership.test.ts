/**
 * Saved-board ownership (Slice 5A; epic decision 29, PR #148 F-01). Opening
 * a saved board, and restoring one after a reload, are source choices: each
 * takes the service's ticket before anything is awaited, so a newer source
 * wins over it and it wins over an older one. Neither may replace a board a
 * run is reading, whether the run was there first or started while the file
 * was read. An open made while a save is being written reads after that save
 * commits, so the board it opens keeps its own file.
 *
 * Real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`); only file reads, the store's file read and
 * write, and the engine's replies are held open, to order events exactly.
 * The chapters are "Alice's Adventures in Wonderland" (1865, public domain).
 * No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType } from '@/shared/types/messages';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { LIGHTBOX_BOARD_NOTICES } from '@/application/services/lightbox/LightboxBoardLibrary';
import { deferred } from './lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import {
  CHAPTER,
  CHAPTER_PATH,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsHostOptions
} from './lightboxBoardsHarness';

const FIRST = 'drafts-alice-1-md/2026-10-22T14-05-09-123Z.board.json';
const READ = 'drafts-alice-1-md/2026-10-22T14-06-09-123Z.board.json';
const OTHER_PATH = 'Drafts/alice-2.md';
const OTHER = 'Alice opened the little door and looked along the passage into the loveliest garden you ever saw.';

/** The engine's replies, held until `release()`. */
function heldReplies(): { respond: NonNullable<LightboxBoardsHostOptions['respond']>; release: () => void } {
  const gate = deferred<void>();
  return {
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      await gate.promise;
      return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
    },
    release: () => gate.resolve()
  };
}

/** A host with alice-1 boarded and read (FIRST and READ saved), and alice-2 in the workspace. */
async function readChapter(options: LightboxBoardsHostOptions = {}) {
  const host = createLightboxBoardsHost(options);
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  host.writeChapter(OTHER_PATH, OTHER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  return { host, tab };
}

describe('opening a saved board is a source choice (PR #148 F-01)', () => {
  it('never lets an open whose file is still being read replace a newer source', async () => {
    const { host, tab } = await readChapter();
    await tab.read();
    await quiet();
    const read = host.holdBoardRead();

    const opening = tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: FIRST });
    await tab.choose(OTHER_PATH);
    read.release();
    await opening;
    await quiet();

    expect(host.service.currentBoard()?.source.displayPath).toBe(OTHER_PATH);
    expect(tab.boards().map((board) => board?.source.displayPath ?? null)).toEqual([null, CHAPTER_PATH, CHAPTER_PATH, OTHER_PATH]);
    expect(host.logged()).toContain(`[LightboxBoardLibrary] Dropped the open of ${FIRST}: a newer source was chosen`);
    // The open's answer describes the board that won.
    expect(tab.shelves().find((answer) => answer.requestId === 'open-1')?.boardId).toBe('board-2');
  });

  it('wins over an older source whose file is still being read', async () => {
    const { host, tab } = await readChapter();
    await tab.read();
    await quiet();
    const read = host.holdRead(OTHER_PATH);

    const choosing = tab.choose(OTHER_PATH);
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: FIRST });
    read.release();
    await choosing;
    await quiet();

    expect(host.service.currentBoard()?.source.displayPath).toBe(CHAPTER_PATH);
    expect(host.service.currentBoard()?.readings.every((group) => group.status === 'not-run')).toBe(true);
    expect(host.logged()).toContain(`Dropped the outcome for ${OTHER_PATH}: a newer source was chosen`);
  });

  it('is refused at once while a run reads the board on screen, and the run lands and saves', async () => {
    const replies = heldReplies();
    const { host, tab } = await readChapter({ respond: replies.respond });
    await tab.read();
    const boardsBefore = tab.boards().length;

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: FIRST });

    expect(tab.shelves().at(-1)?.shelf.notice).toBe(LIGHTBOX_BOARD_NOTICES.reading);
    expect(tab.boards()).toHaveLength(boardsBefore);
    replies.release();
    await quiet();
    expect(host.service.currentBoard()?.readings.every((group) => group.status === 'ok')).toBe(true);
    expect(host.savedFiles()).toEqual([FIRST, READ]);
  });

  it('lets a run that started while the file was read keep its board', async () => {
    const replies = heldReplies();
    const { host, tab } = await readChapter({ respond: replies.respond });
    const read = host.holdBoardRead();

    const opening = tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: FIRST });
    await tab.read();
    read.release();
    await opening;

    expect(tab.shelves().find((answer) => answer.requestId === 'open-1')?.shelf.notice).toBe(LIGHTBOX_BOARD_NOTICES.reading);
    expect(host.runner.activeRun('board-1')?.token).toBe('run-1-token');
    replies.release();
    await quiet();
    expect(host.service.currentBoard()?.readings.every((group) => group.status === 'ok')).toBe(true);
    expect(host.savedFiles()).toEqual([FIRST, READ]);
  });
});

describe('a restore is a source choice too (epic decision 30)', () => {
  it('yields to a source chosen while its file is read', async () => {
    const { host, tab: first } = await readChapter();
    await first.read();
    await quiet();
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = next.openTab();
    const read = next.holdBoardRead();

    const mounting = tab.shelf(null);
    await tab.choose(OTHER_PATH);
    read.release();
    const answer = await mounting;

    expect(next.service.currentBoard()?.source.displayPath).toBe(OTHER_PATH);
    expect(answer.boardId).toBe('board-1');
    expect(answer.shelf.snapshot).toBeUndefined();
    expect(next.logged()).toContain(`[LightboxBoardLibrary] Dropped the restore of ${READ}: a newer source was chosen`);
  });
});

describe('an open waits for the save being written', () => {
  it('reads after the save commits, so the board it opens keeps its own file and the reload pointer', async () => {
    const { host, tab } = await readChapter();
    // Hold the run's save at its staging write.
    const write = deferred<void>();
    const writeFile = host.fileSystem.writeFile.bind(host.fileSystem);
    const spy = jest.spyOn(host.fileSystem, 'writeFile').mockImplementation(async (filePath, data) => {
      spy.mockRestore();
      await write.promise;
      return writeFile(filePath, data);
    });
    await tab.read();
    await quiet();

    const opening = tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: FIRST });
    await quiet();
    expect(host.service.currentBoard()?.readings.every((group) => group.status === 'ok')).toBe(true);
    write.resolve();
    await opening;

    expect(host.savedFiles()).toEqual([FIRST, READ]);
    expect(host.service.currentBoard()?.readings.every((group) => group.status === 'not-run')).toBe(true);
    const answer = tab.shelves().find((shelf) => shelf.requestId === 'open-1');
    expect(answer?.shelf.boards.map((board) => [board.fileId, board.onScreen])).toEqual([[READ, false], [FIRST, true]]);
    expect(answer?.shelf.snapshot?.fileId).toBe(FIRST);
    expect(host.memory.values.get('proseMinion.lightbox.lastBoardOnScreen')).toEqual({ root: '/workspace', fileId: FIRST });
  });
});
