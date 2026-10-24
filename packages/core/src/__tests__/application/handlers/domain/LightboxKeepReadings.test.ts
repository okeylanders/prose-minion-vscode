/**
 * Every re-run keeps the old readings until the new ones land (Slice 4J,
 * epic decision 49, superseding decision 42's clear-first and generalizing
 * decision 47), through the real handlers, service, runner, store and
 * library (`lightboxBoardsHarness`).
 *
 * In every run scope (`all`, `rest`, `group` with and without a widget's
 * lens, and a tile's `lens`) a usable new block replaces its lens's reading,
 * and a failed call, a Stop, a reply cut off before the lens's block, a
 * withheld block and a block with no usable tile all keep the earlier one,
 * marked earlier with the host's reason. One call's lenses are decided on
 * their own; the Opinion follows the same rule in every scope; per-lens
 * provenance names the run, model and time on screen; saves and reloads
 * hold the kept readings; stale marks stay; late replies of an older run are
 * ignored.
 *
 * Only the engine's replies are stand-ins: group A's worked example, as it
 * came, with its motif block withheld or left with no usable tile, cut off
 * at the output ceiling inside its motif block, failed, or held. The chapter
 * is ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain). No
 * provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType, type LightboxBoard, type LightboxReadingGroup, type LightboxReadingGroupId, type LightboxRunScope } from '@/shared/types/messages';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_KEEP_REASONS, lightboxEarlierReason, lightboxLensModel, lightboxLensProvenance } from '@shared/constants/lightboxProvenance';
import { LIGHTBOX_CEILING_CUT_REASON, LIGHTBOX_CEILING_UNREACHED_REASON } from '@shared/constants/lightboxCallNotes';
import { LIGHTBOX_OPINION_BASIS_RULE_ID } from '@shared/constants/lightboxOpinionBasis';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { deferred } from './lightboxHandlerHarness';
import { examples, groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { frame, framedJson } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';

type Mode = 'ok' | 'fail' | 'hold' | 'withhold' | 'noTile' | 'cut';
type Host = ReturnType<typeof createLightboxBoardsHost>;
type Tab = ReturnType<Host['openTab']>;

const FAILED = 'The call failed before a reading came back. Press Finish or Analyze to try again.';
const STOPPED = 'Stopped before this group came back.';
const FIRST_AT = 1_761_296_400_000; // 2025-10-24T09:00:00Z
const SECOND_AT = FIRST_AT + 8 * 60_000;

/** Group A's worked example, as `mode` has it: its motif block withheld, left with no usable tile, or cut off inside. */
function groupA(mode: Mode): { raw: string; finishReason?: 'length' } {
  const raw = examples.A.response;
  if (mode === 'cut') {
    return { raw: raw.slice(0, raw.indexOf('"motifs"') + 200), finishReason: 'length' };
  }
  const json = framedJson(raw) as { motifs: { friction?: string; items: Array<{ evidence: Array<{ quote: string }> }> } };
  if (mode === 'withhold') {
    delete json.motifs.friction;
  }
  if (mode === 'noTile') {
    json.motifs.items.forEach((item) => item.evidence.forEach((quote) => { quote.quote = 'a quote that stands nowhere in the chapter at all'; }));
  }
  return { raw: frame('A', json) };
}

/** A host with the chapter boarded and every call read by run 1, whose replies follow `engine`. */
async function readBoard() {
  const engine: { modes: Partial<Record<LightboxReadingGroupId, Mode>>; gate?: ReturnType<typeof deferred<void>>; model?: string; clock: number } = {
    modes: {},
    clock: FIRST_AT
  };
  const host = createLightboxBoardsHost({
    now: () => engine.clock,
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      const group = groupOf(request);
      const mode = engine.modes[group] ?? 'ok';
      if (mode === 'hold') {
        await engine.gate?.promise;
      }
      if (mode === 'fail') {
        throw new Error('stub provider: no reply');
      }
      const reply = group === 'A' ? groupA(mode) : { raw: group === 'F' ? opinionReplyFor(request) : examples[group].response };
      return { ...ok(group, reply.raw), ...(reply.finishReason ? { finishReason: reply.finishReason } : {}), ...(engine.model ? { modelId: engine.model } : {}) };
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  expect(host.service.currentBoard()?.readings.every((group) => group.status === 'ok')).toBe(true);
  engine.clock = SECOND_AT;
  engine.model = 'provider/model-b';
  return { host, tab, engine };
}

const groupOn = (host: Host, group: LightboxReadingGroupId): LightboxReadingGroup =>
  host.service.currentBoard()?.readings.find((entry) => entry.group === group) as LightboxReadingGroup;
const motifIds = (host: Host) => groupOn(host, 'A').tiles.filter((tile) => tile.lens === 'motif').map((tile) => tile.id);

async function stop(host: Host, tab: Tab) {
  const run = host.runner.activeRun(host.service.currentBoard()?.boardId as string);
  await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: run?.boardId, token: run?.token });
  await quiet();
}

/** Run `scope` with group A's reply as `mode`, stopping it when held. */
async function rerun(host: Host, tab: Tab, engine: Awaited<ReturnType<typeof readBoard>>['engine'], scope: LightboxRunScope | 'lens', mode: Mode) {
  engine.modes.A = mode === 'hold' ? 'hold' : mode;
  if (mode === 'hold') {
    engine.gate = deferred<void>();
  }
  if (scope === 'lens') {
    await tab.press('motif');
  } else {
    await tab.run(scope);
  }
  await quiet();
  if (mode === 'hold') {
    // While it runs, the motif's earlier reading stays on the board.
    expect(groupOn(host, 'A')).toMatchObject({ status: 'running' });
    expect(groupOn(host, 'A').pending).toContain('motif');
    expect(motifIds(host).length).toBeGreaterThan(0);
    await stop(host, tab);
    engine.gate?.resolve();
    await quiet();
  }
}

const SCOPES: Array<[string, LightboxRunScope | 'lens']> = [
  ['Run AI analyses / Re-analyze (all)', { mode: 'all' }],
  ['a call\'s Run A (group)', { mode: 'group', group: 'A' }],
  ['the Motifs widget\'s Analyze (group, with its lens)', { mode: 'group', group: 'A', lens: 'motif' }],
  ['the inspector\'s Re-analyze this tile (lens)', 'lens']
];

const KEEPS: Array<[Mode, string, (reason: string | undefined) => void]> = [
  ['fail', 'the call fails', (reason) => expect(reason).toBe(FAILED)],
  ['hold', 'the run is stopped', (reason) => expect(reason).toBe(STOPPED)],
  ['cut', 'the reply is cut off inside the motif block', (reason) => expect(reason?.startsWith(LIGHTBOX_CEILING_CUT_REASON)).toBe(true)],
  ['withhold', 'the motif block is withheld', (reason) => expect(reason).toBe('The motifs block names no friction; every lens must say where it strains.')],
  ['noTile', 'the motif block draws no usable tile', (reason) => expect(reason).toBe(LIGHTBOX_KEEP_REASONS.noTile(3))]
];

describe.each(SCOPES)('in %s', (_name, scope) => {
  it('a usable new block replaces the earlier reading', async () => {
    const { host, tab, engine } = await readBoard();
    const before = motifIds(host);
    await rerun(host, tab, engine, scope, 'ok');
    expect(motifIds(host).length).toBeGreaterThan(0);
    expect(motifIds(host).some((id) => before.includes(id))).toBe(false);
    expect(lightboxEarlierReason(groupOn(host, 'A'), 'motif')).toBeUndefined();
    expect(lightboxLensProvenance(groupOn(host, 'A'), 'motif')).toMatchObject({ model: 'provider/model-b', at: new Date(SECOND_AT).toISOString() });
  });

  it.each(KEEPS)('keeps the earlier reading when %s (%s), with the reason', async (mode, _what, reasonIs) => {
    const { host, tab, engine } = await readBoard();
    const before = groupOn(host, 'A').tiles.filter((tile) => tile.lens === 'motif');
    await rerun(host, tab, engine, scope, mode);
    expect(groupOn(host, 'A').tiles.filter((tile) => tile.lens === 'motif')).toEqual(before);
    reasonIs(lightboxEarlierReason(groupOn(host, 'A'), 'motif'));
    expect(lightboxLensModel(groupOn(host, 'A'), 'motif')).toBe('provider/model-v1');
    expect(host.runner.activeRun(host.service.currentBoard()?.boardId as string)).toBeUndefined();
  });
});

describe('Finish (rest) after a call that did not land', () => {
  it.each([...KEEPS.filter(([mode]) => mode !== 'fail')])('keeps the earlier reading again when %s, and replaces it once one lands', async (mode, _what, reasonIs) => {
    const { host, tab, engine } = await readBoard();
    const before = groupOn(host, 'A').tiles.filter((tile) => tile.lens === 'motif');
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'fail');
    expect(groupOn(host, 'A').status).toBe('failed');
    await rerun(host, tab, engine, { mode: 'rest' }, mode);
    expect(groupOn(host, 'A').tiles.filter((tile) => tile.lens === 'motif')).toEqual(before);
    reasonIs(lightboxEarlierReason(groupOn(host, 'A'), 'motif'));
    if (groupOn(host, 'A').status !== 'ok') {
      await rerun(host, tab, engine, { mode: 'rest' }, 'ok');
    } else {
      await rerun(host, tab, engine, { mode: 'all' }, 'ok');
    }
    expect(motifIds(host).some((id) => before.some((tile) => tile.id === id))).toBe(false);
    expect(lightboxEarlierReason(groupOn(host, 'A'), 'motif')).toBeUndefined();
  });
});

describe('one call\'s lenses are decided on their own', () => {
  it('replaces the headline and keeps the motif, tension, gravity and palette when the reply is cut off inside the motifs (mixed outcomes)', async () => {
    const { host, tab, engine } = await readBoard();
    const before = groupOn(host, 'A');
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'cut');
    const after = groupOn(host, 'A');
    expect(after.status).toBe('ok');
    const lensIds = (group: LightboxReadingGroup, lens: string) => group.tiles.filter((tile) => tile.lens === lens).map((tile) => tile.id);
    expect(lensIds(after, 'headline').some((id) => lensIds(before, 'headline').includes(id))).toBe(false);
    for (const lens of ['motif', 'tension', 'gravity', 'palette'] as const) {
      expect(lensIds(after, lens)).toEqual(lensIds(before, lens));
    }
    expect(lightboxEarlierReason(after, 'headline')).toBeUndefined();
    expect(lightboxEarlierReason(after, 'tension')?.startsWith(LIGHTBOX_CEILING_UNREACHED_REASON)).toBe(true);
    // Each lens names the run, model and time on screen; the group's model is its latest call's.
    expect(lightboxLensProvenance(after, 'headline')).toEqual({ lens: 'headline', run: 'run-2-token', model: 'provider/model-b', at: new Date(SECOND_AT).toISOString() });
    expect(lightboxLensProvenance(after, 'motif')).toEqual({ lens: 'motif', run: 'run-1-token', model: 'provider/model-v1', at: new Date(FIRST_AT).toISOString() });
    expect(after.model).toBe('provider/model-b');
    // Usage adds up both calls group A paid for.
    expect(after.usage).toMatchObject({ totalTokens: 2_400, requestCount: 2 });
    // The row on screen names both models, and its cost both calls (seven at $0.01, then A again).
    const row = (await tab.shelf(host.service.currentBoard()?.boardId as string)).shelf.boards.find((entry) => entry.onScreen);
    expect(row?.models).toEqual(['provider/model-b', 'provider/model-v1']);
    expect(row?.costUsd).toBeCloseTo(0.08);
  });

  it('names only the models of the readings on screen: a failed call\'s model is not one', async () => {
    const { host, tab, engine } = await readBoard();
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'withhold');
    await rerun(host, tab, engine, { mode: 'group', group: 'B' }, 'ok');
    engine.model = 'provider/model-c';
    engine.modes.C = 'fail';
    await tab.run({ mode: 'group', group: 'C' });
    await quiet();
    const row = (await tab.shelf(host.service.currentBoard()?.boardId as string)).shelf.boards.find((entry) => entry.onScreen);
    expect(row?.models).not.toContain('provider/model-c');
    expect(row?.models).toEqual(['provider/model-b', 'provider/model-v1']);
  });
});

describe('the Opinion keeps its reading in every scope', () => {
  async function failingF(host: Host, tab: Tab, engine: Awaited<ReturnType<typeof readBoard>>['engine'], scope: LightboxRunScope) {
    engine.modes.F = 'fail';
    await tab.run(scope);
    await quiet();
  }

  it('in a run of every call: the other calls land, and the old Opinion stays when its call fails', async () => {
    const { host, tab, engine } = await readBoard();
    const opinion = groupOn(host, 'F').tiles;
    await failingF(host, tab, engine, { mode: 'all' });
    expect(groupOn(host, 'F')).toMatchObject({ status: 'failed', tiles: opinion, earlierLenses: [{ lens: 'opinion', reason: FAILED }] });
    expect(groupOn(host, 'B').tiles.every((tile) => tile.id.startsWith('lbt-run-2-to'))).toBe(true);
    // It cites what the run replaced, so its standing says it is stale; the board says it is the earlier one.
    const board = host.service.currentBoard() as LightboxBoard;
    expect(lightboxOpinionStanding(lightboxOpinionTile(board) as NonNullable<ReturnType<typeof lightboxOpinionTile>>, board).stale).toBe(true);
  });

  it('in Finish after it: kept again when it fails, replaced when it lands', async () => {
    const { host, tab, engine } = await readBoard();
    const opinion = groupOn(host, 'F').tiles;
    await failingF(host, tab, engine, { mode: 'all' });
    await failingF(host, tab, engine, { mode: 'rest' });
    expect(host.runner.activeRun('board-1')).toBeUndefined();
    expect(groupOn(host, 'F')).toMatchObject({ status: 'failed', tiles: opinion });
    engine.modes.F = 'ok';
    await tab.run({ mode: 'rest' });
    await quiet();
    expect(groupOn(host, 'F').status).toBe('ok');
    expect(groupOn(host, 'F').tiles.some((tile) => opinion.some((old) => old.id === tile.id))).toBe(false);
    expect(groupOn(host, 'F').earlierLenses).toBeUndefined();
  });

  it('moves the citation basis rule only when a new Opinion lands, never for a call that kept the earlier one', async () => {
    const { host, tab, engine } = await readBoard();
    host.service.updateReadings('board-1', (readings) => readings, undefined, { opinionBasis: 'an-earlier-basis-rule' });
    const opinion = groupOn(host, 'F').tiles;
    // F's reply holds no observation: its block is withheld, so the earlier Opinion stays, under its own rule.
    host.runInitial.mockImplementationOnce(async (request: InitialRunRequest) => ok(groupOf(request), frame('F', {
      version: 1,
      opinion: { observations: [], views: {}, friction: 'Nothing to weigh.' }
    })));
    await tab.run({ mode: 'group', group: 'F' });
    await quiet();
    expect(groupOn(host, 'F')).toMatchObject({ status: 'ok', tiles: opinion });
    expect(lightboxEarlierReason(groupOn(host, 'F'), 'opinion')).toBeDefined();
    expect(host.service.currentBoard()?.rules.opinionBasis).toBe('an-earlier-basis-rule');
    expect(engine.modes.F).toBeUndefined();

    await tab.run({ mode: 'group', group: 'F' });
    await quiet();
    expect(host.service.currentBoard()?.rules.opinionBasis).toBe(LIGHTBOX_OPINION_BASIS_RULE_ID);
    expect(groupOn(host, 'F').earlierLenses).toBeUndefined();
  });
});

describe('saved boards hold the kept readings', () => {
  const OWN = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';
  const fileOf = (host: Host) => {
    const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN))));
    if (decoded.kind !== 'board') {
      throw new Error('not a board');
    }
    const held = lightboxBoardOfFile(decoded.file);
    if (held.kind !== 'board') {
      throw new Error('not one board');
    }
    return held.board;
  };

  it('a failed call\'s save rewrites the board\'s one file with the earlier readings, their marks and provenance, and a reload restores them', async () => {
    const { host, tab, engine } = await readBoard();
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'fail');
    expect(host.savedFiles()).toEqual([OWN]);
    const saved = fileOf(host).readings.find((group) => group.group === 'A');
    expect(saved).toEqual(groupOn(host, 'A'));
    expect(saved?.earlierLenses?.map((mark) => mark.lens)).toEqual(['headline', 'motif', 'tension', 'gravity', 'palette']);
    expect(saved?.provenance?.length).toBe(5);

    const reloaded = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const again = reloaded.openTab();
    await again.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await again.shelf(null);
    await quiet();
    expect(reloaded.service.currentBoard()?.readings.find((group) => group.group === 'A')).toEqual(saved);
  });

  it('a Stop earns no save of its own and loses nothing: the file stays as the last landing left it', async () => {
    const { host, tab, engine } = await readBoard();
    const bytes = host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN));
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'hold');
    expect(groupOn(host, 'A')).toMatchObject({ status: 'cancelled' });
    expect(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN))).toEqual(bytes);
    expect(motifIds(host)).toEqual(fileOf(host).readings.find((group) => group.group === 'A')?.tiles.filter((tile) => tile.lens === 'motif').map((tile) => tile.id));
  });
});

describe('a late reply of an older run never replaces a newer reading', () => {
  it('ignores a stopped run\'s reply that arrives while the next run reads, and after it lands', async () => {
    const { host, tab, engine } = await readBoard();
    // Run 2 holds A's reply and is stopped; its reply is still out.
    engine.modes.A = 'hold';
    const late = deferred<void>();
    engine.gate = late;
    await tab.run({ mode: 'group', group: 'A' });
    await quiet();
    await stop(host, tab);
    // Run 3 holds too, then the older reply comes back: nothing lands.
    const next = deferred<void>();
    engine.gate = next;
    await tab.run({ mode: 'group', group: 'A' });
    await quiet();
    const during = groupOn(host, 'A');
    late.resolve();
    await quiet();
    expect(groupOn(host, 'A')).toEqual(during);
    // Run 3 lands; its readings stand.
    next.resolve();
    await quiet();
    expect(motifIds(host).every((id) => id.startsWith('lbt-run-3-to'))).toBe(true);
  });
});

describe('a kept earlier reading of changed text keeps its stale mark', () => {
  it('stays stale through a failed or stopped call, and is fresh once a new one lands', async () => {
    const { host, tab, engine } = await readBoard();
    host.writeChapter(CHAPTER_PATH, `${CHAPTER}\n\nAnd so it went on.`);
    await tab.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await quiet();
    const carried = groupOn(host, 'A');
    expect(carried.staleLenses?.map((mark) => mark.lens)).toContain('motif');
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'fail');
    expect(groupOn(host, 'A').staleLenses).toEqual(carried.staleLenses);
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'hold');
    expect(groupOn(host, 'A').staleLenses).toEqual(carried.staleLenses);
    await rerun(host, tab, engine, { mode: 'group', group: 'A' }, 'ok');
    // The new text has a ninth paragraph, and the example's tension still scores eight: that block is withheld, so
    // the earlier, stale arc stays, stale; every other lens's new reading lands fresh.
    expect(groupOn(host, 'A').staleLenses?.map((mark) => mark.lens)).toEqual(['tension']);
    expect(lightboxEarlierReason(groupOn(host, 'A'), 'tension')).toContain('scores');
    expect(lightboxEarlierReason(groupOn(host, 'A'), 'motif')).toBeUndefined();
  });
});
