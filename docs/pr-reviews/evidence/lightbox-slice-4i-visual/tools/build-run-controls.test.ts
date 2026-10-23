/**
 * Builds the host messages the Slice 4I visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler (with its
 * press scope, `LightboxPressScope`), LightboxBoardsHandler, LightboxService,
 * LightboxReadingRunner (its codec, quote verifier and term counter),
 * LightboxBoardStore and LightboxBoardLibrary, over a memory file system
 * (`lightboxBoardsHarness`). Only the provider is played: each group answers
 * with its worked example and group F with the harness's stand-in Opinion.
 * The model it reports is the placeholder `provider/model-v1`. No provider is
 * called.
 *
 * Eight moments of one board, each pressed as the webview presses it:
 * 1. `fresh`: the chapter boarded and measured, nothing analyzed.
 * 2. `one-call`: call B analyzed on its own, from the Voice widget's Analyze
 *    (`{ mode: 'group', group: 'B', lens: 'voice' }`).
 * 3. `analyzing`: call A's Run pressed in the Lenses panel
 *    (`{ mode: 'group', group: 'A' }`), its reply held: A in flight.
 * 4. `read`: A released, then Finish (`{ mode: 'rest' }`): every call read.
 * Then the headline's own Analyze, twice (PR #166 N-02), each pressed as
 * `{ mode: 'group', group: 'A', lens: 'headline' }` with A's reply held:
 * 5. `rereading`: A in flight again, every other call still read;
 * 6. `reread`: A released and read again;
 * 7. `failing`: pressed again, A in flight;
 * 8. `failed`: A's reply fails; A failed, every other call still read.
 * Each moment records what a mount sees: the board, the run's progress while
 * one is in flight, the rail's shelves and the estimate, with the run the
 * host names. A moment a run ends in also carries the host's `finished`
 * progress for it, so a page that watched the run sees it end.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-run-controls.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/run-controls.json and states/log.txt there.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import { MessageType, type ExtensionToWebviewMessage, type LightboxBoard, type LightboxRunScope } from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { LIGHTBOX_OPINION_NOTHING_TO_WEIGH } from '@shared/constants/lightboxOpinion';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  CHAPTER,
  CHAPTER_PATH,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsTab
} from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';
import { groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4i';
const OUT = `${DIR}/states`;
const NOW = Date.UTC(2026, 9, 23, 14, 4, 30);

/** What a mount sees: the board, the run's progress (while one is in flight), the rail's shelves, and the estimate. */
async function scene(tab: LightboxBoardsTab, name: string) {
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  const board = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD).at(-1) as ExtensionToWebviewMessage;
  const boardId = (board as Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_BOARD }>).payload.board?.boardId ?? null;
  const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;
  await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: `estimate-${name}` });
  const estimate = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE)
    .map((message) => message.payload as { requestId?: string }).find((payload) => payload.requestId === `estimate-${name}`);
  const started = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS)
    .map((message) => message as Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_RUN_PROGRESS }>)
    .filter((message) => message.payload.phase === 'started').at(-1);
  const running = (estimate as { activeRun?: unknown } | undefined)?.activeRun !== undefined;
  return {
    messages: [{ ...board, timestamp: 1 }, ...(running && started ? [{ ...started, timestamp: 1 }] : [])],
    mount: withoutRequest(await tab.shelf(null, `mount-${name}`)),
    shelves: boardId ? { [boardId]: withoutRequest(await tab.shelf(boardId, `shelf-${name}`)) } : {},
    estimate: estimate ? withoutRequest(estimate) : undefined
  };
}

const boardOf = (state: Awaited<ReturnType<typeof scene>>): LightboxBoard =>
  (state.messages[0] as Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_BOARD }>).payload.board as LightboxBoard;
const statuses = (board: LightboxBoard) => board.readings.map((group) => `${group.group}:${group.status}`);

/** Press `scope` at a fresh estimate, as the webview does. */
const press = (tab: LightboxBoardsTab, scope: LightboxRunScope) => tab.run(scope);

it('dumps the run-control states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // The reply for group A can be held, so a moment with a call in flight can be recorded, and then fail.
  let holdA: ReturnType<typeof deferred<void>> | undefined;
  let failA = false;
  const host = createLightboxBoardsHost({
    now: () => NOW,
    fileSystem: new MemoryFileSystem(),
    respond: async (request) => {
      const group = groupOf(request);
      if (group === 'A' && holdA) {
        await holdA.promise;
      }
      if (group === 'A' && failA) {
        throw new Error('stub provider: no reply');
      }
      return ok(group, group === 'F' ? opinionReplyFor(request) : undefined);
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null, 'first-mount');
  await tab.choose(CHAPTER_PATH);
  await quiet();

  // 1. Nothing analyzed: the Opinion's own call is refused with its reason.
  const fresh = await scene(tab, 'fresh');
  expect(statuses(boardOf(fresh)).every((entry) => entry.endsWith(':not-run'))).toBe(true);
  await press(tab, { mode: 'group', group: 'F', lens: 'opinion' });
  await quiet();
  const refused = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS).at(-1);
  expect(refused?.payload).toMatchObject({ phase: 'refused', message: LIGHTBOX_OPINION_NOTHING_TO_WEIGH });

  // 2. Call B on its own, from the Voice widget's Analyze.
  await press(tab, { mode: 'group', group: 'B', lens: 'voice' });
  await quiet();
  const oneCall = await scene(tab, 'one-call');
  expect(statuses(boardOf(oneCall))).toEqual(['A:not-run', 'B:ok', 'C:not-run', 'D:not-run', 'E:not-run', 'G:not-run', 'F:not-run']);

  // 3. Call A's Run, its reply held: A in flight.
  holdA = deferred<void>();
  await press(tab, { mode: 'group', group: 'A' });
  await quiet();
  const analyzing = await scene(tab, 'analyzing');
  expect(statuses(boardOf(analyzing))).toEqual(['A:running', 'B:ok', 'C:not-run', 'D:not-run', 'E:not-run', 'G:not-run', 'F:not-run']);
  expect(analyzing.messages).toHaveLength(2);
  // One run at a time: another call pressed now is refused.
  await press(tab, { mode: 'group', group: 'C' });
  expect(tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload)
    .toMatchObject({ phase: 'refused', message: 'This board is already being read. Stop that run first.' });
  holdA.resolve();
  holdA = undefined;
  await quiet();

  // 4. Finish: the calls not back yet, the Opinion last.
  await press(tab, { mode: 'rest' });
  await quiet();
  const read = await scene(tab, 'read');
  expect(statuses(boardOf(read)).every((entry) => entry.endsWith(':ok'))).toBe(true);

  // 5–8 (PR #166 N-02): the headline's own Analyze, once to land and once to fail.
  const headline: LightboxRunScope = { mode: 'group', group: 'A', lens: 'headline' };
  const others = ['B:ok', 'C:ok', 'D:ok', 'E:ok', 'G:ok', 'F:ok'];
  const finished = () => ({
    ...(tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS && message.payload.phase === 'finished').at(-1) as ExtensionToWebviewMessage),
    timestamp: 1
  });
  holdA = deferred<void>();
  await press(tab, headline);
  await quiet();
  const rereading = await scene(tab, 'rereading');
  expect(statuses(boardOf(rereading))).toEqual(['A:running', ...others]);
  holdA.resolve();
  holdA = undefined;
  await quiet();
  const reread = await scene(tab, 'reread');
  reread.messages.push(finished());
  expect(statuses(boardOf(reread))).toEqual(['A:ok', ...others]);

  holdA = deferred<void>();
  failA = true;
  await press(tab, headline);
  await quiet();
  const failing = await scene(tab, 'failing');
  expect(statuses(boardOf(failing))).toEqual(['A:running', ...others]);
  holdA.resolve();
  holdA = undefined;
  await quiet();
  failA = false;
  const failed = await scene(tab, 'failed');
  failed.messages.push(finished());
  expect(statuses(boardOf(failed))).toEqual(['A:failed', ...others]);

  // Each lens's call, for the harness to word what each widget's control should say.
  const lenses = Object.fromEntries(LIGHTBOX_LENSES.map((lens) => [lens.id, { label: lens.label, group: lens.group }]));
  // The host's own refusal of the Opinion alone on the fresh board: what its Analyze must show there.
  const reasons = { opinionNothingToWeigh: (refused?.payload as { message?: string } | undefined)?.message };
  fs.writeFileSync(
    path.join(OUT, 'run-controls.json'),
    `${JSON.stringify({ lenses, reasons, fresh, oneCall, analyzing, read, rereading, reread, failing, failed })}\n`
  );

  // The log names groups, lenses, counts and reasons; never the chapter's words.
  const log = `${host.lines.join('\n')}\n`;
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
