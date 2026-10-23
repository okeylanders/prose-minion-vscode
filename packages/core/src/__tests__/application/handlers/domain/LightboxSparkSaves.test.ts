/**
 * A spark set aside saves at once (Slice 5A.1; epic decision 35), through
 * the real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`).
 *
 * - "Not for me", and its Undo, rewrite the file that holds the board on
 *   screen in place: no new file, so no new row, and a reload brings the
 *   spark back set aside.
 * - A board no file holds (session-only here) keeps today's behaviour: the
 *   mark is the in-memory board's, and its next save carries it.
 * - The file is found when the rewrite's turn comes: a spark set aside while
 *   a run's save is still being written marks the file that save writes,
 *   even for a board no file held before it.
 * - **Only the spark acted on changes in the file** (PR #164 F-03). Two
 *   windows on one saved board, each setting a different spark aside, keep
 *   both marks, in the order they were made, though the second window never
 *   saw the first's; one spark's actions stay last-wins. A spark set aside
 *   behind a rename, and a switch to another source, still marks the
 *   original board's file.
 * - A restore whose file is gone forgets the reload pointer (5A tech debt),
 *   so the next session does not try it again.
 *
 * The chapter is ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain), read from the worked examples. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType, type LightboxBoard, type LightboxSparkTile } from '@/shared/types/messages';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_POINTER_KEY } from '@/infrastructure/storage/LightboxBoardStore';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';
import { deferred } from './lightboxHandlerHarness';

type Host = ReturnType<typeof createLightboxBoardsHost>;

const sparksOf = (board: LightboxBoard | undefined): LightboxSparkTile[] =>
  (board?.readings ?? []).flatMap((group) => group.tiles).filter((tile): tile is LightboxSparkTile => tile.kind === 'spark');
const marks = (board: LightboxBoard | undefined) => sparksOf(board).map((tile) => tile.dismissedOrder ?? null);

/** The board a saved file holds, read from disk. */
function boardIn(host: Host, fileId: string): LightboxBoard {
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', fileId))));
  const held = decoded.kind === 'board' ? lightboxBoardOfFile(decoded.file) : undefined;
  if (held?.kind !== 'board') {
    throw new Error(`${fileId} does not read`);
  }
  return held.board;
}

/** The name a saved file holds, read from disk. */
function nameIn(host: Host, fileId: string): string | undefined {
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', fileId))));
  return decoded.kind === 'board' ? decoded.file.board.name : undefined;
}

async function readChapter(options: Parameters<typeof createLightboxBoardsHost>[0] = {}) {
  const host = createLightboxBoardsHost(options);
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  const setAside = async (index: number, dismissed = true) => {
    const tileId = sparksOf(host.service.currentBoard())[index].id;
    await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: 'board-1', tileId, dismissed });
    await quiet();
  };
  return { host, tab, setAside };
}

describe('a spark set aside saves at once (epic decision 35)', () => {
  it('rewrites the file that holds the board in place: no new file, and a reload brings the spark back set aside', async () => {
    const { host, setAside } = await readChapter();
    const files = host.savedFiles();
    const holding = host.service.savable('board-1')?.savedFileId as string;
    expect(sparksOf(host.service.currentBoard()).length).toBeGreaterThan(1);

    await setAside(0);
    await setAside(1);

    expect(host.savedFiles()).toEqual(files);
    expect(marks(boardIn(host, holding))).toEqual(marks(host.service.currentBoard()));
    expect(marks(boardIn(host, holding)).slice(0, 2)).toEqual([1, 2]);

    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const reloaded = next.openTab();
    await reloaded.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await reloaded.shelf(null);
    expect(marks(next.service.currentBoard()).slice(0, 2)).toEqual([1, 2]);
  });

  it('Undo brings the spark back in the file too, and the rail lists no new row', async () => {
    const { host, tab, setAside } = await readChapter();
    const holding = host.service.savable('board-1')?.savedFileId as string;
    await setAside(0);
    expect(marks(boardIn(host, holding))[0]).toBe(1);
    await setAside(0, false);

    expect(marks(boardIn(host, holding))[0]).toBeNull();
    // One file per board (Slice 5A.2): the board's first save, rewritten in place by its read and by each mark.
    expect(host.savedFiles()).toEqual([holding]);
    expect((await tab.shelf('board-1')).shelf.boards).toHaveLength(1);
  });

  it('a board no file holds keeps the mark in memory for its next save, as before', async () => {
    const { host, setAside } = await readChapter({ folders: [] });

    await setAside(0);

    expect(host.savedFiles()).toEqual([]);
    expect(marks(host.service.currentBoard())[0]).toBe(1);
  });
});

describe('a spark set aside while a run\'s save is being written', () => {
  it('marks the file that save writes, though no file held the board when the spark was set aside', async () => {
    // A first session saves the chapter's measured board; the next session boards the same text, so no new
    // file holds its board (the measured save is held: that text is saved already), and reads it.
    const first = createLightboxBoardsHost();
    first.writeChapter(CHAPTER_PATH, CHAPTER);
    const firstTab = first.openTab();
    await firstTab.choose(CHAPTER_PATH);
    await quiet();
    const host = createLightboxBoardsHost({ fileSystem: first.fileSystem, memory: first.memory });
    const tab = host.openTab();
    await tab.choose(CHAPTER_PATH);
    await quiet();
    expect(host.service.savable('board-1')?.savedFileId).toBeUndefined();
    // Hold the run's save at its commit, once its bytes are staged.
    const gate = deferred<void>();
    const reached = deferred<void>();
    const rename = host.fileSystem.rename.bind(host.fileSystem);
    const spy = jest.spyOn(host.fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath.includes('.tmp-')) {
        spy.mockRestore();
        reached.resolve();
        await gate.promise;
      }
      return rename(fromPath, toPath, options);
    });
    const reading = tab.read();
    await reached.promise;
    const files = host.savedFiles();
    const tileId = sparksOf(host.service.currentBoard())[0].id;
    const setting = tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: 'board-1', tileId, dismissed: true });

    gate.resolve();
    await reading;
    await setting;
    await quiet();

    const written = host.savedFiles().filter((file) => !files.includes(file));
    expect(written).toHaveLength(1);
    expect(host.service.savable('board-1')?.savedFileId).toBe(written[0]);
    expect(marks(boardIn(host, written[0]))[0]).toBe(1);
  });
});

describe('two windows, two different sparks (PR #164 F-03)', () => {
  /** A second window over the same files and memento, restoring the board the first has on screen. */
  async function secondWindow(host: Host) {
    const other = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = other.openTab();
    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await tab.shelf(null);
    const setAside = async (index: number, dismissed = true) => {
      const tileId = sparksOf(other.service.currentBoard())[index].id;
      await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: 'board-1', tileId, dismissed });
      await quiet();
    };
    return { other, setAside };
  }

  it('keeps both marks when the second window set its spark aside without seeing the first\'s', async () => {
    const { host, setAside } = await readChapter();
    const holding = host.service.savable('board-1')?.savedFileId as string;
    const second = await secondWindow(host);
    expect(second.other.service.savable('board-1')?.savedFileId).toBe(holding);

    await setAside(0);
    // The second window still shows spark 1 as it was, and sets spark 2 aside.
    expect(marks(second.other.service.currentBoard()).slice(0, 2)).toEqual([null, null]);
    await second.setAside(1);

    expect(marks(boardIn(host, holding)).slice(0, 2)).toEqual([1, 2]);
    // One file per board (Slice 5A.2): both windows' marks are in the board's one file.
    expect(host.savedFiles()).toEqual([holding]);
  });

  it('control: opened after the first window set its spark aside, the second keeps both marks too', async () => {
    const { host, setAside } = await readChapter();
    const holding = host.service.savable('board-1')?.savedFileId as string;
    await setAside(0);
    const second = await secondWindow(host);
    expect(marks(second.other.service.currentBoard())[0]).toBe(1);

    await second.setAside(1);

    expect(marks(boardIn(host, holding)).slice(0, 2)).toEqual([1, 2]);
  });

  it('control: one spark\'s actions stay last-wins: the second window\'s Undo of the first\'s spark brings it back', async () => {
    const { host, setAside } = await readChapter();
    const holding = host.service.savable('board-1')?.savedFileId as string;
    await setAside(0);
    const second = await secondWindow(host);

    await second.setAside(0, false);

    expect(marks(boardIn(host, holding))[0]).toBeNull();
  });

  it('control: a spark set aside behind a rename, then a switch to another source, marks the original board\'s file', async () => {
    const { host, tab } = await readChapter();
    host.writeChapter('Drafts/alice-2.md', 'Alice opened the little door and looked along the passage into the loveliest garden you ever saw.');
    const holding = host.service.savable('board-1')?.savedFileId as string;
    // Hold the rename's rewrite at its commit, once its bytes are staged.
    const gate = deferred<void>();
    const reached = deferred<void>();
    const rename = host.fileSystem.rename.bind(host.fileSystem);
    const spy = jest.spyOn(host.fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath.includes('.tmp-')) {
        spy.mockRestore();
        reached.resolve();
        await gate.promise;
      }
      return rename(fromPath, toPath, options);
    });
    const naming = tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename-1', boardId: 'board-1', fileId: null, name: 'model A' });
    await reached.promise;
    const tileId = sparksOf(host.service.currentBoard())[0].id;
    const setting = tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: 'board-1', tileId, dismissed: true });
    const switching = tab.choose('Drafts/alice-2.md');

    gate.resolve();
    await naming;
    await setting;
    await switching;
    await quiet();

    expect(host.service.currentBoard()?.source.displayPath).toBe('Drafts/alice-2.md');
    expect(nameIn(host, holding)).toBe('model A');
    expect(marks(boardIn(host, holding))[0]).toBe(1);
  });
});

describe('a restore whose file is gone (5A tech debt)', () => {
  it('forgets the reload pointer, so the next session does not try the file again', async () => {
    const { host } = await readChapter();
    const pointed = (host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY) as { fileId: string }).fileId;
    host.fileSystem.files.delete(path.posix.join(WORKSPACE, 'prose-minion', 'boards', pointed));

    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = next.openTab();
    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await tab.shelf(null);

    expect(next.service.currentBoard()).toBeUndefined();
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toBeUndefined();
    expect(next.logged()).toContain(`Could not restore ${pointed}`);

    const again = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const later = again.openTab();
    await later.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await later.shelf(null);
    expect(again.logged()).not.toContain('Could not restore');
  });
});
