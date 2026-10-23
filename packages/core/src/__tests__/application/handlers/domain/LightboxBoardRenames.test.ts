/**
 * Board names (Slice 5A.1; epic decision 33; ADR 2026-10-19 D12 addendum),
 * through the real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`).
 *
 * - **A name belongs to the board.** Naming the board on screen (or the row
 *   that holds it) names the retained board and rewrites that file in
 *   place; its later saves carry the name. Naming any other row changes only
 *   that file. An unchanged re-read keeps the name; "Read the current text"
 *   builds a new board, unnamed. Open and restore bring a name back.
 * - **The file is found at the rewrite's turn,** so a save queued before a
 *   rename is the file the rename names. Session-only, the name is the
 *   in-memory board's.
 * - **The route** refuses a name that is not one line, in the rule's words,
 *   and answers with the shelf under the ordering guards every shelf obeys:
 *   an answer built across a newer adoption is built again, and the push a
 *   rename makes, observed before the rename's own answer, is never posted
 *   after it.
 * - **Logs** never carry a name.
 *
 * Slice 5A.2 (epic decision 41): one file per board, and every saved board
 * named. A board's first save gives it a default name (the chapter's file
 * name and the time); its later saves rewrite its file in place, and "Read
 * the current text" starts a new board with a new file and a new dated
 * name. The earlier snapshot these tests rename is a copy of the board's
 * first file kept beside it (`keepEarlierSave`), as 5A's one file per save
 * left them.
 *
 * The chapter is ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain). Names are made up. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType, type LightboxBoardsPayload } from '@/shared/types/messages';
import { LIGHTBOX_BOARD_NAME_FAULTS } from '@shared/constants/lightboxBoardName';
import { decodeLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_NOTICES } from '@/application/services/lightbox/LightboxBoardLibrary';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

const NAME = '3.2.1 - after the cut - model B';
/** The name the board's first save gave it (Slice 5A.2), in UTC here. */
const DEFAULT = 'alice-1 - 10/22/2026 2:05 PM';
/** The chapter as the writer changed it on disk: one closing line more. */
const CHANGED = `${CHAPTER}\n\nThe writer added this closing line after the board was saved.`;

type Host = ReturnType<typeof createLightboxBoardsHost>;
type Tab = ReturnType<Host['openTab']>;

/** The one file the boards folder gained since `before`. */
function added(host: Host, before: readonly string[]): string {
  const files = host.savedFiles().filter((file) => !before.includes(file));
  if (files.length !== 1) {
    throw new Error(`expected one new saved file, found ${files.length}`);
  }
  return files[0];
}

/** The name a saved file holds, read from disk; undefined when unnamed. */
function nameIn(host: Host, fileId: string): string | undefined {
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', fileId))));
  if (decoded.kind !== 'board') {
    throw new Error(`${fileId} does not read`);
  }
  return decoded.file.board.name;
}

/**
 * A host with the chapter boarded and read: READ (the board's own file,
 * rewritten in place by the read) and FIRST (an earlier save of it, kept
 * beside it, measured only), board-1 on screen in READ.
 */
async function readChapter(options: Parameters<typeof createLightboxBoardsHost>[0] = {}) {
  const host = createLightboxBoardsHost(options);
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  const read = added(host, []);
  const first = host.keepEarlierSave(read);
  await tab.read();
  await quiet();
  expect(host.savedFiles()).toEqual([first, read]);
  return { host, tab, first, read };
}

/** Rename as the rail does, and return the answer to that request. */
async function rename(tab: Tab, fileId: string | null, name: string, requestId = `rename-${Math.random()}`): Promise<LightboxBoardsPayload> {
  await tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId, boardId: 'board-1', fileId, name });
  await quiet();
  const answer = tab.shelves().find((payload) => payload.requestId === requestId);
  if (!answer) {
    throw new Error(`no answer to ${requestId}`);
  }
  return answer;
}

const rows = (answer: LightboxBoardsPayload) => answer.shelf.boards.map((board) => [board.fileId, board.name, board.onScreen]);

describe('naming the board on screen', () => {
  it('names the retained board and rewrites the file that holds it in place: the shelf says so, and nothing new is saved', async () => {
    const { host, tab, first, read } = await readChapter();
    const pushes = tab.shelves().length;

    const answer = await rename(tab, null, `  ${NAME} `);

    expect(answer.shelf.name).toBe(NAME);
    expect(rows(answer)).toEqual([[read, NAME, true], [first, DEFAULT, false]]);
    expect(host.savedFiles()).toEqual([first, read]);
    expect([nameIn(host, read), nameIn(host, first)]).toEqual([NAME, DEFAULT]);
    expect(host.service.savable('board-1')?.name).toBe(NAME);
    // The rail hears it unasked too, named.
    expect(tab.shelves().slice(pushes).filter((payload) => payload.requestId === null).map((payload) => payload.shelf.name)).toEqual([NAME]);
  });

  it('carries the name into the board\'s later saves, which rewrite its file in place (decision 41)', async () => {
    const { host, tab, first, read } = await readChapter();
    await rename(tab, null, NAME);

    await tab.press('characters');
    await quiet();

    expect(host.savedFiles()).toEqual([first, read]);
    expect(nameIn(host, read)).toBe(NAME);
    expect(rows(await tab.shelf('board-1'))).toEqual([[read, NAME, true], [first, DEFAULT, false]]);
  });

  it('names the board when the row that holds it is renamed, and unnames it with an empty name', async () => {
    const { host, tab, read } = await readChapter();

    expect((await rename(tab, read, NAME)).shelf.name).toBe(NAME);
    expect(host.service.savable('board-1')?.name).toBe(NAME);

    const unnamed = await rename(tab, null, '');
    expect(unnamed.shelf.name).toBeUndefined();
    expect(nameIn(host, read)).toBeUndefined();
    expect(host.service.savable('board-1')?.name).toBeUndefined();
  });

  it('names the file a save queued just before it commits: the board\'s own file, saved in place, takes the name', async () => {
    const { host, tab, first, read } = await readChapter();

    // A run on board-1 ended and queued its save; the writer names the board before that save has committed.
    const saving = host.library.saveAfterRun('board-1');
    const answer = await rename(tab, null, NAME);
    await saving;

    expect(host.savedFiles()).toEqual([first, read]);
    expect(nameIn(host, read)).toBe(NAME);
    expect(rows(answer)[0]).toEqual([read, NAME, true]);
  });

  it('keeps the name through an unchanged re-read; "Read the current text" builds a new board, with a new file and a new dated name', async () => {
    const { host, tab, first, read } = await readChapter();
    await rename(tab, null, NAME);

    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();
    expect(host.service.currentBoard()?.boardId).toBe('board-1');
    expect((await tab.shelf('board-1')).shelf.name).toBe(NAME);

    host.writeChapter(CHAPTER_PATH, CHANGED);
    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();
    const board = host.service.currentBoard()?.boardId as string;
    expect(board).not.toBe('board-1');
    const changed = added(host, [first, read]);
    const answer = await tab.shelf(board);
    // Its first save named it, at its own time (Slice 5A.2).
    expect(answer.shelf.name).toBe('alice-1 - 10/22/2026 2:07 PM');
    expect(nameIn(host, changed)).toBe('alice-1 - 10/22/2026 2:07 PM');
    // The earlier text's file keeps its name.
    expect(nameIn(host, read)).toBe(NAME);
  });
});

describe('naming a row that is not on screen', () => {
  it('changes only that file: the board on screen stays as it was', async () => {
    const { host, tab, first, read } = await readChapter();

    const answer = await rename(tab, first, 'model A');

    expect(rows(answer)).toEqual([[read, DEFAULT, true], [first, 'model A', false]]);
    expect(answer.shelf.name).toBe(DEFAULT);
    expect(host.service.savable('board-1')?.name).toBe(DEFAULT);
    expect(host.savedFiles()).toEqual([first, read]);
  });

  it('says a file that is gone is gone, and one that does not read is left as it is', async () => {
    const { host, tab, first } = await readChapter();
    const missing = first.replace('14-04-09-123Z', '13-04-09-123Z');
    expect((await rename(tab, missing, 'model A')).shelf.notice).toBe(LIGHTBOX_BOARD_NOTICES.missing);

    host.fileSystem.files.set(path.posix.join(WORKSPACE, 'prose-minion', 'boards', first), new TextEncoder().encode('not a board'));
    expect((await rename(tab, first, 'model A')).shelf.notice).toBe(LIGHTBOX_BOARD_NOTICES.unreadable);
    expect(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', first)))).toBe('not a board');
  });
});

describe('a name comes back', () => {
  it('when its file is opened, and when a reload restores it', async () => {
    const { host, tab, first } = await readChapter();
    await rename(tab, first, 'model A');

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    await quiet();
    expect(tab.shelves().find((payload) => payload.requestId === 'open-first')?.shelf.name).toBe('model A');
    expect(host.service.savable('board-1')?.name).toBe('model A');

    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const reloaded = next.openTab();
    await reloaded.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    const restored = await reloaded.shelf(null);
    expect(restored.shelf).toMatchObject({ name: 'model A', snapshot: { fileId: first } });
  });
});

describe('session-only (no folder, or several)', () => {
  it('names the in-memory board, and writes nothing', async () => {
    const host = createLightboxBoardsHost({ folders: [] });
    host.writeChapter(CHAPTER_PATH, CHAPTER);
    const tab = host.openTab();
    await tab.choose(CHAPTER_PATH);
    await quiet();

    const answer = await rename(tab, null, NAME);

    expect(answer.shelf).toMatchObject({ availability: { kind: 'session', reason: 'no-workspace' }, name: NAME, boards: [] });
    expect(answer.shelf.notice).toBeUndefined();
    expect(host.savedFiles()).toEqual([]);
  });
});

describe('the route', () => {
  it('refuses a name that is not one line, in the rule\'s words, and changes nothing', async () => {
    const { host, tab, read } = await readChapter();

    const answer = await rename(tab, null, '3.2.1\tafter the cut');

    expect(answer.shelf.notice).toBe(LIGHTBOX_BOARD_NAME_FAULTS['not-one-line']);
    expect(answer.shelf.name).toBe(DEFAULT);
    expect(nameIn(host, read)).toBe(DEFAULT);
    expect((await rename(tab, null, 'x'.repeat(121))).shelf.notice).toBe(LIGHTBOX_BOARD_NAME_FAULTS['too-long']);
  });

  it('ignores a request without its request id, board, file or name, and logs no name', async () => {
    const { host, tab } = await readChapter();
    const before = tab.shelves().length;
    for (const payload of [
      { boardId: 'board-1', fileId: null, name: NAME },
      { requestId: 'r', fileId: null, name: NAME },
      { requestId: 'r', boardId: 'board-1', name: NAME },
      { requestId: 'r', boardId: 'board-1', fileId: null }
    ]) {
      await tab.route(MessageType.LIGHTBOX_RENAME_BOARD, payload);
    }
    expect(tab.shelves().length).toBe(before);
    await rename(tab, null, NAME);
    expect(host.logged()).toContain('A rename without its request id, board, file or name was ignored.');
    expect(host.logged()).not.toContain('after the cut');
  });

  it('answers a rename built across a newer adoption with a shelf built again for the board on screen', async () => {
    const { host, tab, first, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
    await quiet();
    // The rename's answer compares the chapter; hold that read once it has read the chapter as it was.
    const compare = host.holdRead(CHAPTER_PATH, { afterRead: true });
    const renaming = tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename-first', boardId: 'board-1', fileId: first, name: 'model A' });
    await quiet();
    host.writeChapter(CHAPTER_PATH, CHANGED);
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    await quiet();

    compare.release();
    await renaming;
    await quiet();

    const answer = tab.shelves().find((payload) => payload.requestId === 'rename-first');
    expect(answer).toMatchObject({ boardId: 'board-1', adoption: host.service.adoptionOf('board-1'), shelf: { name: 'model A', snapshot: { fileId: first, file: 'changed' } } });
    expect(tab.shelves().filter((payload) => payload.requestId === 'rename-first')).toHaveLength(1);
  });

  it('never posts the push a rename makes after the rename\'s own, later answer', async () => {
    const { host, tab, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
    await quiet();
    // The push the rename makes is observed first; hold it once it has read the chapter.
    const compare = host.holdRead(CHAPTER_PATH, { afterRead: true });
    const before = tab.shelves().length;
    const renaming = tab.route(MessageType.LIGHTBOX_RENAME_BOARD, { requestId: 'rename-on-screen', boardId: 'board-1', fileId: null, name: NAME });
    await renaming;
    await quiet();
    const answer = tab.shelves().find((payload) => payload.requestId === 'rename-on-screen');
    expect(answer?.shelf.name).toBe(NAME);

    compare.release();
    await quiet();

    expect(tab.shelves().slice(before).map((payload) => payload.requestId)).toEqual(['rename-on-screen']);
    expect(tab.shelves().at(-1)?.shelf.name).toBe(NAME);
  });
});
