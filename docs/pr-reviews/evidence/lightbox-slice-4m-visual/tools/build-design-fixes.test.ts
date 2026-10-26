/**
 * Builds the host messages the Slice 4M visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler (with its
 * press scope), LightboxBoardsHandler, LightboxService, LightboxReadingRunner
 * (its codec, quote verifier and term counter), LightboxBoardStore and
 * LightboxBoardLibrary, over a memory file system (`lightboxBoardsHarness`).
 * Only the provider is played: each group answers with its worked example
 * and group F with the harness's stand-in Opinion, or call B fails. The
 * model it reports is the placeholder `provider/model-v1`. No provider is
 * called.
 *
 * One board, a long chapter: ¶1–¶8 of Chapter I of "Alice's Adventures in
 * Wonderland" (1865, public domain), the worked examples' excerpt, forty
 * times over, 320 paragraphs, so the ribbon buckets them into 96 columns and
 * a counted word stands in most of them. Pressed as the webview presses it:
 * Run AI analyses (`{ mode: 'all' }`), call B failing, so every other call
 * lands and the run line offers Finish, and from this slice Re-analyze all
 * beside it.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-design-fixes.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/design-fixes.json and states/log.txt there.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import { MessageType, type ExtensionToWebviewMessage, type LightboxBoard } from '@messages';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  CHAPTER,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsTab
} from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';
import { groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4m';
const OUT = `${DIR}/states`;
const NOW = Date.UTC(2026, 9, 26, 9, 8, 0);
const LONG_PATH = 'Drafts/alice-long.md';
const REPEATS = 40;

/** What a mount sees: the board, the rail's shelves, and the estimate. */
async function scene(tab: LightboxBoardsTab, name: string) {
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  const board = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD).at(-1) as ExtensionToWebviewMessage;
  const boardId = (board as Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_BOARD }>).payload.board?.boardId ?? null;
  const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;
  await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: `estimate-${name}` });
  const estimate = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE)
    .map((message) => message.payload as { requestId?: string }).find((payload) => payload.requestId === `estimate-${name}`);
  return {
    messages: [{ ...board, timestamp: 1 }],
    mount: withoutRequest(await tab.shelf(null, `mount-${name}`)),
    shelves: boardId ? { [boardId]: withoutRequest(await tab.shelf(boardId, `shelf-${name}`)) } : {},
    estimate: estimate ? withoutRequest(estimate) : undefined
  };
}

const boardOf = (state: Awaited<ReturnType<typeof scene>>): LightboxBoard =>
  (state.messages[0] as Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_BOARD }>).payload.board as LightboxBoard;

it('dumps the design-fixes states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const host = createLightboxBoardsHost({
    now: () => NOW,
    fileSystem: new MemoryFileSystem(),
    respond: async (request) => {
      const group = groupOf(request);
      if (group === 'B') {
        throw new Error('stub provider: no reply');
      }
      return ok(group, group === 'F' ? opinionReplyFor(request) : undefined);
    }
  });
  host.writeChapter(LONG_PATH, Array.from({ length: REPEATS }, () => CHAPTER).join('\n\n'));
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null, 'first-mount');
  await tab.choose(LONG_PATH);
  await quiet();

  // Run AI analyses, call B failing: every other call lands.
  await tab.run({ mode: 'all' });
  await quiet();
  const oneFailed = await scene(tab, 'one-failed');
  const board = boardOf(oneFailed);
  expect(board.paragraphs.length).toBe(CHAPTER.split('\n\n').length * REPEATS);
  expect(board.ribbon.length).toBe(96);
  expect(board.readings.map((group) => `${group.group}:${group.status}`)).toEqual(['A:ok', 'B:failed', 'C:ok', 'D:ok', 'E:ok', 'G:ok', 'F:ok']);

  fs.writeFileSync(path.join(OUT, 'design-fixes.json'), `${JSON.stringify({ oneFailed })}\n`);

  // The log names groups, lenses, counts and reasons; never the chapter's words.
  const log = `${host.lines.join('\n')}\n`;
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
