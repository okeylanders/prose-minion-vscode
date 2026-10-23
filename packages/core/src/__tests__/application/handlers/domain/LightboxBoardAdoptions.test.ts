/**
 * The board on screen, adoption by adoption (PR #163 F-01, F-02 and F-05).
 *
 * - **The reload pointer follows every adoption (F-01).** Coming back to a
 *   source whose board a file already holds moves the pointer to that file,
 *   and writes nothing; a reload then reopens the board left on screen,
 *   readings and all.
 * - **A board's id is not its adoption (F-02).** A saved snapshot keeps its
 *   board's id, so an open can put another snapshot of the same board on
 *   screen while work on the one before is still awaited. A press still
 *   preparing is refused, with nothing sent (a press made after the open,
 *   at the estimate shown before it, starts: the snapshot prices the same
 *   inputs); a shelf built for the earlier
 *   snapshot is never posted as current: a push is dropped, and a request's
 *   answer is built again. Controls: a different board, and nothing adopted
 *   meanwhile.
 * - **Within one adoption, shelves are ordered (F-05).** Readings, saves and
 *   deletes keep the adoption, so each shelf names when it was observed. A
 *   save's push observed before a Delete's answer is never posted after
 *   it, and a request observed before it is answered again. Controls: no
 *   interleaving, and a newer save at the same adoption, both posted.
 *
 * Slice 5A.2 (epic decision 41): a board's later saves rewrite its own
 * file, so the earlier snapshot of the same board these tests open is a
 * copy kept beside it (`keepEarlierSave`), as 5A's one file per save left
 * them, and a press on a snapshot saves into the file it was opened from.
 *
 * Real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`); only file reads, a press's preparation and the
 * engine's replies are stand-ins, held open to order events exactly. File
 * ids are read from the boards folder, not spelled out. The chapters are
 * "Alice's Adventures in Wonderland" (1865, public domain). No provider is
 * called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType } from '@/shared/types/messages';
import { LIGHTBOX_BOARD_POINTER_KEY } from '@/infrastructure/storage/LightboxBoardStore';
import {
  CHAPTER,
  CHAPTER_PATH,
  WORKSPACE,
  createLightboxBoardsHost,
  quiet
} from './lightboxBoardsHarness';

const OTHER_PATH = 'Drafts/alice-2.md';
const OTHER = 'Alice opened the little door and looked along the passage into the loveliest garden you ever saw.';
/** The chapter as the writer changed it on disk: one closing line more. */
const CHANGED = `${CHAPTER}\n\nThe writer added this closing line after the board was saved.`;
const BOARD_CHANGED = 'The board changed. Read the board on screen.';

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

/** Both chapters in the workspace, and a tab mounted as the webview mounts it. */
async function mounted() {
  const host = createLightboxBoardsHost();
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  host.writeChapter(OTHER_PATH, OTHER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  return { host, tab };
}

/**
 * Board the chapter, then read it: READ (the board's own file, rewritten in
 * place by the read) and FIRST (an earlier save of the same board, measured
 * only, kept beside it), board-1 on screen as read.
 */
async function readChapter() {
  const { host, tab } = await mounted();
  await tab.choose(CHAPTER_PATH);
  await quiet();
  const read = added(host, []);
  const first = host.keepEarlierSave(read);
  await tab.read();
  await quiet();
  expect(host.savedFiles()).toEqual([first, read]);
  return { host, tab, first, read };
}

/** A new session over the same folder and memento, mounted: what a reload restores. */
async function reload(host: Host) {
  const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
  const tab = next.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  const answer = await tab.shelf(null);
  return { next, answer };
}

const progress = (tab: Tab) => tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS)
  .map((message) => message.payload);
const statuses = (host: Host) => host.service.currentBoard()?.readings.map((group) => group.status);

describe('the reload pointer follows the board on screen (PR #163 F-01)', () => {
  it('A, then B, then unchanged A: the pointer names A\'s file, nothing more is written, and a reload restores A', async () => {
    const { host, tab } = await mounted();
    await tab.choose(CHAPTER_PATH);
    await quiet();
    const chapter = added(host, []);
    await tab.choose(OTHER_PATH);
    await quiet();
    const other = added(host, [chapter]);
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toEqual({ root: WORKSPACE, fileId: other });

    await tab.choose(CHAPTER_PATH);
    await quiet();

    expect(host.service.currentBoard()?.boardId).toBe('board-1');
    expect(host.savedFiles()).toEqual([chapter, other].sort());
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toEqual({ root: WORKSPACE, fileId: chapter });
    const { next, answer } = await reload(host);
    expect(next.service.currentBoard()?.source.displayPath).toBe(CHAPTER_PATH);
    expect(answer.shelf.snapshot).toMatchObject({ fileId: chapter, file: 'same' });
  });

  it('A read, then B, then unchanged A: a reload restores A as read, its readings whole', async () => {
    const { host, tab, first, read } = await readChapter();
    await tab.choose(OTHER_PATH);
    await quiet();
    const other = added(host, [first, read]);

    await tab.choose(CHAPTER_PATH);
    await quiet();

    expect(statuses(host)?.every((status) => status === 'ok')).toBe(true);
    expect(host.savedFiles()).toEqual([first, read, other].sort());
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toEqual({ root: WORKSPACE, fileId: read });
    const { next, answer } = await reload(host);
    expect(answer.shelf.snapshot).toMatchObject({ fileId: read, file: 'same' });
    expect(next.service.currentBoard()?.readings.every((group) => group.status === 'ok')).toBe(true);
  });
});

describe('a press still preparing yields to a newer adoption (PR #163 F-02)', () => {
  it.each([['a lens', 'characters'], ['the Opinion', 'opinion']] as const)('pressing %s, is refused when a saved snapshot of its own board is opened, and nothing is sent or landed', async (_name, lens) => {
    const { host, tab, first, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
    const calls = host.runInitial.mock.calls.length;
    const estimate = await tab.estimate();
    const prepare = host.holdPrepare();

    const pressing = tab.press(lens, estimate);
    await prepare.reached;
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    expect(host.service.currentBoard()?.boardId).toBe('board-1');
    expect(statuses(host)?.every((status) => status === 'not-run')).toBe(true);
    prepare.release();
    await pressing;
    await quiet();

    expect(host.runInitial.mock.calls.length).toBe(calls);
    expect(statuses(host)?.every((status) => status === 'not-run')).toBe(true);
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'refused', message: BOARD_CHANGED, reestimate: true });
    expect(host.savedFiles()).toEqual([first, read].sort());
  });

  it('control, the open landed first: a press at the estimate shown before it starts, as a snapshot of the board prices the same inputs', async () => {
    const { host, tab, first, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
    const estimate = await tab.estimate();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    const calls = host.runInitial.mock.calls.length;

    await tab.press('characters', estimate);
    await quiet();

    expect(host.runInitial.mock.calls.length).toBe(calls + 1);
    expect(host.service.currentBoard()?.readings.find((group) => group.group === 'B')?.status).toBe('ok');
  });

  it('control, another board: is refused when another source is chosen', async () => {
    const { host, tab } = await readChapter();
    const calls = host.runInitial.mock.calls.length;
    const estimate = await tab.estimate();
    const prepare = host.holdPrepare();

    const pressing = tab.press('characters', estimate);
    await prepare.reached;
    await tab.choose(OTHER_PATH);
    prepare.release();
    await pressing;
    await quiet();

    expect(host.runInitial.mock.calls.length).toBe(calls);
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'refused', message: BOARD_CHANGED });
  });

  it('control, nothing adopted meanwhile: starts, reads its lens and saves, into the file it was opened from', async () => {
    const { host, tab, first, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    const calls = host.runInitial.mock.calls.length;
    const estimate = await tab.estimate();
    const prepare = host.holdPrepare();

    const pressing = tab.press('characters', estimate);
    await prepare.reached;
    prepare.release();
    await pressing;
    await quiet();

    expect(host.runInitial.mock.calls.length).toBe(calls + 1);
    expect(host.service.currentBoard()?.readings.find((group) => group.group === 'B')?.status).toBe('ok');
    // One file per board (Slice 5A.2): the snapshot's file takes the reading in place.
    expect(host.savedFiles()).toEqual([first, read]);
    expect((await tab.shelf('board-1')).shelf.boards.find((board) => board.onScreen)?.fileId).toBe(first);
  });
});

/** READ open and pressed again; the save that press lands pushes a shelf held once it has read the chapter as it was. */
async function heldPush() {
  const { host, tab, first, read } = await readChapter();
  await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
  const compare = host.holdRead(CHAPTER_PATH, { afterRead: true });
  await tab.press('characters');
  await quiet();
  return { host, tab, first, read, compare };
}

describe('a shelf built for an earlier snapshot is never posted as current (PR #163 F-02)', () => {
  it('keeps the newer snapshot\'s changed-file notice: the late shelf is dropped', async () => {
    const { host, tab, first, read, compare } = await heldPush();
    host.writeChapter(CHAPTER_PATH, CHANGED);
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });
    await quiet();
    expect(tab.shelves().find((answer) => answer.requestId === 'open-first')?.shelf.snapshot).toMatchObject({ fileId: first, file: 'changed' });
    const before = tab.shelves().length;

    compare.release();
    await quiet();

    expect(tab.shelves().slice(before).filter((answer) => answer.shelf.snapshot?.fileId === read)).toEqual([]);
    expect(tab.shelves().at(-1)?.shelf.snapshot).toMatchObject({ fileId: first, file: 'changed' });
  });

  it('answers a request built across a newer snapshot with a shelf built again for the board on screen', async () => {
    const { host, tab, first, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
    const compare = host.holdRead(CHAPTER_PATH, { afterRead: true });
    const asking = tab.shelf('board-1', 'ask-1');
    await quiet();
    host.writeChapter(CHAPTER_PATH, CHANGED);
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-first', fileId: first });

    compare.release();
    const answer = await asking;

    expect(answer).toMatchObject({ requestId: 'ask-1', boardId: 'board-1', shelf: { snapshot: { fileId: first, file: 'changed' } } });
    expect(answer.adoption).toBe(host.service.adoptionOf('board-1'));
  });

  it('control, nothing adopted meanwhile: the shelf is posted when its comparison finishes', async () => {
    const { tab, read, compare } = await heldPush();
    const before = tab.shelves().length;

    compare.release();
    await quiet();

    const late = tab.shelves().slice(before);
    expect(late).toHaveLength(1);
    expect(late[0]).toMatchObject({ requestId: null, boardId: 'board-1', shelf: { snapshot: { fileId: read, file: 'same' } } });
  });

  it('control, another board on screen: the shelf is posted naming its own board, which the rail shows only beside it', async () => {
    const { host, tab, read, compare } = await heldPush();
    await tab.choose(OTHER_PATH);
    await quiet();
    const before = tab.shelves().length;

    compare.release();
    await quiet();

    const late = tab.shelves().slice(before);
    expect(late).toHaveLength(1);
    expect(late[0]).toMatchObject({ requestId: null, boardId: 'board-1', shelf: { snapshot: { fileId: read, file: 'same' } } });
    expect(host.service.currentBoard()?.boardId).toBe('board-2');
  });
});

describe('within one adoption, a shelf observed before one already sent is never posted (PR #163 F-05)', () => {
  /** Change the chapter on disk, then delete FIRST from the rail: its answer sees the change. */
  async function editThenDelete(tab: Tab, host: Host, first: string) {
    host.writeChapter(CHAPTER_PATH, CHANGED);
    await tab.route(MessageType.LIGHTBOX_DELETE_BOARD, { requestId: 'delete-first', boardId: 'board-1', fileId: first });
    await quiet();
    const deleted = tab.shelves().find((answer) => answer.requestId === 'delete-first');
    expect(deleted?.shelf.snapshot).toMatchObject({ file: 'changed' });
    expect(deleted?.shelf.boards.map((board) => board.fileId)).not.toContain(first);
    return deleted;
  }

  it('keeps the Delete\'s changed-file answer: the save\'s push, observed before it, is dropped', async () => {
    const { host, tab, first, read, compare } = await heldPush();
    const deleted = await editThenDelete(tab, host, first);
    // Readings, the save and the Delete kept the adoption: only the order of observation tells the two shelves apart.
    expect(deleted?.adoption).toBe(host.service.adoptionOf('board-1'));
    const before = tab.shelves().length;

    compare.release();
    await quiet();

    expect(tab.shelves().slice(before)).toEqual([]);
    expect(tab.shelves().at(-1)?.shelf.snapshot).toMatchObject({ fileId: read, file: 'changed' });
  });

  it('answers a request observed before the Delete\'s answer with a shelf observed again', async () => {
    const { host, tab, first, read } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-read', fileId: read });
    const compare = host.holdRead(CHAPTER_PATH, { afterRead: true });
    const asking = tab.shelf('board-1', 'ask-1');
    await quiet();
    const deleted = await editThenDelete(tab, host, first);

    compare.release();
    const answer = await asking;

    expect(answer).toMatchObject({ requestId: 'ask-1', boardId: 'board-1', shelf: { snapshot: { fileId: read, file: 'changed' } } });
    expect(answer.observation).toBeGreaterThan(deleted?.observation ?? Infinity);
    expect(tab.shelves().at(-1)?.requestId).toBe('ask-1');
  });

  it('control, no interleaving: the save\'s push is posted, then the Delete\'s answer', async () => {
    const { host, tab, first, read, compare } = await heldPush();
    const before = tab.shelves().length;
    compare.release();
    await quiet();
    await editThenDelete(tab, host, first);

    expect(tab.shelves().slice(before).map((answer) => [answer.requestId, answer.shelf.snapshot?.file])).toEqual([
      [null, 'same'], ['delete-first', 'changed']
    ]);
    expect(tab.shelves().at(-1)?.shelf.snapshot).toMatchObject({ fileId: read, file: 'changed' });
  });

  it('control, a newer save at the same adoption, in place: its push is posted after the Delete\'s answer', async () => {
    const { host, tab, first, compare } = await heldPush();
    compare.release();
    await quiet();
    const deleted = await editThenDelete(tab, host, first);
    const saved = host.savedFiles();

    await tab.press('characters');
    await quiet();

    const newer = tab.shelves().at(-1);
    expect(newer).toMatchObject({ requestId: null, boardId: 'board-1', adoption: deleted?.adoption, shelf: { snapshot: { file: 'changed' } } });
    // The save rewrote the board's own file (Slice 5A.2): no new row.
    expect(newer?.shelf.boards).toHaveLength(saved.length);
    expect(newer?.observation).toBeGreaterThan(deleted?.observation ?? Infinity);
  });
});
