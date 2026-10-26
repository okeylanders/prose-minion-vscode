/**
 * "Re-analyze all" beside "Finish", through the host (Slice 4M, epic
 * decision 53, amending decision 41). The writer: "If you read chapter 8 and
 * one call failed, the button indicates finish last calls. But if you want to
 * just reload the file and re-run all you can't do that."
 *
 * Through the real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`): a board whose every call landed but one, which
 * failed. The run line the webview draws from the host's own board and
 * estimate offers Finish and Re-analyze all; Re-analyze all's scope makes the
 * host start every planned call, the failed one with the rest, and decision
 * 49 holds: every landed reading stays on the board while its call runs
 * again and until a usable new one replaces it, and a call that fails again
 * keeps its earlier readings. Finish, the control, still starts only the
 * failed call.
 *
 * Only the engine's replies are stand-ins: each group's worked example, or a
 * call that fails or is held. The chapter is ¶1–¶8 of "Alice's Adventures in
 * Wonderland" (1865, public domain). No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType, type ExtensionToWebviewMessage, type LightboxBoard, type LightboxReadingGroup, type LightboxReadingGroupId } from '@/shared/types/messages';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { lightboxEarlierReason } from '@shared/constants/lightboxProvenance';
import { buildLightboxRunLine } from '@hooks/domain/lightbox/lightboxRunLine';
import { deferred } from './lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

type Mode = 'ok' | 'fail' | 'hold';

const FAILED = 'The call failed before a reading came back. Press Finish or Analyze to try again.';

/** A host with the chapter boarded and read once, call B failing: every other call landed. */
async function boardWithOneFailed() {
  const engine: { modes: Partial<Record<LightboxReadingGroupId, Mode>>; gate: ReturnType<typeof deferred<void>> } = {
    modes: {},
    gate: deferred<void>()
  };
  engine.modes.B = 'fail';
  const host = createLightboxBoardsHost({
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      const group = groupOf(request);
      let mode = engine.modes[group] ?? 'ok';
      if (mode === 'hold') {
        // A held call answers as its group's mode says once it is let go.
        await engine.gate.promise;
        mode = engine.modes[group] ?? 'ok';
      }
      if (mode === 'fail') {
        throw new Error('stub provider: no reply');
      }
      return ok(group, group === 'F' ? opinionReplyFor(request) : undefined);
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.run({ mode: 'all' });
  await quiet();
  const board = () => host.service.currentBoard() as LightboxBoard;
  expect(board().readings.map((group) => `${group.group}:${group.status}`)).toEqual(['A:ok', 'B:failed', 'C:ok', 'D:ok', 'E:ok', 'G:ok', 'F:ok']);
  return { host, tab, engine, board };
}

type Setup = Awaited<ReturnType<typeof boardWithOneFailed>>;

const groupOn = (board: LightboxBoard, group: LightboxReadingGroupId): LightboxReadingGroup =>
  board.readings.find((entry) => entry.group === group) as LightboxReadingGroup;
const tileIds = (board: LightboxBoard) =>
  Object.fromEntries(board.readings.map((group) => [group.group, group.tiles.map((tile) => tile.id)]));

/** The run line the webview draws from the host's own board and estimate. */
async function runLine({ tab, board }: Setup) {
  return buildLightboxRunLine({ board: board(), estimate: await tab.estimate(), awaitingStart: false, providerPaused: false });
}

/** The groups the host said it started, on its latest run's progress. */
function started(tab: Setup['tab']): LightboxReadingGroupId[] | undefined {
  const progress = tab.posted
    .filter((message): message is Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_RUN_PROGRESS }> => message.type === MessageType.LIGHTBOX_RUN_PROGRESS)
    .filter((message) => message.payload.phase === 'started')
    .at(-1);
  return progress?.payload.groups;
}

/** Hold every call, press `scope` as the run line sends it, and return the board while the calls are out. */
async function pressHeld(setup: Setup, scope: Parameters<Setup['tab']['run']>[0]) {
  const { tab, engine, board } = setup;
  for (const group of LIGHTBOX_READING_GROUPS) {
    engine.modes[group] = 'hold';
  }
  engine.gate = deferred<void>();
  await tab.run(scope);
  await quiet();
  return board();
}

describe('Re-analyze all beside Finish, through the host (Slice 4M)', () => {
  it('is offered beside Finish on the host\'s board and estimate, priced for every planned call', async () => {
    const setup = await boardWithOneFailed();
    const view = await runLine(setup);
    expect(view.action).toMatchObject({ label: 'Finish', scope: { mode: 'rest' }, disabled: false });
    expect(view.action?.cost).toMatch(/^1 call · /);
    expect(view.secondaryAction).toMatchObject({ label: 'Re-analyze all', scope: { mode: 'all' }, disabled: false });
    expect(view.secondaryAction?.cost).toMatch(/^7 calls · /);
  });

  it('starts every planned call, the failed one with the rest, and keeps every landed reading while they run', async () => {
    const setup = await boardWithOneFailed();
    const { host, tab, engine, board } = setup;
    const before = tileIds(board());
    const view = await runLine(setup);

    const during = await pressHeld(setup, view.secondaryAction?.scope as { mode: 'all' });
    const run = host.runner.activeRun(during.boardId);
    expect(run?.groups).toEqual([...LIGHTBOX_READING_GROUPS]);
    expect(started(tab)).toEqual([...LIGHTBOX_READING_GROUPS]);
    // Every chapter call is out, and every landed reading is still on the board, tile for tile.
    for (const group of ['A', 'B', 'C', 'D', 'E', 'G'] as const) {
      expect(groupOn(during, group).status).toBe('running');
    }
    expect(tileIds(during)).toEqual(before);

    // The calls land: every reading is replaced by the new run's, and the failed call is read at last.
    for (const group of LIGHTBOX_READING_GROUPS) {
      engine.modes[group] = 'ok';
    }
    engine.gate.resolve();
    await quiet();
    const after = board();
    expect(after.readings.every((group) => group.status === 'ok')).toBe(true);
    expect(groupOn(after, 'B').tiles.length).toBeGreaterThan(0);
    for (const group of LIGHTBOX_READING_GROUPS) {
      expect(groupOn(after, group).tiles.some((tile) => before[group].includes(tile.id))).toBe(false);
      expect(groupOn(after, group).earlierLenses ?? []).toEqual([]);
    }
    expect(host.runner.activeRun(after.boardId)).toBeUndefined();
    // Every call landed: the run line is back to one press, Re-analyze.
    const next = await runLine(setup);
    expect(next.action).toMatchObject({ label: 'Re-analyze', scope: { mode: 'all' } });
    expect(next.secondaryAction).toBeUndefined();
  });

  it('keeps a landed call\'s readings when it fails in the re-run, said to be earlier, and lands the rest (decision 49)', async () => {
    const setup = await boardWithOneFailed();
    const { tab, engine, board } = setup;
    const before = tileIds(board());
    await pressHeld(setup, { mode: 'all' });
    for (const group of LIGHTBOX_READING_GROUPS) {
      engine.modes[group] = group === 'C' ? 'fail' : 'ok';
    }
    engine.gate.resolve();
    await quiet();
    const after = board();
    expect(groupOn(after, 'C')).toMatchObject({ status: 'failed' });
    expect(groupOn(after, 'C').tiles.map((tile) => tile.id)).toEqual(before.C);
    for (const lens of groupOn(after, 'C').lenses) {
      expect(lightboxEarlierReason(groupOn(after, 'C'), lens)).toBe(FAILED);
    }
    expect(groupOn(after, 'B').status).toBe('ok');
    expect(groupOn(after, 'B').tiles.length).toBeGreaterThan(0);
    // The run line offers Finish for C, and Re-analyze all beside it again.
    const view = await runLine(setup);
    expect(view.action).toMatchObject({ label: 'Finish', scope: { mode: 'rest' } });
    expect(view.secondaryAction).toMatchObject({ label: 'Re-analyze all', scope: { mode: 'all' } });
    // The webview was told: the board it last received holds the kept readings.
    const posted = tab.boards().at(-1) as LightboxBoard;
    expect(groupOn(posted, 'C').tiles.map((tile) => tile.id)).toEqual(before.C);
  });

  it('control: Finish still starts only the call that did not land', async () => {
    const setup = await boardWithOneFailed();
    const { host, tab, board } = setup;
    const before = tileIds(board());
    const view = await runLine(setup);
    const during = await pressHeld(setup, view.action?.scope as { mode: 'rest' });
    expect(host.runner.activeRun(during.boardId)?.groups).toEqual(['B']);
    expect(started(tab)).toEqual(['B']);
    expect(during.readings.filter((group) => group.status === 'running').map((group) => group.group)).toEqual(['B']);
    expect(tileIds(during)).toEqual(before);
  });
});
