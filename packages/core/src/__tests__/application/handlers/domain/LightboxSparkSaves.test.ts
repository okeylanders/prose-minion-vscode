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
    await setAside(0, false);

    expect(marks(boardIn(host, holding))[0]).toBeNull();
    expect((await tab.shelf('board-1')).shelf.boards).toHaveLength(2);
  });

  it('a board no file holds keeps the mark in memory for its next save, as before', async () => {
    const { host, setAside } = await readChapter({ folders: [] });

    await setAside(0);

    expect(host.savedFiles()).toEqual([]);
    expect(marks(host.service.currentBoard())[0]).toBe(1);
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
