/**
 * Builds the host messages the Slice 5A visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler,
 * LightboxBoardsHandler, LightboxService, LightboxReadingRunner,
 * LightboxBoardStore and LightboxBoardLibrary, over a memory file system
 * that holds the chapter and the boards folder (`lightboxBoardsHarness`).
 * Only the provider is played: each group answers with its worked example,
 * verbatim, and group F with the harness's stand-in Opinion. No provider is
 * called.
 *
 * The story it runs:
 * 1. The chapter is boarded: its measured board saves itself.
 * 2. A press reads groups A and B only: a second file.
 * 3. A press reads the rest: a third file. This is `rail`.
 * 4. The oldest file is opened: `opened`.
 * 5. The chapter changes on disk, and the second file is opened: `changed`.
 * 6. "Read the current text": the file as it is now, the readings carried,
 *    stale, and a fourth file. This is `read-current`.
 * 7. A second workspace with no folder open boards and reads the chapter:
 *    `session-only`.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-boards.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/boards.json and states/log.txt there.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import {
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoardsPayload,
  type LightboxLensId,
  type LightboxRunScope
} from '@messages';
import { LIGHTBOX_LENSES, lightboxGroupLenses } from '@shared/constants/lightbox';
import {
  CHAPTER,
  CHAPTER_PATH,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsTab
} from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-5a';
const OUT = `${DIR}/states`;
/** When the chapter is measured: a minute before the first save. */
const NOW = Date.UTC(2026, 9, 22, 14, 4, 30);
/** The chapter as the writer changed it on disk: one closing line more, written for this evidence. */
const CHANGED = `${CHAPTER}\n\nThe writer added this closing line after the board was saved.`;
/** Every lens but groups A's and B's. */
const ONLY_A_AND_B: LightboxLensId[] = LIGHTBOX_LENSES.map((lens) => lens.id)
  .filter((lens) => ![...lightboxGroupLenses('A'), ...lightboxGroupLenses('B')].includes(lens));

type Message = ExtensionToWebviewMessage;
const stamped = (messages: Message[]) => messages.map((message) => ({ ...message, timestamp: 1 }));
const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;

/** Press Read as the webview does, after asking for its estimate. */
async function press(tab: LightboxBoardsTab, boardId: string, lensesOff: LightboxLensId[], scope: LightboxRunScope): Promise<void> {
  const requestId = `estimate-${lensesOff.length}-${scope.mode}`;
  await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff, requestId });
  const estimate = estimateAnswer(tab, requestId);
  await tab.route(MessageType.LIGHTBOX_RUN, { boardId, scope, estimateKey: estimate.estimate?.key, model: estimate.estimate?.model });
  await quiet();
}

function estimateAnswer(tab: LightboxBoardsTab, requestId: string) {
  const answer = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE)
    .map((message) => message.payload as { requestId?: string; estimate?: { key: string; model: string } })
    .find((payload) => payload.requestId === requestId);
  if (!answer) {
    throw new Error(`no estimate for ${requestId}`);
  }
  return answer;
}

/** The host's estimate for the board on screen with every lens on, without its request id. */
async function estimateNow(tab: LightboxBoardsTab, name: string) {
  await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: `estimate-${name}` });
  return withoutRequest(estimateAnswer(tab, `estimate-${name}`));
}

/** What a mount sees: the board the mount's request gets, the shelf its rail's request gets, and the board's shelf. */
async function scene(tab: LightboxBoardsTab, boardId: string, name: string) {
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  const board = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD).at(-1) as Message;
  return {
    messages: stamped([board]),
    mount: withoutRequest(await tab.shelf(null, `mount-${name}`)),
    shelves: { [boardId]: withoutRequest(await tab.shelf(boardId, `shelf-${name}`)) },
    estimate: await estimateNow(tab, name)
  };
}

/** Everything the host posted for one request, and its answer. */
async function answerTo(tab: LightboxBoardsTab, type: MessageType, payload: object, requestId: string) {
  const from = tab.posted.length;
  await tab.route(type, { ...payload, requestId });
  await quiet();
  const posted = tab.posted.slice(from);
  const answer = posted.find((message) => message.type === MessageType.LIGHTBOX_BOARDS && (message.payload as LightboxBoardsPayload).requestId === requestId);
  return {
    messages: stamped(posted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD)),
    answer: answer ? withoutRequest(answer.payload as LightboxBoardsPayload) : undefined
  };
}

it('dumps the rail, opened, changed, read-current and session-only states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const host = createLightboxBoardsHost({ now: () => NOW });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null, 'first-mount');
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await press(tab, 'board-1', ONLY_A_AND_B, { mode: 'all' });
  await press(tab, 'board-1', [], { mode: 'rest' });
  const files = host.savedFiles();
  expect(files).toEqual([
    'drafts-alice-1-md/2026-10-22T14-05-09-123Z.board.json',
    'drafts-alice-1-md/2026-10-22T14-06-09-123Z.board.json',
    'drafts-alice-1-md/2026-10-22T14-07-09-123Z.board.json'
  ]);
  const [first, second] = files;

  const rail = await scene(tab, 'board-1', 'rail');
  expect(rail.shelves['board-1'].shelf.boards.map((board) => [board.lenses.length, board.onScreen])).toEqual([[20, true], [8, false], [0, false]]);

  // Opening the oldest: the measured board, exactly as saved.
  const opened = await answerTo(tab, MessageType.LIGHTBOX_OPEN_BOARD, { fileId: first }, 'open-first');
  const openedEstimate = await estimateNow(tab, 'opened');

  // The chapter changes on disk; the second file is opened over it.
  host.writeChapter(CHAPTER_PATH, CHANGED);
  const changed = await answerTo(tab, MessageType.LIGHTBOX_OPEN_BOARD, { fileId: second }, 'open-second');
  expect(changed.answer?.shelf.snapshot?.file).toBe('changed');
  const changedEstimate = await estimateNow(tab, 'changed');

  // "Read the current text": the source's own re-read.
  const from = tab.posted.length;
  await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
  await quiet();
  const refreshed = tab.posted.slice(from).filter((message) =>
    message.type === MessageType.LIGHTBOX_BOARD || (message.type === MessageType.LIGHTBOX_BOARDS && (message.payload as LightboxBoardsPayload).requestId === null));
  expect(host.service.currentBoard()?.boardId).toBe('board-2');
  const readCurrent = {
    messages: stamped(refreshed),
    shelves: { 'board-2': withoutRequest(await tab.shelf('board-2', 'shelf-read-current')) },
    estimate: await estimateNow(tab, 'read-current')
  };
  expect(readCurrent.shelves['board-2'].shelf.boards.map((board) => [board.lenses.length, board.staleLenses.length, board.onScreen]))
    .toEqual([[8, 8, true], [20, 0, false], [8, 0, false], [0, 0, false]]);

  // No folder open: boards are kept for the session only.
  const session = createLightboxBoardsHost({ now: () => NOW, folders: [] });
  session.writeChapter(CHAPTER_PATH, CHAPTER);
  const sessionTab = session.openTab();
  await sessionTab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await sessionTab.shelf(null, 'first-mount');
  await sessionTab.choose(CHAPTER_PATH);
  await quiet();
  await press(sessionTab, 'board-1', [], { mode: 'all' });
  const sessionOnly = await scene(sessionTab, 'board-1', 'session-only');
  expect(session.savedFiles()).toEqual([]);

  const states = {
    rail,
    opened: { ...rail, opens: { [first]: { ...opened, estimate: openedEstimate } } },
    changed: { ...rail, opens: { [second]: { ...changed, estimate: changedEstimate } }, refresh: readCurrent },
    sessionOnly
  };
  fs.writeFileSync(path.join(OUT, 'boards.json'), `${JSON.stringify(states)}\n`);

  // The log names files, counts and reasons; never the chapter's words.
  const log = `${host.lines.join('\n')}\n${session.lines.join('\n')}\n`;
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
