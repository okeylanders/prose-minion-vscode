/**
 * Builds the host messages the Slice 4J visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler (with its
 * press scope), LightboxBoardsHandler, LightboxService, LightboxReadingRunner
 * (its codec, quote verifier and term counter), LightboxBoardStore and
 * LightboxBoardLibrary, over a memory file system (`lightboxBoardsHarness`).
 * Only the provider is played: each group answers with its worked example
 * and group F with the harness's stand-in Opinion, or a call is held, fails,
 * or answers with a reply that cannot be read (saved for recovery, its place
 * named), or with its motif block missing its friction. The model it reports
 * is the placeholder `provider/model-v1`. No provider is called.
 *
 * Eight moments of one board, each pressed as the webview presses it:
 * 1. `fresh`: the chapter boarded and measured, nothing analyzed.
 * 2. `firstFailed`: Run AI analyses (`{ mode: 'all' }`), call A's reply
 *    unusable: A failed with nothing to keep, every other call read
 *    (decision 52: one note, a short line in each of A's five widgets).
 * 3. `read`: Finish (`{ mode: 'rest' }`): A read too.
 * 4. `rerunning`: Re-analyze (`{ mode: 'all' }`), every chapter call's reply
 *    held: every call in flight over its earlier readings (decision 49).
 * 5. `stopped`: Stop: every call stopped, every reading kept, earlier.
 * 6. `opinionKept`: Finish, the Opinion's call failing: every chapter call
 *    read again, the earlier Opinion kept.
 * 7. `mixed`: call A's Run (`{ mode: 'group', group: 'A' }`), its motif block
 *    withheld: the headline, tension, gravity and palette replaced, the motif
 *    kept, with its own reason.
 * 8. `failedKept`: call A's Run again, its reply unusable: A failed, every
 *    reading of A kept, its one note naming where the reply was saved.
 * Each moment records what a mount sees: the board, the run's progress while
 * one is in flight, the rail's shelves and the estimate, with the run the
 * host names. A moment a run ends in also carries the host's last progress
 * for it.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-keep-readings.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/keep-readings.json and states/log.txt there.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import { MessageType, type ExtensionToWebviewMessage, type LightboxBoard, type LightboxReadingGroupId } from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  CHAPTER,
  CHAPTER_PATH,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsTab
} from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';
import { examples, groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import { frame, framedJson } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4j';
const OUT = `${DIR}/states`;
const NOW = Date.UTC(2026, 9, 24, 9, 8, 0);
const SAVED = '/workspace/prose-minion/recovery/model-responses/lightbox-readings-2026-10-24T09-08-00-000Z.response.txt';

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

type Mode = 'ok' | 'hold' | 'fail' | 'unusable' | 'withheldMotif';

it('dumps the keep-readings states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const modes: Partial<Record<LightboxReadingGroupId, Mode>> = {};
  let gate = deferred<void>();
  const host = createLightboxBoardsHost({
    now: () => NOW,
    fileSystem: new MemoryFileSystem(),
    // An unusable reply's paid body is saved for recovery: its place is named in the failure (decision 52 says it once).
    recovery: { capture: async () => ({ filePath: SAVED, toolName: 'lightbox-readings', storageScope: 'project' }) },
    respond: async (request) => {
      const group = groupOf(request);
      const mode = modes[group] ?? 'ok';
      if (mode === 'hold') {
        await gate.promise;
      }
      if (mode === 'fail') {
        throw new Error('stub provider: no reply');
      }
      if (mode === 'unusable') {
        return ok(group, `===LIGHTBOX_GROUP_${group}_V1===\n{"version": 1, "headline": \n===END_LIGHTBOX_GROUP_${group}_V1===`);
      }
      if (mode === 'withheldMotif') {
        const json = framedJson(examples.A.response) as { motifs: { friction?: string } };
        delete json.motifs.friction;
        return ok(group, frame('A', json));
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
  const last = () => ({
    ...(tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS).at(-1) as ExtensionToWebviewMessage),
    timestamp: 1
  });
  const reset = () => { for (const key of Object.keys(modes)) { delete modes[key as LightboxReadingGroupId]; } };

  // 1. Nothing analyzed.
  const fresh = await scene(tab, 'fresh');
  expect(statuses(boardOf(fresh)).every((entry) => entry.endsWith(':not-run'))).toBe(true);

  // 2. Run AI analyses, call A's reply unusable: A failed, nothing of it to keep.
  modes.A = 'unusable';
  await tab.run({ mode: 'all' });
  await quiet();
  const firstFailed = await scene(tab, 'first-failed');
  firstFailed.messages.push(last());
  expect(statuses(boardOf(firstFailed))).toEqual(['A:failed', 'B:ok', 'C:ok', 'D:ok', 'E:ok', 'G:ok', 'F:ok']);
  expect(boardOf(firstFailed).readings.find((group) => group.group === 'A')?.error).toContain(SAVED);
  reset();

  // 3. Finish: A read.
  await tab.run({ mode: 'rest' });
  await quiet();
  const read = await scene(tab, 'read');
  read.messages.push(last());
  expect(statuses(boardOf(read)).every((entry) => entry.endsWith(':ok'))).toBe(true);

  // 4. Re-analyze, every chapter call held: every call in flight over its earlier readings.
  for (const id of ['A', 'B', 'C', 'D', 'E', 'G'] as const) {
    modes[id] = 'hold';
  }
  gate = deferred<void>();
  await tab.run({ mode: 'all' });
  await quiet();
  const rerunning = await scene(tab, 'rerunning');
  expect(statuses(boardOf(rerunning)).every((entry) => entry.endsWith(':running'))).toBe(true);
  expect(boardOf(rerunning).readings.every((group) => group.tiles.length > 0)).toBe(true);

  // 5. Stop: every reading kept, said to be the earlier one; nothing saved of its own.
  const run = host.runner.activeRun('board-1');
  await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: run?.boardId, token: run?.token });
  await quiet();
  gate.resolve();
  await quiet();
  const stopped = await scene(tab, 'stopped');
  stopped.messages.push(last());
  expect(statuses(boardOf(stopped)).every((entry) => entry.endsWith(':cancelled'))).toBe(true);
  expect(boardOf(stopped).readings.every((group) => (group.earlierLenses?.length ?? 0) > 0)).toBe(true);
  reset();

  // 6. Finish, the Opinion's call failing: every chapter call read again, the earlier Opinion kept.
  const opinion = boardOf(read).readings.find((group) => group.group === 'F')?.tiles.map((tile) => tile.id);
  modes.F = 'fail';
  await tab.run({ mode: 'rest' });
  await quiet();
  const opinionKept = await scene(tab, 'opinion-kept');
  opinionKept.messages.push(last());
  expect(statuses(boardOf(opinionKept))).toEqual(['A:ok', 'B:ok', 'C:ok', 'D:ok', 'E:ok', 'G:ok', 'F:failed']);
  expect(boardOf(opinionKept).readings.find((group) => group.group === 'F')?.tiles.map((tile) => tile.id)).toEqual(opinion);
  reset();

  // 7. Call A's Run, its motif block withheld: the motif kept, the rest of A replaced.
  modes.F = 'fail';
  modes.A = 'withheldMotif';
  await tab.run({ mode: 'group', group: 'A' });
  await quiet();
  const mixed = await scene(tab, 'mixed');
  mixed.messages.push(last());
  const a = boardOf(mixed).readings.find((group) => group.group === 'A');
  expect(a?.earlierLenses?.map((mark) => mark.lens)).toEqual(['motif']);
  expect(a?.tiles.find((tile) => tile.lens === 'headline')?.id.startsWith('lbt-run-5-to')).toBe(true);

  // 8. Call A's Run again, its reply unusable: A failed, every reading of A kept.
  modes.A = 'unusable';
  await tab.run({ mode: 'group', group: 'A' });
  await quiet();
  const failedKept = await scene(tab, 'failed-kept');
  failedKept.messages.push(last());
  expect(statuses(boardOf(failedKept))).toEqual(['A:failed', 'B:ok', 'C:ok', 'D:ok', 'E:ok', 'G:ok', 'F:failed']);
  expect(boardOf(failedKept).readings.find((group) => group.group === 'A')?.earlierLenses?.length).toBe(5);

  const lenses = Object.fromEntries(LIGHTBOX_LENSES.map((lens) => [lens.id, { label: lens.label, group: lens.group }]));
  fs.writeFileSync(
    path.join(OUT, 'keep-readings.json'),
    `${JSON.stringify({ lenses, fresh, firstFailed, read, rerunning, stopped, opinionKept, mixed, failedKept })}\n`
  );

  // The log names groups, lenses, counts and reasons; never the chapter's words.
  const log = `${host.lines.join('\n')}\n`;
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
