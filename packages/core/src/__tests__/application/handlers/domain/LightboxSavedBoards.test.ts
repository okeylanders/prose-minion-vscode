/**
 * Lightbox saved boards (Slice 5A; ADR 2026-10-19 D12 addendum; epic
 * decisions 27–30): when a board saves itself, what the rail lists, opening
 * a saved board as a snapshot (an unchanged file, a changed one, and "Read
 * the current text"), deleting, and a reload that restores the last board on
 * screen.
 *
 * The real Lightbox handlers, service, runner, store and library
 * (`lightboxBoardsHarness`); the workspace and the boards folder are one
 * memory file system, so a test changes the chapter on disk by writing it.
 * The chapter is ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain). No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType } from '@/shared/types/messages';
import type { LightboxBoard } from '@/shared/types/messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { LIGHTBOX_TILE_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { LIGHTBOX_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxHandoff';
import { LIGHTBOX_OPINION_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxOpinionHandoff';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_POINTER_KEY } from '@/infrastructure/storage/LightboxBoardStore';
import { LIGHTBOX_BOARD_NOTICES } from '@/application/services/lightbox/LightboxBoardLibrary';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { deferred } from './lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import {
  CHAPTER,
  CHAPTER_PATH,
  SAVED_AT,
  WORKSPACE,
  createLightboxBoardsHost,
  quiet
} from './lightboxBoardsHarness';

const FIRST = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';
const READ = 'drafts-alice-1-md-9b099095/2026-10-22T14-06-09-123Z.board.json';
const THIRD = 'drafts-alice-1-md-9b099095/2026-10-22T14-07-09-123Z.board.json';
const EVERY_LENS = LIGHTBOX_LENSES.map((lens) => lens.id);
const PROJECT = { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false } as const;
/** The chapter as the writer changed it on disk: one closing line more. */
const CHANGED = `${CHAPTER}\n\nThe writer added this closing line after the board was saved.`;

/** The board a saved file holds, as the host keeps it. */
function savedBoard(host: ReturnType<typeof createLightboxBoardsHost>, fileId: string): { board: LightboxBoard; text: string } {
  const bytes = host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', fileId));
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(bytes));
  if (decoded.kind !== 'board') {
    throw new Error(`${fileId} does not read as a board`);
  }
  const held = lightboxBoardOfFile(decoded.file);
  if (held.kind !== 'board') {
    throw new Error(`${fileId} holds several sources`);
  }
  return { board: held.board, text: held.text };
}

/** A host with the chapter boarded and read: FIRST (measured) and READ (every lens) saved. */
async function readChapter() {
  const host = createLightboxBoardsHost();
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  // The mount, as the webview sends it: the board, then the rail's shelf.
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  return { host, tab };
}

describe('saving (epic decision 27)', () => {
  it('saves a source\'s first measured board once, and re-reading the same text saves nothing more', async () => {
    const host = createLightboxBoardsHost();
    host.writeChapter(CHAPTER_PATH, CHAPTER);
    const tab = host.openTab();
    await tab.choose(CHAPTER_PATH);
    await quiet();
    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();

    expect(host.savedFiles()).toEqual([FIRST]);
    expect((await tab.shelf('board-1')).shelf).toEqual({
      availability: PROJECT,
      boards: [{ fileId: FIRST, savedAt: SAVED_AT(0), wordCount: 508, lenses: [], staleLenses: [], onScreen: true }],
      unreadable: 0
    });
    expect(savedBoard(host, FIRST)).toEqual({ board: host.service.currentBoard(), text: CHAPTER });
  });

  it('saves the board as it stands after a run that landed readings: a new file, newest first, with the lenses and the cost', async () => {
    const { host, tab } = await readChapter();

    expect(host.savedFiles()).toEqual([FIRST, READ]);
    expect((await tab.shelf('board-1')).shelf.boards).toEqual([
      { fileId: READ, savedAt: SAVED_AT(1), wordCount: 508, lenses: EVERY_LENS, staleLenses: [], costUsd: 0.07, models: ['provider/model-v1'], onScreen: true },
      { fileId: FIRST, savedAt: SAVED_AT(0), wordCount: 508, lenses: [], staleLenses: [], onScreen: false }
    ]);
    // The file holds exactly the board on screen, and its text.
    expect(savedBoard(host, READ)).toEqual({ board: host.service.currentBoard(), text: CHAPTER });
    // The board's adoption, and each committed save, is pushed to the rail, unasked.
    expect(tab.shelves().filter((answer) => answer.requestId === null).map((answer) => answer.shelf.boards.map((board) => board.fileId)))
      .toEqual([[FIRST], [FIRST], [READ, FIRST]]);
    // A reload reopens the board on screen.
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toEqual({ root: WORKSPACE, fileId: READ });
  });

  it('saves nothing after a run stopped before any group came back', async () => {
    const reply = deferred<void>();
    const host = createLightboxBoardsHost({
      respond: async (request) => {
        await reply.promise;
        return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
      }
    });
    host.writeChapter(CHAPTER_PATH, CHAPTER);
    const tab = host.openTab();
    await tab.choose(CHAPTER_PATH);
    await quiet();
    await tab.read();
    await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: 'board-1', token: 'run-1-token' });
    reply.resolve();
    await quiet();

    expect(host.savedFiles()).toEqual([FIRST]);
  });

  it('keeps boards for the session only with no folder open, or several, and the rail says why', async () => {
    for (const [folders, reason] of [[[], 'no-workspace'], [[WORKSPACE, '/second'], 'multi-root']] as const) {
      const host = createLightboxBoardsHost({ folders: [...folders] });
      host.writeChapter(CHAPTER_PATH, CHAPTER);
      const tab = host.openTab();
      await tab.choose(CHAPTER_PATH);
      await tab.read();
      await quiet();

      expect(host.savedFiles()).toEqual([]);
      expect((await tab.shelf('board-1')).shelf).toEqual({ availability: { kind: 'session', reason }, boards: [], unreadable: 0 });
      expect(host.memory.values.size).toBe(0);
    }
  });
});

describe('opening a saved board (epic decision 29)', () => {
  it('opens an older board exactly as saved, and the rail marks it as the board on screen', async () => {
    const { host, tab } = await readChapter();
    const saved = savedBoard(host, FIRST);

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: FIRST });

    expect(tab.boards().at(-1)).toEqual(saved.board);
    expect(host.service.currentBoard()).toEqual(saved.board);
    const answer = tab.shelves().at(-1);
    expect(answer?.requestId).toBe('open-1');
    expect(answer?.boardId).toBe('board-1');
    expect(answer?.shelf.boards.map((board) => [board.fileId, board.onScreen])).toEqual([[READ, false], [FIRST, true]]);
    expect(answer?.shelf.snapshot).toEqual({ fileId: FIRST, savedAt: SAVED_AT(0), file: 'same', dropped: 0 });
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toEqual({ root: WORKSPACE, fileId: FIRST });
    // Opening writes nothing.
    expect(host.savedFiles()).toEqual([FIRST, READ]);
  });

  it('lets an unchanged file\'s snapshot travel: Bring checks the file and finds it the same', async () => {
    const { host, tab } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: READ });
    const tile = host.service.currentBoard()?.readings.find((group) => group.group === 'A')?.tiles[0];

    await tab.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: 'board-1', tileId: tile?.id });

    // Past the file check, this host has no Workshop to take it.
    const result = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_HAND_OFF_RESULT).at(-1);
    expect(result?.payload).toMatchObject({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.noWorkshop });
  });

  it('says when the file changed, refuses Bring in words that point to Read the current text, which carries the readings, stale', async () => {
    const { host, tab } = await readChapter();
    host.writeChapter(CHAPTER_PATH, CHANGED);

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: READ });
    expect(tab.shelves().at(-1)?.shelf.snapshot).toEqual({ fileId: READ, savedAt: SAVED_AT(1), file: 'changed', dropped: 0 });
    const tile = host.service.currentBoard()?.readings.find((group) => group.group === 'A')?.tiles[0];
    await tab.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: 'board-1', tileId: tile?.id });
    const result = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_HAND_OFF_RESULT).at(-1);
    expect(result?.payload).toMatchObject({ ok: false, message: LIGHTBOX_TILE_HANDOFF_REFUSALS.snapshotChanged });
    expect(LIGHTBOX_TILE_HANDOFF_REFUSALS.snapshotChanged).toBe(
      'This saved board was read from an earlier text of the chapter. Choose Read the current text, then read the lens again before bringing it.'
    );

    // "Read the current text": the file as it is now, the saved readings carried, stale.
    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();
    const current = host.service.currentBoard();
    expect(current?.boardId).toBe('board-2');
    expect(current?.source.paragraphCount).toBe(9);
    expect(current?.readings.map((group) => [group.group, group.status, group.staleLenses?.length ?? 0])).toEqual([
      ['A', 'ok', 5], ['B', 'ok', 3], ['C', 'ok', 3], ['D', 'ok', 3], ['E', 'ok', 4], ['G', 'ok', 1], ['F', 'ok', 1]
    ]);
    const shelf = (await tab.shelf('board-2')).shelf;
    expect(shelf.snapshot).toBeUndefined();
    // The new text is a source's first board of it, so it saved itself, with its readings marked stale.
    expect(shelf.boards.map((board) => [board.fileId, board.wordCount, board.staleLenses.length, board.onScreen])).toEqual([
      [THIRD, 519, 20, true], [READ, 508, 0, false], [FIRST, 508, 0, false]
    ]);
  });

  it('refuses a file that is gone as a source, in host words, and keeps the board on screen', async () => {
    const { host, tab } = await readChapter();
    const before = host.service.currentBoard();

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: 'drafts-alice-1-md-9b099095/2026-01-01T00-00-00-000Z.board.json' });

    expect(host.service.currentBoard()).toBe(before);
    expect(tab.refusals().map(({ reason, message, suggestion }) => ({ reason, message, suggestion }))).toEqual([{
      reason: 'unreadable',
      message: LIGHTBOX_BOARD_NOTICES.missing,
      suggestion: 'Choose another saved board, or read the chapter again.'
    }]);
  });
});

describe('a board saved under an earlier citation rule (the writer-data rule)', () => {
  /** A synthetic id: a basis rule this build does not have. */
  const EARLIER = 'rendered-text-2026-10-21';
  const REASON = 'Saved under an earlier citation rule; read the Opinion again to bring it current.';
  const handOffResult = (tab: Awaited<ReturnType<typeof readChapter>>['tab']) =>
    tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_HAND_OFF_RESULT).at(-1)?.payload;

  /** READ's file, its Opinion's basis rule rewritten to EARLIER: a file from a build whose rule was another. */
  function rewriteBasis(host: ReturnType<typeof createLightboxBoardsHost>): void {
    const file = path.posix.join(WORKSPACE, 'prose-minion', 'boards', READ);
    const json = JSON.parse(new TextDecoder().decode(host.fileSystem.files.get(file)));
    json.board.rules.opinionBasis = EARLIER;
    host.fileSystem.files.set(file, new TextEncoder().encode(`${JSON.stringify(json, null, 2)}\n`));
  }

  it('control: a board saved under this build\'s rule opens with its Opinion standing, and brings it', async () => {
    const { host, tab } = await readChapter();
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: READ });
    const opened = host.service.currentBoard() as LightboxBoard;
    const opinion = lightboxOpinionTile(opened);

    expect(opened.rules.opinionBasis).toBe('item-data-2026-10-22');
    expect(opinion && lightboxOpinionStanding(opinion, opened).stale).toBe(false);
    await tab.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: 'board-1', tileId: opinion?.id });
    // Past the standing check: the stand-in Opinion cites tiles, not their quotes, so it stops at its quotes.
    expect(handOffResult(tab)).toMatchObject({ ok: false, message: LIGHTBOX_OPINION_HANDOFF_REFUSALS.quotesGone });
  });

  it('opens whole, its Opinion stale with the host\'s reason and its Bring refused; reading the Opinion again brings it current', async () => {
    const { host, tab } = await readChapter();
    const saved = savedBoard(host, READ);
    rewriteBasis(host);

    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1', fileId: READ });
    const opened = host.service.currentBoard() as LightboxBoard;
    expect(tab.refusals()).toEqual([]);
    expect(tab.boards().at(-1)).toEqual(opened);
    expect(opened.rules.opinionBasis).toBe(EARLIER);
    // Every tile of every kind, every layer, as saved.
    expect({ ...opened, rules: saved.board.rules }).toEqual(saved.board);
    const opinion = lightboxOpinionTile(opened);
    expect(opinion && lightboxOpinionStanding(opinion, opened)).toMatchObject({ stale: true, changed: [], note: REASON });

    await tab.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: 'board-1', tileId: opinion?.id });
    expect(handOffResult(tab)).toMatchObject({ ok: false, message: REASON });
    // Any other kind brings as it did.
    const other = opened.readings.find((group) => group.group === 'A')?.tiles[0];
    await tab.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: 'board-1', tileId: other?.id });
    expect(handOffResult(tab)).toMatchObject({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.noWorkshop });

    // Re-reading the unchanged file keeps the readings, and the rule they were cited under.
    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();
    expect(host.service.currentBoard()?.rules.opinionBasis).toBe(EARLIER);

    // Reading the Opinion again cites under this build's rule: it stands, and the webview hears the rule.
    await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: 'estimate-opinion' });
    const estimate = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE)
      .map((message) => message.payload).find((payload) => payload.requestId === 'estimate-opinion')?.estimate;
    await tab.route(MessageType.LIGHTBOX_RUN, {
      boardId: 'board-1', scope: { mode: 'lens', lens: 'opinion' }, estimateKey: estimate?.key, model: estimate?.model
    });
    await quiet();
    const current = host.service.currentBoard() as LightboxBoard;
    const reread = lightboxOpinionTile(current);
    expect(current.rules.opinionBasis).toBe('item-data-2026-10-22');
    expect(reread && lightboxOpinionStanding(reread, current).stale).toBe(false);
    expect(tab.boards().at(-1)?.rules.opinionBasis).toBe('item-data-2026-10-22');
    // And its save records the rule it was cited under.
    expect(savedBoard(host, host.savedFiles().at(-1) as string).board.rules.opinionBasis).toBe('item-data-2026-10-22');
  });
});

describe('deleting a saved board', () => {
  it('deletes the file; the board on screen stays, and no longer names it', async () => {
    const { host, tab } = await readChapter();
    const before = host.service.currentBoard();

    await tab.route(MessageType.LIGHTBOX_DELETE_BOARD, { requestId: 'delete-1', boardId: 'board-1', fileId: READ });

    expect(host.savedFiles()).toEqual([FIRST]);
    expect(host.service.currentBoard()).toBe(before);
    const answer = tab.shelves().at(-1);
    expect(answer?.requestId).toBe('delete-1');
    expect(answer?.shelf.boards.map((board) => [board.fileId, board.onScreen])).toEqual([[FIRST, false]]);
    expect(answer?.shelf.notice).toBeUndefined();
    expect(host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toBeUndefined();
  });

  it('leaves a file that does not read as a board, and says so', async () => {
    const { host, tab } = await readChapter();
    const broken = 'drafts-alice-1-md-9b099095/2026-10-21T09-00-00-000Z.board.json';
    host.fileSystem.files.set(path.posix.join(WORKSPACE, 'prose-minion', 'boards', broken), new TextEncoder().encode('{"formatVersion": 1'));

    await tab.route(MessageType.LIGHTBOX_DELETE_BOARD, { requestId: 'delete-1', boardId: 'board-1', fileId: broken });

    expect(host.savedFiles()).toEqual([broken, FIRST, READ]);
    expect(tab.shelves().at(-1)?.shelf).toMatchObject({ unreadable: 1, notice: LIGHTBOX_BOARD_NOTICES.deleteUnreadable });
  });
});

describe('a reload restores the last board on screen (epic decision 30)', () => {
  it('reopens it when the tab mounts in a new session, as saved, and only once', async () => {
    const { host } = await readChapter();
    const onScreen = host.service.currentBoard();
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = next.openTab();

    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    const answer = await tab.shelf(null);

    expect(tab.boards()).toEqual([null, onScreen]);
    expect(answer.boardId).toBe('board-1');
    expect(answer.shelf.snapshot).toEqual({ fileId: READ, savedAt: SAVED_AT(1), file: 'same', dropped: 0 });
    expect(next.logged()).toContain(`[LightboxBoardLibrary] Restored ${READ}`);

    // A second mount in the same session is answered, not restored again.
    await tab.shelf(null);
    expect(tab.boards()).toEqual([null, onScreen]);
  });

  it('restores nothing when a source was chosen first in the new session', async () => {
    const { host } = await readChapter();
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = next.openTab();

    await tab.choose(CHAPTER_PATH);
    const answer = await tab.shelf(null);

    expect(next.service.currentBoard()?.readings.every((group) => group.status === 'not-run')).toBe(true);
    expect(answer.shelf.snapshot).toBeUndefined();
    expect(next.logged()).not.toContain('Restored');
  });

  it('keeps today\'s behaviour when boards are session-only: a new session opens empty', async () => {
    const { host } = await readChapter();
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory, folders: [WORKSPACE, '/second'] });
    const tab = next.openTab();

    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    const answer = await tab.shelf(null);

    expect(tab.boards()).toEqual([null]);
    expect(answer).toMatchObject({ boardId: null, shelf: { availability: { kind: 'session', reason: 'multi-root' }, boards: [] } });
  });
});

describe('the rail\'s requests', () => {
  it('ignores a request without its id, and echoes each id it answers', async () => {
    const { host, tab } = await readChapter();
    const before = tab.shelves().length;

    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARDS, { boardId: 'board-1' });
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-1' });
    await tab.route(MessageType.LIGHTBOX_DELETE_BOARD, { requestId: 'delete-1', fileId: FIRST });

    expect(tab.shelves()).toHaveLength(before);
    expect(host.savedFiles()).toEqual([FIRST, READ]);
    expect(host.logged()).toContain('[LightboxBoardsHandler] A boards request without its request id or board was ignored.');
    expect((await tab.shelf('board-1', 'mine')).requestId).toBe('mine');
  });
});
