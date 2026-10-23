/**
 * Saved boards in the Workshop's design language (Lightbox Slice 5A.2; epic
 * decision 46), through the real handlers, service, runner, store and
 * library (`lightboxBoardsHarness`).
 *
 * - **One file per board.** A board's first save writes its file, named by
 *   default ("alice-1 - 10/22/2026 2:05 PM"); a second run, and a third,
 *   rewrite it in place. "Read the current text" builds a new board: a new
 *   file, with a new dated name.
 * - **The fallback.** A board's file another window changed since this
 *   window read it is left as it is, and the board is saved to a new file,
 *   which it then follows.
 * - **Every chapter.** The shelf lists every chapter's boards, each with its
 *   source; a board of another chapter opens as a source choice, under the
 *   ticket guards; with no board on screen, the browser's delete and rename
 *   still work.
 * - **Names.** A file saved before names shows its default name, and is not
 *   rewritten for it; naming a file another kept board holds names that
 *   board, so its next save is still in place.
 * - **"Open a board file…"** One of the store's own opens by its id. Any
 *   other is read where it is, never written, and opens as a snapshot no
 *   file of the store holds; its next save writes a new file in the store,
 *   keeping the board's id and name. A malformed file is refused as a
 *   source; another workspace's file, whose chapter is not here, opens and
 *   cannot be brought; a dismissed picker changes nothing.
 *
 * The chapters are "Alice's Adventures in Wonderland" (1865, public
 * domain). Names are made up. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType, type LightboxBoard, type LightboxBoardsPayload } from '@/shared/types/messages';
import { decodeLightboxBoardFile, encodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_NOTICES } from '@/application/services/lightbox/LightboxBoardLibrary';
import { LIGHTBOX_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxHandoff';
import { deferred } from './lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, SAVED_AT, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

const OTHER_PATH = 'Drafts/alice-2.md';
const OTHER = 'Alice opened the little door and looked along the passage into the loveliest garden you ever saw.';
/** The chapter as the writer changed it on disk: one closing line more. */
const CHANGED = `${CHAPTER}\n\nThe writer added this closing line after the board was saved.`;
const OWN = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';
const NAME = '3.2.1 - after the cut - model B';
const BOARDS = path.posix.join(WORKSPACE, 'prose-minion', 'boards');

type Host = ReturnType<typeof createLightboxBoardsHost>;
type Tab = ReturnType<Host['openTab']>;

function fileOf(host: Host, fileId: string) {
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(BOARDS, fileId))));
  if (decoded.kind !== 'board') {
    throw new Error(`${fileId} does not read`);
  }
  return decoded.file;
}

const groupsRead = (board: { readings: LightboxBoard['readings'] }) => board.readings.filter((group) => group.status === 'ok').map((group) => group.group);

async function mounted(options: Parameters<typeof createLightboxBoardsHost>[0] = {}) {
  const host = createLightboxBoardsHost(options);
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  host.writeChapter(OTHER_PATH, OTHER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  return { host, tab };
}

async function boarded(options: Parameters<typeof createLightboxBoardsHost>[0] = {}) {
  const { host, tab } = await mounted(options);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  return { host, tab };
}

/** Open a board file through "Open a board file…", the picker returning `picked` (undefined: dismissed). */
async function openFile(host: Host, tab: Tab, picked: string | undefined, requestId = 'open-file'): Promise<LightboxBoardsPayload | undefined> {
  host.picker.next = picked;
  await tab.route(MessageType.LIGHTBOX_OPEN_BOARD_FILE, { requestId });
  await quiet();
  return tab.shelves().find((payload) => payload.requestId === requestId);
}

describe('one file per board (decision 46)', () => {
  it('names the first file by default, and rewrites it in place for a second run, and a third', async () => {
    const { host, tab } = await boarded();
    expect(host.savedFiles()).toEqual([OWN]);
    expect(fileOf(host, OWN).board.name).toBe('alice-1 - 10/22/2026 2:05 PM');

    await tab.press('characters');
    await quiet();
    expect(host.savedFiles()).toEqual([OWN]);
    expect(groupsRead(fileOf(host, OWN).board)).toEqual(['B']);

    await tab.press('genre');
    await quiet();
    expect(host.savedFiles()).toEqual([OWN]);
    const file = fileOf(host, OWN);
    expect(groupsRead(file.board)).toEqual(['B', 'C']);
    // The save's time moves on; the name, given at the first save, stays.
    expect(file.savedAt).toBe(new Date(SAVED_AT(2)).toISOString());
    expect(file.board.name).toBe('alice-1 - 10/22/2026 2:05 PM');
    const shelf = (await tab.shelf('board-1')).shelf;
    expect(shelf.boards.map((board) => [board.fileId, board.name, board.savedAt, board.onScreen])).toEqual([
      [OWN, 'alice-1 - 10/22/2026 2:05 PM', SAVED_AT(2), true]
    ]);
    expect(shelf.name).toBe('alice-1 - 10/22/2026 2:05 PM');
  });

  it('tells the default name\'s time in the host\'s zone (pinned here)', async () => {
    const { host } = await boarded({ timeZone: 'America/Chicago' });
    expect(fileOf(host, OWN).board.name).toBe('alice-1 - 10/22/2026 9:05 AM');
  });

  it('"Read the current text" builds a new board: a new file, with a new dated name; the earlier file keeps its readings', async () => {
    const { host, tab } = await boarded();
    await tab.read();
    await quiet();
    host.writeChapter(CHAPTER_PATH, CHANGED);

    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();

    const files = host.savedFiles();
    expect(files).toHaveLength(2);
    const fresh = files.find((file) => file !== OWN) as string;
    expect(fileOf(host, fresh).board).toMatchObject({ boardId: 'board-2', name: 'alice-1 - 10/22/2026 2:07 PM' });
    expect(fileOf(host, OWN).board.boardId).toBe('board-1');
    expect(groupsRead(fileOf(host, OWN).board)).toHaveLength(7);
    // The new board's later saves go to its own file.
    await tab.press('characters');
    await quiet();
    expect(host.savedFiles()).toEqual(files);
  });
});

describe('when the board\'s file cannot be rewritten', () => {
  it('saves to a new file when another window changed it since, keeps both, and follows the new one', async () => {
    const { host, tab } = await boarded();
    // Another window on this workspace renames the board's file.
    const other = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    await other.store.replace({ fileId: OWN }, (file) => ({ ...file, board: { ...file.board, name: 'model A' } }), { renames: true });

    await tab.press('characters');
    await quiet();

    const files = host.savedFiles();
    expect(files).toHaveLength(2);
    const fresh = files.find((file) => file !== OWN) as string;
    expect(fileOf(host, OWN).board).toMatchObject({ boardId: 'board-1', name: 'model A' });
    expect(groupsRead(fileOf(host, OWN).board)).toEqual([]);
    expect(fileOf(host, fresh).board).toMatchObject({ boardId: 'board-1', name: 'alice-1 - 10/22/2026 2:05 PM' });
    expect(groupsRead(fileOf(host, fresh).board)).toEqual(['B']);
    expect(host.service.savable('board-1')?.savedFileId).toBe(fresh);
    expect(host.logged()).toContain(`${OWN} could not be saved in place (changed); the board is saved to a new file.`);

    // It follows the new file: the next save is in place there.
    await tab.press('genre');
    await quiet();
    expect(host.savedFiles()).toEqual(files);
    expect(groupsRead(fileOf(host, fresh).board)).toEqual(['B', 'C']);
  });

  it('control: its own rename and spark marks keep the board on its file', async () => {
    const { host, tab } = await boarded();
    await tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename-1', boardId: 'board-1', fileId: null, name: NAME });
    await quiet();
    await tab.press('characters');
    await quiet();

    expect(host.savedFiles()).toEqual([OWN]);
    expect(fileOf(host, OWN).board.name).toBe(NAME);
  });
});

describe('every chapter', () => {
  it('lists every chapter\'s boards, each with its source, and only the board on screen\'s file as on screen', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();

    const shelf = (await tab.shelf('board-2')).shelf;

    expect(shelf.boards.map((board) => [board.source.displayPath, board.name, board.onScreen])).toEqual([
      [OTHER_PATH, 'alice-2 - 10/22/2026 2:06 PM', true],
      [CHAPTER_PATH, 'alice-1 - 10/22/2026 2:05 PM', false]
    ]);
    expect(host.savedFiles()).toHaveLength(2);
  });

  it('lists them with no board on screen too: a new session that restores nothing', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();
    host.memory.values.clear();
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const fresh = next.openTab();

    const answer = await fresh.shelf(null);

    expect(answer.boardId).toBeNull();
    expect(answer.shelf.boards.map((board) => [board.source.displayPath, board.onScreen])).toEqual([[OTHER_PATH, false], [CHAPTER_PATH, false]]);
  });

  it('opens another chapter\'s board as a source choice: it is on screen, and its rows say so', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: OWN });
    await quiet();

    expect(host.service.currentBoard()?.source.displayPath).toBe(CHAPTER_PATH);
    const answer = tab.shelves().find((payload) => payload.requestId === 'open-1');
    expect(answer?.boardId).toBe('board-1');
    expect(answer?.shelf.boards.find((board) => board.onScreen)?.fileId).toBe(OWN);
    expect(answer?.shelf.snapshot).toMatchObject({ fileId: OWN, file: 'same' });
  });

  it('never lets an open of another chapter\'s board whose file is still being read replace a newer source', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();
    const read = host.holdBoardRead();

    const opening = tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: OWN });
    await tab.choose(OTHER_PATH);
    read.release();
    await opening;
    await quiet();

    expect(host.service.currentBoard()?.source.displayPath).toBe(OTHER_PATH);
    expect(host.logged()).toContain(`Dropped the open of ${OWN}: a newer source was chosen`);
  });

  it('refuses at once to open another chapter\'s board while a run reads the board on screen', async () => {
    const gate = deferred<void>();
    const { host, tab } = await boarded({
      respond: async (request) => {
        await gate.promise;
        return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
      }
    });
    await tab.choose(OTHER_PATH);
    await quiet();
    await tab.press('characters');

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: OWN });

    expect(tab.shelves().find((payload) => payload.requestId === 'open-1')?.shelf.notice).toBe(LIGHTBOX_BOARD_NOTICES.reading);
    expect(host.service.currentBoard()?.source.displayPath).toBe(OTHER_PATH);
    gate.resolve();
    await quiet();
  });

  it('deletes and renames from the browser with no board on screen', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();
    const other = host.savedFiles().find((file) => file !== OWN) as string;
    host.memory.values.clear();
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const fresh = next.openTab();
    await fresh.shelf(null);

    await fresh.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename-1', boardId: null, fileId: OWN, name: NAME });
    await fresh.route(MessageType.LIGHTBOX_DELETE_BOARD, { requestId: 'delete-1', boardId: null, fileId: other });
    await quiet();

    expect(next.savedFiles()).toEqual([OWN]);
    expect(fileOf(next, OWN).board.name).toBe(NAME);
    expect(fresh.shelves().find((payload) => payload.requestId === 'delete-1')?.shelf.boards.map((board) => board.name)).toEqual([NAME]);
  });
});

describe('names', () => {
  it('shows a file saved before names by its default, and does not rewrite it; opened, the board takes that name', async () => {
    const { host, tab } = await boarded();
    const board = host.service.currentBoard() as LightboxBoard;
    const old = 'drafts-alice-1-md-9b099095/2026-10-21T09-30-00-000Z.board.json';
    const bytes = new TextEncoder().encode(encodeLightboxBoardFile({ board: { ...board, boardId: 'board-old' }, text: CHAPTER, savedAt: new Date('2026-10-21T09:30:00.000Z') }));
    host.fileSystem.files.set(path.posix.join(BOARDS, old), bytes);

    const shelf = (await tab.shelf('board-1')).shelf;
    expect(shelf.boards.find((row) => row.fileId === old)?.name).toBe('alice-1 - 10/21/2026 9:30 AM');
    expect(host.fileSystem.files.get(path.posix.join(BOARDS, old))).toEqual(bytes);

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-old', fileId: old });
    await quiet();
    expect(tab.shelves().find((payload) => payload.requestId === 'open-old')?.shelf.name).toBe('alice-1 - 10/21/2026 9:30 AM');
    // Its next save writes the name it showed, in place.
    await tab.press('characters');
    await quiet();
    expect(fileOf(host, old).board.name).toBe('alice-1 - 10/21/2026 9:30 AM');
    expect(host.savedFiles()).toEqual([old, OWN]);
  });

  it('naming a file another kept board holds names that board, and its next save stays in place', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();

    await tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename-1', boardId: 'board-2', fileId: OWN, name: NAME });
    await quiet();
    expect(host.service.savable('board-1')?.name).toBe(NAME);

    await tab.choose(CHAPTER_PATH);
    await quiet();
    await tab.press('characters');
    await quiet();

    expect(host.savedFiles()).toHaveLength(2);
    expect(fileOf(host, OWN).board.name).toBe(NAME);
    expect(groupsRead(fileOf(host, OWN).board)).toEqual(['B']);
  });
});

describe('"Open a board file…"', () => {
  it('opens one of the store\'s own by its id, as Open does', async () => {
    const { host, tab } = await boarded();
    await tab.choose(OTHER_PATH);
    await quiet();

    const answer = await openFile(host, tab, path.posix.join(BOARDS, OWN));

    expect(host.service.currentBoard()?.source.displayPath).toBe(CHAPTER_PATH);
    expect(answer?.shelf.snapshot).toMatchObject({ fileId: OWN, file: 'same' });
    // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter keys are display names.
    expect(host.pickFile).toHaveBeenCalledWith(expect.objectContaining({ filters: expect.objectContaining({ 'Lightbox boards': ['json'] }) }));
  });

  it('opens one from outside the store as a snapshot, never writes it, and saves it next as a new file of the store, keeping its id and name', async () => {
    const { host, tab } = await boarded();
    const board = host.service.currentBoard() as LightboxBoard;
    const outside = '/elsewhere/Chapter 6.board.json';
    const bytes = new TextEncoder().encode(encodeLightboxBoardFile({ board: { ...board, boardId: 'board-from-afar' }, text: CHAPTER, savedAt: new Date('2026-10-20T08:00:00.000Z'), name: NAME }));
    host.fileSystem.files.set(outside, bytes);
    await tab.choose(OTHER_PATH);
    await quiet();
    const before = host.savedFiles();

    const answer = await openFile(host, tab, outside);

    expect(host.service.currentBoard()?.boardId).toBe('board-from-afar');
    expect(answer?.shelf).toMatchObject({ name: NAME, snapshot: { outside: true, file: 'same', savedAt: Date.parse('2026-10-20T08:00:00.000Z') } });
    expect(answer?.shelf.snapshot?.fileId).toBeUndefined();
    expect(answer?.shelf.boards.some((row) => row.onScreen)).toBe(false);
    expect(host.savedFiles()).toEqual(before);
    expect(host.logged()).not.toContain('elsewhere');

    await tab.press('characters');
    await quiet();

    const saved = host.savedFiles().filter((file) => !before.includes(file));
    expect(saved).toHaveLength(1);
    expect(fileOf(host, saved[0]).board).toMatchObject({ boardId: 'board-from-afar', name: NAME });
    expect(host.fileSystem.files.get(outside)).toEqual(bytes);
    expect((await tab.shelf('board-from-afar')).shelf.boards.find((row) => row.onScreen)?.fileId).toBe(saved[0]);
  });

  it('refuses a malformed file as a source, in host words, and keeps the board on screen', async () => {
    const { host, tab } = await boarded();
    host.fileSystem.files.set('/elsewhere/broken.board.json', new TextEncoder().encode('{"formatVersion": 1'));
    const before = host.service.currentBoard();

    await openFile(host, tab, '/elsewhere/broken.board.json');

    expect(host.service.currentBoard()).toBe(before);
    expect(tab.refusals().map(({ reason, message }) => ({ reason, message }))).toEqual([{ reason: 'unreadable', message: LIGHTBOX_BOARD_NOTICES.unreadable }]);
    expect(host.savedFiles()).toEqual([OWN]);
  });

  it('opens another workspace\'s board whose chapter is not here: it shows as saved, and cannot be brought', async () => {
    const { host, tab } = await boarded();
    const board = host.service.currentBoard() as LightboxBoard;
    await tab.read();
    await quiet();
    const read = lightboxBoardOfFile(fileOf(host, OWN));
    if (read.kind !== 'board') {
      throw new Error('one source');
    }
    const elsewhere = { ...read.board, boardId: 'board-elsewhere', source: { ...read.board.source, displayPath: 'Book/chapter-9.md' } };
    host.fileSystem.files.set('/other-workspace/prose-minion/boards/x/2026-10-01T00-00-00-000Z.board.json',
      new TextEncoder().encode(encodeLightboxBoardFile({ board: elsewhere, text: CHAPTER, savedAt: new Date('2026-10-01T00:00:00.000Z') })));
    expect(board.boardId).toBe('board-1');

    const answer = await openFile(host, tab, '/other-workspace/prose-minion/boards/x/2026-10-01T00-00-00-000Z.board.json');

    expect(host.service.currentBoard()?.boardId).toBe('board-elsewhere');
    expect(answer?.shelf).toMatchObject({ name: 'chapter-9 - 10/1/2026 12:00 AM', snapshot: { outside: true, file: 'unreadable' } });
    const tile = host.service.currentBoard()?.readings.find((group) => group.group === 'A')?.tiles[0];
    await tab.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: 'board-elsewhere', tileId: tile?.id });
    const result = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_HAND_OFF_RESULT).at(-1);
    expect(result?.payload).toMatchObject({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.fileUnreadable });
  });

  it('changes nothing when the picker is dismissed, and answers with the shelf as it is', async () => {
    const { host, tab } = await boarded();
    const before = host.service.currentBoard();

    const answer = await openFile(host, tab, undefined);

    expect(host.service.currentBoard()).toBe(before);
    expect(answer).toMatchObject({ boardId: 'board-1', shelf: { boards: [{ fileId: OWN, onScreen: true }] } });
    expect(answer?.shelf.notice).toBeUndefined();
  });

  it('is refused at once while a run reads the board on screen', async () => {
    const gate = deferred<void>();
    const { host, tab } = await boarded({
      respond: async (request) => {
        await gate.promise;
        return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
      }
    });
    const board = host.service.currentBoard() as LightboxBoard;
    host.fileSystem.files.set('/elsewhere/a.board.json', new TextEncoder().encode(encodeLightboxBoardFile({ board: { ...board, boardId: 'board-x' }, text: CHAPTER, savedAt: new Date(SAVED_AT(0)) })));
    await tab.press('characters');

    const answer = await openFile(host, tab, '/elsewhere/a.board.json');

    expect(answer?.shelf.notice).toBe(LIGHTBOX_BOARD_NOTICES.reading);
    expect(host.service.currentBoard()?.boardId).toBe('board-1');
    gate.resolve();
    await quiet();
  });

  it('ignores a request without its id', async () => {
    const { host, tab } = await boarded();
    const before = tab.shelves().length;
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD_FILE, {});
    expect(tab.shelves()).toHaveLength(before);
    expect(host.pickFile).not.toHaveBeenCalled();
  });
});
