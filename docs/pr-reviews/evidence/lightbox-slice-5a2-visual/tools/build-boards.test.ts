/**
 * Builds the host messages the Slice 5A.2 visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler,
 * LightboxBoardsHandler, LightboxService, LightboxReadingRunner,
 * LightboxBoardStore and LightboxBoardLibrary, over a memory file system
 * that holds three chapters and the boards folder (`lightboxBoardsHarness`).
 * Only the provider is played: each group answers with its worked example,
 * verbatim, and group F with the harness's stand-in Opinion; the model it
 * reports is the placeholder `provider/model-v1` or `provider/model-b`. No
 * provider is called.
 *
 * The story it runs, in UTC, one board file per board (epic decision 46).
 * Each day is a working session: a new host (a window opened) over the same
 * files and memento, which first restores the last board on screen.
 * 1. Oct 12, 2:05 PM: alice-1 is boarded (its file is written and named
 *    "alice-1 - 10/12/2026 2:05 PM"), then groups A and B are read with
 *    model-v1, rewriting that file in place.
 * 2. Oct 14, 10:00 AM: alice-3 is boarded: measured only.
 * 3. Oct 19, 4:40 PM: alice-2 is boarded and read with model-b.
 * 4. Oct 21, 11:20 AM: alice-2 changes on disk; its Oct 19 board is opened,
 *    and "Read the current text" starts a new board in a new file.
 * 5. Oct 22, 1:15 PM: alice-3 is boarded again. Its Oct 14 file holds that
 *    text, so nothing is written until groups A and B are read: then a new
 *    file.
 * 6. Oct 23, 9:08 AM: alice-1 is boarded again and read with model-v1: the
 *    board on screen.
 * 7. The writer names the Oct 12 file "alice-1 - first pass" and the Oct 19
 *    file "alice-2 - second pass" from the browser's rows (the production
 *    rename route): both rewritten in place. Six files in three folders.
 *    This is `library`: the menu, the browser, search, rename and delete.
 * 8. "Open a board file…" picks a copy of the Oct 12 file kept outside the
 *    boards folder: it opens as a snapshot, and nothing is written. This is
 *    `outside`.
 * 9. alice-1 changes on disk, and the Oct 12 board is opened from the
 *    browser: the changed-file notice above it. This is `changed`.
 * 10. A window with no folder open boards and reads alice-1: `session`.
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
import { groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-5a2';
const OUT = `${DIR}/states`;
const BOARDS = '/workspace/prose-minion/boards';
/** The chapters: ¶1–¶8 of the worked examples' text, and its first and last four paragraphs. */
const PARAGRAPHS = CHAPTER.split('\n\n');
const ALICE_2_PATH = 'Drafts/alice-2.md';
const ALICE_3_PATH = 'Drafts/alice-3.md';
const ALICE_2 = PARAGRAPHS.slice(0, 4).join('\n\n');
const ALICE_3 = PARAGRAPHS.slice(4).join('\n\n');
/** A chapter as the writer changed it on disk: one closing line more, written for this evidence. */
const changed = (text: string) => `${text}\n\nThe writer added this closing line after the board was saved.`;
/** Names made up for this evidence. */
const FIRST_PASS = 'alice-1 - first pass';
const SECOND_PASS = 'alice-2 - second pass';
/** Every lens but groups A's and B's. */
const ONLY_A_AND_B: LightboxLensId[] = LIGHTBOX_LENSES.map((lens) => lens.id)
  .filter((lens) => ![...lightboxGroupLenses('A'), ...lightboxGroupLenses('B')].includes(lens));

/** The clock: each save takes the moment it shows, and the next is a minute later. */
let clock = 0;
const at = (iso: string) => {
  clock = Date.parse(iso);
};
const tick = () => {
  const now = clock;
  clock += 60_000;
  return now;
};

type Message = ExtensionToWebviewMessage;
const stamped = (messages: Message[]) => messages.map((message) => ({ ...message, timestamp: 1 }));
const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;

/** The model the provider reports, as the story sets it. */
let reporting = 'provider/model-v1';
const respond = (request: Parameters<typeof groupOf>[0]) =>
  ({ ...ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined), modelId: reporting });

let presses = 0;
/** Press Read as the webview does, after asking for its estimate. */
async function press(tab: LightboxBoardsTab, boardId: string | undefined, lensesOff: LightboxLensId[], scope: LightboxRunScope): Promise<void> {
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

/** What a mount sees: the board the mount's request gets, the shelf a mount's request gets, and the board's shelf. */
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

/** Everything the host posted for one request: the boards it posted, its answer, the opened board's own shelf, and the estimate. */
async function answerTo(tab: LightboxBoardsTab, type: MessageType, payload: object, requestId: string) {
  const from = tab.posted.length;
  await tab.route(type, { ...payload, requestId });
  await quiet();
  const posted = tab.posted.slice(from);
  const answer = posted.find((message) => message.type === MessageType.LIGHTBOX_BOARDS && (message.payload as LightboxBoardsPayload).requestId === requestId);
  const boards = posted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD);
  const opened = (boards.at(-1)?.payload as { board?: { boardId: string } } | undefined)?.board?.boardId;
  return {
    messages: stamped(boards),
    answer: answer ? withoutRequest(answer.payload as LightboxBoardsPayload) : undefined,
    boardId: opened,
    shelf: opened ? withoutRequest(await tab.shelf(opened, `${requestId}-shelf`)) : undefined,
    estimate: opened ? await estimateNow(tab, requestId) : undefined
  };
}

/** One working session: a new host (a window opened) over the same files and memento, its tab mounted as the webview mounts. */
let boardIds = 0;
const mintBoardId = () => `board-${++boardIds}`;
async function opened(shared?: ReturnType<typeof createLightboxBoardsHost>, folders?: string[]) {
  const host = createLightboxBoardsHost({
    now: () => clock, savedAt: tick, respond, mintBoardId, folders,
    ...(shared ? { fileSystem: shared.fileSystem, memory: shared.memory } : {})
  });
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null, 'first-mount');
  await quiet();
  return { host, tab, onScreen: () => host.service.currentBoard()?.boardId };
}

it('dumps the library, outside, changed and session states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const logs: string[][] = [];

  // Oct 12: alice-1 boarded and read for groups A and B by model-v1, in one file.
  at('2026-10-12T14:05:09.123Z');
  const first = await opened();
  logs.push(first.host.lines);
  first.host.writeChapter(CHAPTER_PATH, CHAPTER);
  first.host.writeChapter(ALICE_2_PATH, ALICE_2);
  first.host.writeChapter(ALICE_3_PATH, ALICE_3);
  await first.tab.choose(CHAPTER_PATH);
  await quiet();
  await press(first.tab, first.onScreen(), ONLY_A_AND_B, { mode: 'all' });
  expect(first.host.savedFiles()).toEqual(['drafts-alice-1-md-9b099095/2026-10-12T14-05-09-123Z.board.json']);
  const [firstPassFile] = first.host.savedFiles();

  // Oct 14: alice-3, measured only.
  at('2026-10-14T10:00:09.123Z');
  const second = await opened(first.host);
  logs.push(second.host.lines);
  await second.tab.choose(ALICE_3_PATH);
  await quiet();

  // Oct 19: alice-2, read by model-b.
  at('2026-10-19T16:40:09.123Z');
  const third = await opened(first.host);
  logs.push(third.host.lines);
  reporting = 'provider/model-b';
  await third.tab.choose(ALICE_2_PATH);
  await quiet();
  await press(third.tab, third.onScreen(), [], { mode: 'all' });
  reporting = 'provider/model-v1';
  const [secondPassFile] = third.host.savedFiles().filter((file) => file.startsWith('drafts-alice-2-md'));
  expect(third.host.savedFiles()).toHaveLength(3);

  // Oct 21: alice-2 changed on disk; its Oct 19 board opened, and "Read the current text" starts a new board in a new file.
  at('2026-10-21T11:20:09.123Z');
  const fourth = await opened(first.host);
  logs.push(fourth.host.lines);
  fourth.host.writeChapter(ALICE_2_PATH, changed(ALICE_2));
  const reopened = await answerTo(fourth.tab, MessageType.LIGHTBOX_OPEN_BOARD, { fileId: secondPassFile }, 'open-alice-2');
  expect(reopened.answer?.shelf.snapshot).toMatchObject({ fileId: secondPassFile, file: 'changed' });
  await fourth.tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
  await quiet();
  expect(fourth.host.savedFiles()).toHaveLength(4);

  // Oct 22: alice-3 boarded again in a new window (the text its Oct 14 file holds: no file until a reading) and read for A and B.
  at('2026-10-22T13:15:09.123Z');
  const fifth = await opened(first.host);
  logs.push(fifth.host.lines);
  await fifth.tab.choose(ALICE_3_PATH);
  await quiet();
  expect(fifth.host.savedFiles()).toHaveLength(4);
  await press(fifth.tab, fifth.onScreen(), ONLY_A_AND_B, { mode: 'all' });
  expect(fifth.host.savedFiles()).toHaveLength(5);

  // Oct 23: alice-1 boarded again and read by model-v1: the board on screen.
  at('2026-10-23T09:08:09.123Z');
  const today = await opened(first.host);
  logs.push(today.host.lines);
  const { host, tab } = today;
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await press(tab, today.onScreen(), [], { mode: 'all' });
  const library = today.onScreen() as string;

  // Two rows named from the browser: rewritten in place, no new file.
  at('2026-10-23T09:30:09.123Z');
  const before = host.savedFiles();
  expect(before).toHaveLength(6);
  expect(new Set(before.map((file) => file.split('/')[0])).size).toBe(3);
  const named = [
    await answerTo(tab, MessageType.LIGHTBOX_RENAME_BOARD, { boardId: library, fileId: firstPassFile, name: FIRST_PASS }, 'rename-first'),
    await answerTo(tab, MessageType.LIGHTBOX_RENAME_BOARD, { boardId: library, fileId: secondPassFile, name: SECOND_PASS }, 'rename-second')
  ];
  expect(named.map((each) => each.answer?.shelf.notice)).toEqual([undefined, undefined]);
  expect(host.savedFiles()).toEqual(before);
  const libraryScene = await scene(tab, library, 'library');
  const shelf = libraryScene.shelves[library].shelf;
  expect(shelf.boards.map((board) => [board.name, board.source.displayPath, board.onScreen])).toEqual([
    ['alice-1 - 10/23/2026 9:08 AM', CHAPTER_PATH, true],
    ['alice-3 - 10/22/2026 1:15 PM', ALICE_3_PATH, false],
    ['alice-2 - 10/21/2026 11:20 AM', ALICE_2_PATH, false],
    [SECOND_PASS, ALICE_2_PATH, false],
    ['alice-3 - 10/14/2026 10:00 AM', ALICE_3_PATH, false],
    [FIRST_PASS, CHAPTER_PATH, false]
  ]);
  expect(shelf.name).toBe('alice-1 - 10/23/2026 9:08 AM');

  // "Open a board file…": a copy of the Oct 12 file, kept outside the boards folder. Nothing is written.
  const outsidePath = '/elsewhere/exports/alice-1 - first pass.board.json';
  host.fileSystem.files.set(outsidePath, host.fileSystem.files.get(posix.join(BOARDS, firstPassFile)) as Uint8Array);
  host.picker.next = outsidePath;
  const filesBeforeOutside = [...host.fileSystem.files.keys()].sort();
  const outside = await answerTo(tab, MessageType.LIGHTBOX_OPEN_BOARD_FILE, {}, 'open-file');
  expect(outside.answer?.shelf).toMatchObject({ name: FIRST_PASS, snapshot: { outside: true, file: 'same' } });
  expect([...host.fileSystem.files.keys()].sort()).toEqual(filesBeforeOutside);

  // alice-1 changes on disk; the Oct 12 board opened from the browser.
  host.writeChapter(CHAPTER_PATH, changed(CHAPTER));
  const changedOpen = await answerTo(tab, MessageType.LIGHTBOX_OPEN_BOARD, { fileId: firstPassFile }, 'open-first');
  expect(changedOpen.answer?.shelf).toMatchObject({ name: FIRST_PASS, snapshot: { fileId: firstPassFile, file: 'changed' } });

  // No folder open: boards are kept for the session only.
  at('2026-10-23T10:00:09.123Z');
  const session = await opened(undefined, []);
  logs.push(session.host.lines);
  session.host.writeChapter(CHAPTER_PATH, CHAPTER);
  await session.tab.choose(CHAPTER_PATH);
  await quiet();
  await press(session.tab, session.onScreen(), [], { mode: 'all' });
  const sessionScene = await scene(session.tab, session.onScreen() as string, 'session');
  expect(session.host.savedFiles()).toEqual([]);

  const answered = (open: typeof changedOpen) => ({ messages: open.messages, answer: open.answer, estimate: open.estimate });
  const states = {
    library: libraryScene,
    outside: {
      ...libraryScene,
      shelves: { ...libraryScene.shelves, [outside.boardId as string]: outside.shelf },
      files: answered(outside)
    },
    changed: {
      ...libraryScene,
      shelves: { ...libraryScene.shelves, [changedOpen.boardId as string]: changedOpen.shelf },
      opens: { [firstPassFile]: answered(changedOpen) }
    },
    session: sessionScene,
    files: before
  };
  fs.writeFileSync(path.join(OUT, 'boards.json'), `${JSON.stringify(states)}\n`);

  // The log names files, counts and reasons; never the chapter's words, and never a name the writer gave.
  const log = logs.map((lines) => `${lines.join('\n')}\n`).join('');
  for (const paragraph of PARAGRAPHS) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  expect(log).not.toMatch(/first pass|second pass/);
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
