/**
 * A press reads group F, the Opinion, last (Slice 4D; ADR 2026-10-19 D6, D7
 * addendum), through the real LightboxReadingHandler, LightboxService,
 * runner, digest and gates. Only the provider is played, with the prompt
 * bundle's worked examples, and the writer's average is the synthetic
 * fixture's; no provider is called. The board reads ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain) with the group F
 * example's lenses, under its run token, so F's request is the example's
 * own.
 *
 * F starts only after the press's other groups settle, on the digest of
 * the board they left, and never after a stop. A re-read weighs the board
 * alone. Its standing follows what it cites: a cited lens read again or a
 * cited figure measured again makes it stale, an uncited one does not, and
 * an answer that lands after either lands stale, never current.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import type { LightboxBoard, LightboxOpinionTile, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { MessageType } from '@/shared/types/messages';
import type { LightboxWriterAverages } from '@/infrastructure/lightbox/LightboxNumbers';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { buildLightboxOpinionDigest, buildLightboxOpinionUserMessage } from '@/infrastructure/lightbox/LightboxOpinionDigest';
import { LIGHTBOX_OPINION_NOTHING_TO_WEIGH } from '@/infrastructure/lightbox/LightboxOpinionCall';
import { LIGHTBOX_OPINION_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxOpinionHandoff';
import { LIGHTBOX_OPINION_PHRASING_REASONS } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { WRITER_AVERAGES } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';
import { frame } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import {
  OPINION_EXAMPLE_LENSES_OFF,
  OPINION_EXAMPLE_PREFIX,
  opinionBody
} from '@/__tests__/infrastructure/lightbox/lightboxOpinionFixtures';
import {
  CHAPTER,
  CONTEXT_TEXT,
  createLightboxReadingHost,
  examples,
  groupOf,
  ok,
  opinionReplyFor,
  settle,
  type LightboxReadingHostOptions
} from './lightboxReadingHarness';

/** The groups the example's lenses read: C has every lens off. */
const CHAPTER_GROUPS: LightboxReadingGroupId[] = ['A', 'B', 'D', 'E'];
const SOURCE = { kind: 'file', text: CHAPTER, displayPath: 'Drafts/alice-1.md', rereadPath: '/workspace/Drafts/alice-1.md' } as const;

const answer = (request: InitialRunRequest): ExecutionResult =>
  ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);

/**
 * A host reading with the example's lenses, its first run under the
 * example's token; `hold` lists the groups whose answers wait for
 * `release(group)`.
 */
async function exampleHost(hold: readonly LightboxReadingGroupId[] = [], options: LightboxReadingHostOptions = {}) {
  const writer: { current: LightboxWriterAverages } = { current: WRITER_AVERAGES };
  const held = new Map<LightboxReadingGroupId, () => void>();
  let runs = 0;
  const host = await createLightboxReadingHost({
    writerBaseline: { measure: async () => writer.current },
    mintToken: () => (++runs === 1 ? `${OPINION_EXAMPLE_PREFIX}-run-token` : `run-${runs}-token`),
    respond: (request) => (hold.includes(groupOf(request))
      ? new Promise<ExecutionResult>((resolve) => {
        held.set(groupOf(request), () => resolve(answer(request)));
        request.options?.signal?.addEventListener('abort', () => resolve({ ...answer(request), cancelled: true }));
      })
      : answer(request)),
    ...options
  });
  const tab = host.openTab();
  await tab.setLenses(OPINION_EXAMPLE_LENSES_OFF);
  const release = async (group: LightboxReadingGroupId) => {
    const resolve = held.get(group);
    if (!resolve) {
      throw new Error(`group ${group} is not held`);
    }
    held.delete(group);
    resolve();
    await settle();
  };
  const board = (): LightboxBoard => {
    const current = host.service.currentBoard();
    if (!current) {
      throw new Error('expected a board');
    }
    return current;
  };
  const asked = () => host.runInitial.mock.calls.map(([request]) => groupOf(request));
  const groupF = () => board().readings.find((group) => group.group === 'F') as LightboxReadingGroup;
  const opinion = (): LightboxOpinionTile => {
    const tile = lightboxOpinionTile(board());
    if (!tile) {
      throw new Error('expected the Opinion on the board');
    }
    return tile;
  };
  return { host, tab, writer, held, release, board, asked, groupF, opinion };
}

/** The observations that cite any tile of `lens` on `board`. */
const citing = (tile: LightboxOpinionTile, board: LightboxBoard, lens: string) => {
  const ids = new Set(board.readings.flatMap((group) => group.tiles).filter((candidate) => candidate.lens === lens).map((candidate) => candidate.id));
  return tile.observations.filter((observation) => observation.cites.some((cite) => ids.has(cite.item))).map((observation) => observation.id);
};

describe('a press reads the Opinion last, on the board its other groups left (Slice 4D)', () => {
  it('starts F only after every other group has answered, and weighs the digest of their tiles', async () => {
    const press = await exampleHost(CHAPTER_GROUPS);
    await press.tab.run();
    await settle();
    expect(press.asked().sort()).toEqual(CHAPTER_GROUPS);
    for (const group of CHAPTER_GROUPS.slice(0, -1)) {
      await press.release(group);
      expect(press.asked()).not.toContain('F');
    }
    await press.release('E');
    expect(press.asked().at(-1)).toBe('F');
    const request = press.host.runInitial.mock.calls.at(-1)?.[0];
    // The board's digest as A–E left it: the worked example's request, byte for byte.
    expect(request?.userMessage).toBe(examples.F.request);
    expect(request?.systemMessage).toBe('SYSTEM lightbox/57-opinion.md + lightbox/45-example-group-f.md');

    const tile = press.opinion();
    expect([tile.observations.length, tile.views.length, tile.withheldViews.length]).toEqual([6, 3, 0]);
    expect(tile.id).toBe(`lbt-${OPINION_EXAMPLE_PREFIX}-F-1`);
    expect(tile.digest.key).toBe(buildLightboxOpinionDigest(press.board()).key);
    expect(lightboxOpinionStanding(tile, press.board())).toMatchObject({ stale: false, changed: [] });
    expect(press.tab.logged()).toContain(`Group F landed on digest ${tile.digest.key.slice(0, 12)}, the board it read: current`);
    expect(press.tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload).toMatchObject({ phase: 'finished', groupsBack: 5 });
  });

  it('never starts F once the press is stopped', async () => {
    const press = await exampleHost(CHAPTER_GROUPS);
    await press.tab.run();
    await settle();
    const token = press.tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload.token;
    await press.release('A');
    await press.tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: press.board().boardId, token });
    await settle();
    for (const group of ['B', 'D', 'E'] as const) {
      if (press.held.has(group)) {
        await press.release(group);
      }
    }
    expect(press.asked()).not.toContain('F');
    expect(press.groupF()).toMatchObject({ status: 'cancelled', tiles: [] });
  });

  it('sends F no paragraph, no context file and no path: the context changes the chapter calls, never the Opinion\'s', async () => {
    const press = await exampleHost();
    await press.tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    await press.tab.run();
    await settle();
    const requests = press.host.runInitial.mock.calls.map(([request]) => request);
    expect(requests.filter((request) => groupOf(request) !== 'F').every((request) => request.userMessage.includes(CONTEXT_TEXT))).toBe(true);
    const f = requests.find((request) => groupOf(request) === 'F');
    expect(f?.userMessage).toBe(examples.F.request);
    expect(f?.userMessage).not.toMatch(/⟦¶\d+⟧|Notes\/cast\.md|alice-1\.md|White Rabbit is a royal herald/);
  });

  it('re-reads the Opinion alone: one call, on the board as it stands, every other tile kept', async () => {
    const press = await exampleHost();
    await press.tab.run();
    await settle();
    const before = press.board();
    const others = before.readings.filter((group) => group.group !== 'F').flatMap((group) => group.tiles.map((tile) => tile.id));
    press.host.runInitial.mockClear();
    await press.tab.run({ mode: 'lens', lens: 'opinion' });
    await settle();
    expect(press.asked()).toEqual(['F']);
    expect(press.host.runInitial.mock.calls[0][0].userMessage).toBe(buildLightboxOpinionUserMessage(buildLightboxOpinionDigest(before)));
    expect(press.opinion().id).toBe('lbt-run-2-to-F-1');
    expect(press.board().readings.filter((group) => group.group !== 'F').flatMap((group) => group.tiles.map((tile) => tile.id))).toEqual(others);
  });

  it('prices F at its digest\'s bound, "up to", in the press and in its own re-read', async () => {
    const press = await exampleHost();
    const estimate = press.tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate;
    const f = estimate?.groups.find((call) => call.group === 'F');
    expect(estimate?.groups.map((call) => call.group)).toEqual(['A', 'B', 'D', 'E', 'F']);
    expect(f).toMatchObject({ lenses: ['opinion'], inputBound: 'digest' });
    expect(f?.inputTokens).toBeGreaterThan(PROMPT_BUDGETS.lightbox.opinionDigestTokens);
    const reread = estimate?.rereads.find((call) => call.lenses.includes('opinion'));
    expect(reread).toMatchObject({ group: 'F', lenses: ['opinion'], inputBound: 'digest', inputTokens: f?.inputTokens });
    expect(estimate?.groups.filter((call) => call.group !== 'F').every((call) => call.inputBound === undefined)).toBe(true);
  });

  it('fails F with nothing sent when nothing on the board is read and current', async () => {
    const press = await exampleHost();
    await press.tab.setLenses(LIGHTBOX_LENSES.map((lens) => lens.id).filter((lens) => lens !== 'opinion'));
    await press.tab.run();
    await settle();
    expect(press.asked()).toEqual([]);
    expect(press.groupF()).toMatchObject({ status: 'failed', error: LIGHTBOX_OPINION_NOTHING_TO_WEIGH, tiles: [] });
  });
});

describe('the Opinion\'s standing follows what it cites (Slice 4D)', () => {
  it('goes stale when a lens it cites is read again, naming the observations that cite it', async () => {
    const press = await exampleHost();
    await press.tab.run();
    await settle();
    const expected = citing(press.opinion(), press.board(), 'stock');
    expect(expected.length).toBeGreaterThan(0);
    await press.tab.run({ mode: 'lens', lens: 'stock' });
    await settle();
    const standing = lightboxOpinionStanding(press.opinion(), press.board());
    expect(standing).toMatchObject({ stale: true, readEarlier: false, changed: expected });
    expect(standing.note).toContain(`(${expected.join(', ')})`);
  });

  it('stays current when a lens it does not cite is read again', async () => {
    const press = await exampleHost();
    await press.tab.run();
    await settle();
    expect(citing(press.opinion(), press.board(), 'characters')).toEqual([]);
    await press.tab.run({ mode: 'lens', lens: 'characters' });
    await settle();
    expect(press.asked().at(-1)).toBe('B');
    expect(lightboxOpinionStanding(press.opinion(), press.board())).toMatchObject({ stale: false, changed: [] });
  });

  it('lands stale, never current, when a figure it cites was measured again while F was out', async () => {
    const press = await exampleHost(['F']);
    await press.tab.run();
    await settle();
    expect(press.held.has('F')).toBe(true);
    const read = buildLightboxOpinionDigest(press.board()).key;
    // The same file, read again under another average: same text, same board, measured again.
    press.writer.current = { ...WRITER_AVERAGES, counts: WRITER_AVERAGES.counts && { ...WRITER_AVERAGES.counts, sentences: 1_300 } };
    expect(await press.host.service.buildBoard(SOURCE)).toMatchObject({ kind: 'board', reused: true, board: { boardId: press.host.board.boardId } });
    await press.release('F');
    const tile = press.opinion();
    expect(tile.digest.key).toBe(read);
    const standing = lightboxOpinionStanding(tile, press.board());
    // O2 states the sentence-length figure, which now says something else.
    expect(standing).toMatchObject({ stale: true, changed: ['O2'] });
    const now = buildLightboxOpinionDigest(press.board()).key;
    expect(now).not.toBe(read);
    expect(press.tab.logged()).toContain(
      `Group F landed on digest ${read.slice(0, 12)}; the board's digest is now ${now.slice(0, 12)}: stale, 1 observation cites items that changed`
    );
  });

  it('lands current on the board it read when the same text is measured again under the same figures', async () => {
    const press = await exampleHost(['F']);
    await press.tab.run();
    await settle();
    const read = buildLightboxOpinionDigest(press.board()).key;
    expect(await press.host.service.buildBoard(SOURCE)).toMatchObject({ kind: 'board', reused: true });
    await press.release('F');
    expect(buildLightboxOpinionDigest(press.board()).key).toBe(read);
    expect(lightboxOpinionStanding(press.opinion(), press.board())).toMatchObject({ stale: false });
    expect(press.tab.logged()).toContain(`Group F landed on digest ${read.slice(0, 12)}, the board it read: current`);
  });

  it('never lands on a board whose text changed while F was out', async () => {
    const press = await exampleHost(['F']);
    await press.tab.run();
    await settle();
    const rebuilt = await press.host.service.buildBoard({ ...SOURCE, text: `${CHAPTER}\n\nA new last paragraph.` });
    expect(rebuilt).toMatchObject({ kind: 'board' });
    if (press.held.has('F')) {
      await press.release('F');
    }
    const board = press.board();
    expect(board.boardId).not.toBe(press.host.board.boardId);
    expect(lightboxOpinionTile(board)).toBeUndefined();
    expect(press.groupF().tiles).toEqual([]);
  });
});

describe('a host-minted id is identity, never evidence (PR #157 F-01)', () => {
  // The digits-first token is the witness; the letters-first one, otherwise identical, is the id-only control.
  it.each([['87654321-4c1d-4e2f-9a0b-1c2d3e4f5a6b'], ['abcdefab-4c1d-4e2f-9a0b-1c2d3e4f5a6b']])(
    'withholds a count that only the run token\'s digits hold, and never brings it (token %s)',
    async (token) => {
      const prefix = token.slice(0, 8);
      const invented = 'The image appears 87654321 times in the passage.';
      const host = await createLightboxReadingHost({
        writerBaseline: { measure: async () => WRITER_AVERAGES },
        mintToken: () => token,
        respond: (request) => {
          if (groupOf(request) !== 'F') {
            return answer(request);
          }
          // The worked example on this run's ids, with O1 and Neutral stating a count only the ids hold.
          const body = JSON.parse(JSON.stringify(opinionBody()).split(`lbt-${OPINION_EXAMPLE_PREFIX}-`).join(`lbt-${prefix}-`));
          body.observations[0] = { id: 'O1', text: invented, cites: [{ tile: `lbt-${prefix}-A-1`, quote: 0 }] };
          body.views.neutral.body = invented;
          return ok('F', frame('F', { version: 1, opinion: body }));
        }
      });
      const tab = host.openTab();
      await tab.setLenses(OPINION_EXAMPLE_LENSES_OFF);
      await tab.run();
      await settle();
      const board = host.service.currentBoard() as LightboxBoard;
      const tile = lightboxOpinionTile(board) as LightboxOpinionTile;
      expect(tile.id).toBe(`lbt-${prefix}-F-1`);
      expect(tile.withheldObservations.find((entry) => entry.id === 'O1')?.reason)
        .toBe(LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation'));
      expect(tile.views.map((view) => view.view)).toEqual(['blunt']);
      const bring = (view: 'neutral' | 'blunt') =>
        prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id, view }, board, examples.A.paragraphs);
      expect(bring('neutral')).toEqual({ ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.withheld });
      const blunt = bring('blunt');
      expect(blunt.ok && blunt.handoff.tile.claim).not.toContain('87654321');
    }
  );
});
