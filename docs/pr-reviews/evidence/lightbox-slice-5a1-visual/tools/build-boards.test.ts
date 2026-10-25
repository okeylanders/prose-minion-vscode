/**
 * Builds the host messages the Slice 5A.1 visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler,
 * LightboxBoardsHandler, LightboxService, LightboxReadingRunner,
 * LightboxBoardStore and LightboxBoardLibrary, over a memory file system
 * that holds the chapter and the boards folder (`lightboxBoardsHarness`).
 * Only the provider is played: each group answers with its worked example,
 * verbatim, and group F with the harness's stand-in Opinion; the model it
 * reports is `provider/model-v1` for the first press and `provider/model-b`
 * after, placeholders, so one board was read by two. No provider is called.
 *
 * The story it runs:
 * 1. The chapter is boarded: its measured board saves itself (2:05 PM).
 * 2. A press reads groups A and B only, with model-v1 (2:06 PM).
 * 3. A press reads the rest, with model-b (2:07 PM): the board on screen.
 * 4. The writer names the board on screen "3.2.1 - after the cut - model B"
 *    from the rail's head, and the 2:06 PM row "3.2.1 - before the cut -
 *    model A". Both files are rewritten in place: still three files. This
 *    is `named` (and `rename-open`, the same rail with a row's field open).
 * 5. A spark is set aside on the board on screen: still three files, the
 *    2:07 PM file rewritten. A reload (a new host over the same files and
 *    memento) restores it with the spark set aside: `spark`.
 * 6. The chapter changes on disk, and the 2:06 PM board is opened: the
 *    changed-file notice, in the rail and above the board, with its name in
 *    the head. This is `changed`.
 * 7. A workspace with no folder open boards and reads the chapter, and the
 *    writer names it: `session-named`.
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
import { posix } from 'path';
import {
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoardsPayload,
  type LightboxLensId,
  type LightboxRunScope,
  type LightboxSparkTile
} from '@messages';
import { LIGHTBOX_LENSES, lightboxGroupLenses } from '@shared/constants/lightbox';
import { decodeLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import {
  CHAPTER,
  CHAPTER_PATH,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsTab
} from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';
import { groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-5a1';
const OUT = `${DIR}/states`;
/** When the chapter is measured: a minute before the first save. */
const NOW = Date.UTC(2026, 9, 22, 14, 4, 30);
/** The chapter as the writer changed it on disk: one closing line more, written for this evidence. */
const CHANGED = `${CHAPTER}\n\nThe writer added this closing line after the board was saved.`;
/** Names made up for this evidence. */
const NAME_B = '3.2.1 - after the cut - model B';
const NAME_A = '3.2.1 - before the cut - model A';
/** Every lens but groups A's and B's. */
const ONLY_A_AND_B: LightboxLensId[] = LIGHTBOX_LENSES.map((lens) => lens.id)
  .filter((lens) => ![...lightboxGroupLenses('A'), ...lightboxGroupLenses('B')].includes(lens));

type Message = ExtensionToWebviewMessage;
const stamped = (messages: Message[]) => messages.map((message) => ({ ...message, timestamp: 1 }));
const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;

/** The model the provider reports, as the story sets it. */
let reporting = 'provider/model-v1';
const respond = (request: Parameters<typeof groupOf>[0]) =>
  ({ ...ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined), modelId: reporting });

let presses = 0;
/** Press Read as the webview does, after asking for its estimate. */
async function press(tab: LightboxBoardsTab, boardId: string, lensesOff: LightboxLensId[], scope: LightboxRunScope): Promise<void> {
  const requestId = `estimate-${lensesOff.length}-${scope.mode}-${++presses}`;
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

it('dumps the named, rename-open, spark, changed and session-named states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const host = createLightboxBoardsHost({ now: () => NOW, respond });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null, 'first-mount');
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await press(tab, 'board-1', ONLY_A_AND_B, { mode: 'all' });
  reporting = 'provider/model-b';
  await press(tab, 'board-1', [], { mode: 'rest' });
  const files = host.savedFiles();
  expect(files).toEqual([
    'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json',
    'drafts-alice-1-md-9b099095/2026-10-22T14-06-09-123Z.board.json',
    'drafts-alice-1-md-9b099095/2026-10-22T14-07-09-123Z.board.json'
  ]);
  const [, second, third] = files;

  // The writer names the board on screen from the head, and the earlier read by its row: rewritten in place.
  const head = await answerTo(tab, MessageType.LIGHTBOX_RENAME_BOARD, { boardId: 'board-1', fileId: null, name: NAME_B }, 'rename-head');
  const row = await answerTo(tab, MessageType.LIGHTBOX_RENAME_BOARD, { boardId: 'board-1', fileId: second, name: NAME_A }, 'rename-row');
  expect([head.answer?.shelf.notice, row.answer?.shelf.notice]).toEqual([undefined, undefined]);
  expect(host.savedFiles()).toEqual(files);
  const named = await scene(tab, 'board-1', 'named');
  expect(named.shelves['board-1'].shelf.name).toBe(NAME_B);
  expect(named.shelves['board-1'].shelf.boards.map((board) => [board.name ?? null, board.models ?? null, board.onScreen])).toEqual([
    [NAME_B, ['provider/model-v1', 'provider/model-b'], true],
    [NAME_A, ['provider/model-v1'], false],
    [null, null, false]
  ]);

  // A spark set aside on the board on screen: the file that holds it is rewritten; no new file.
  const spark = (host.service.currentBoard()?.readings ?? []).flatMap((group) => group.tiles)
    .find((tile): tile is LightboxSparkTile => tile.kind === 'spark');
  await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: 'board-1', tileId: spark?.id, dismissed: true });
  await quiet();
  expect(host.savedFiles()).toEqual(files);
  const held = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(posix.join('/workspace/prose-minion/boards', third))));
  expect(held.kind === 'board' && held.file.board.readings.flatMap((group) => group.tiles).find((tile) => tile.id === spark?.id))
    .toMatchObject({ dismissedOrder: 1 });
  // A reload restores the board with the spark set aside.
  const reloaded = createLightboxBoardsHost({ now: () => NOW, respond, fileSystem: host.fileSystem, memory: host.memory });
  const reloadedTab = reloaded.openTab();
  await reloadedTab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await reloadedTab.shelf(null, 'restore');
  const sparkState = await scene(reloadedTab, 'board-1', 'spark');
  expect(sparkState.shelves['board-1'].shelf.boards).toHaveLength(3);

  // The chapter changes on disk; the named 2:06 PM board is opened over it.
  host.writeChapter(CHAPTER_PATH, CHANGED);
  const changed = await answerTo(tab, MessageType.LIGHTBOX_OPEN_BOARD, { fileId: second }, 'open-second');
  expect(changed.answer?.shelf).toMatchObject({ name: NAME_A, snapshot: { fileId: second, file: 'changed' } });
  const changedEstimate = await estimateNow(tab, 'changed');

  // No folder open: the board is named for the session only.
  reporting = 'provider/model-v1';
  const session = createLightboxBoardsHost({ now: () => NOW, folders: [], respond });
  session.writeChapter(CHAPTER_PATH, CHAPTER);
  const sessionTab = session.openTab();
  await sessionTab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await sessionTab.shelf(null, 'first-mount');
  await sessionTab.choose(CHAPTER_PATH);
  await quiet();
  await press(sessionTab, 'board-1', [], { mode: 'all' });
  await answerTo(sessionTab, MessageType.LIGHTBOX_RENAME_BOARD, { boardId: 'board-1', fileId: null, name: NAME_B }, 'rename-session');
  const sessionNamed = await scene(sessionTab, 'board-1', 'session-named');
  expect(session.savedFiles()).toEqual([]);
  expect(sessionNamed.shelves['board-1'].shelf.name).toBe(NAME_B);

  const states = {
    named,
    changed: { ...named, opens: { [second]: { ...changed, estimate: changedEstimate } } },
    spark: sparkState,
    sessionNamed
  };
  fs.writeFileSync(path.join(OUT, 'boards.json'), `${JSON.stringify(states)}\n`);

  // The log names files, counts and reasons; never the chapter's words, and never a board's name.
  const log = [host, reloaded, session].map((each) => `${each.lines.join('\n')}\n`).join('');
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  expect(log).not.toMatch(/the cut|model A|model B/);
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
