/**
 * One call, run on its own (Slice 4I, epic decisions 42 and 44): the
 * `group` scope a widget's Analyze and a call's Run send.
 *
 * - **The host resolves it.** A call reads its lenses that are on, with the
 *   lens named even when it is off; a lens of another call, an unknown lens,
 *   or a group that is no model call (Measure) is refused, with nothing
 *   reserved or sent.
 * - **The Opinion alone** reads the board as it stands: with nothing on it
 *   read and current it is refused with its own reason; with readings, F is
 *   the one call made.
 * - **Craft steering alone** needs nothing read first: its task carries the
 *   board's measured counts, which every board has.
 * - **Re-running a call replaces it**, cleared first, as a full run does;
 *   other calls keep their readings.
 * - **One run at a time, and the press guards hold**: a call pressed while
 *   another run is going is refused; a press whose estimate or board changed
 *   while it was prepared is refused with nothing sent.
 *
 * The real LightboxReadingHandler, LightboxService and LightboxReadingRunner
 * over the worked examples' Alice chapter (public domain); only the engine,
 * the prompt files and the picker are stand-ins. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { InitialRunRequest, ExecutionResult } from '@orchestration/AgentRunContracts';
import { LightboxReadingGroupId, LightboxRunScope, MessageType } from '@/shared/types/messages';
import { LIGHTBOX_OPINION_NOTHING_TO_WEIGH } from '@shared/constants/lightboxOpinion';
import { LIGHTBOX_PRESS_SCOPE_REFUSALS } from '@handlers/domain/LightboxPressScope';
import { deferred } from './lightboxHandlerHarness';
import { createLightboxReadingHost, groupOf, ok, opinionReplyFor, settle } from './lightboxReadingHarness';

type Host = Awaited<ReturnType<typeof createLightboxReadingHost>>;
type Tab = ReturnType<Host['openTab']>;

const progress = (tab: Tab) => tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload);
const groupsCalled = (host: Host) => host.runInitial.mock.calls.map(([request]) => groupOf(request));
const readingOf = (host: Host, group: LightboxReadingGroupId) =>
  host.service.currentBoard()?.readings.find((entry) => entry.group === group);
/** The task's line naming the lenses a call reads. */
const lensLine = (request: InitialRunRequest) => /^Read group [A-G] with these lenses, and only these: (.*)\.$/m.exec(request.userMessage)?.[1];

async function setup() {
  const host = await createLightboxReadingHost();
  return { host, tab: host.openTab() };
}

describe('the group scope is checked before anything is reserved or sent', () => {
  it.each<[string, object, string]>([
    ['a lens of another call', { mode: 'group', group: 'B', lens: 'motif' }, 'Theme & motif is read in call A, not call B.'],
    ['Measure, which is no model call', { mode: 'group', group: 'Measure' }, LIGHTBOX_PRESS_SCOPE_REFUSALS.notACall],
    ['a group that does not exist', { mode: 'group', group: 'H' }, LIGHTBOX_PRESS_SCOPE_REFUSALS.notACall],
    ['no group at all', { mode: 'group', lens: 'voice' }, LIGHTBOX_PRESS_SCOPE_REFUSALS.notACall],
    ['a lens the board does not know', { mode: 'group', group: 'A', lens: 'nonsense' }, LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown],
    ['a list of lenses in place of a lens', { mode: 'group', group: 'A', lens: ['motif', 'palette'] }, LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown],
    ['a mode the host does not know', { mode: 'call', group: 'A' }, LIGHTBOX_PRESS_SCOPE_REFUSALS.unknown]
  ])('refuses %s', async (_label, scope, message) => {
    const { host, tab } = await setup();
    const key = await tab.setLenses([]);
    const prompts = host.loadPrompts.mock.calls.length;

    await tab.run(scope as LightboxRunScope, { estimateKey: key });
    await settle();

    expect(progress(tab)).toEqual([expect.objectContaining({ phase: 'refused', message, groups: [] })]);
    expect(host.loadPrompts.mock.calls.length).toBe(prompts);
    expect(host.runInitial).not.toHaveBeenCalled();
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    // Nothing was held: the next press runs.
    await tab.run({ mode: 'group', group: 'B' });
    await settle();
    expect(groupsCalled(host)).toEqual(['B']);
  });

  it('refuses a call whose every lens is off', async () => {
    const { host, tab } = await setup();
    await tab.run({ mode: 'group', group: 'B' }, { estimateKey: await tab.setLenses(['characters', 'voice', 'subtext']) });
    expect(progress(tab)).toEqual([expect.objectContaining({ phase: 'refused', message: 'Every lens of call B is off, so it has nothing to read.' })]);
    expect(host.runInitial).not.toHaveBeenCalled();
  });
});

describe('one call, run on its own', () => {
  it('reads that call alone: its lenses that are on, landed on the board, every other call untouched', async () => {
    const { host, tab } = await setup();
    await tab.run({ mode: 'group', group: 'B', lens: 'voice' }, { estimateKey: await tab.setLenses(['subtext']) });
    await settle();

    expect(groupsCalled(host)).toEqual(['B']);
    expect(lensLine(host.runInitial.mock.calls[0][0])).toBe('characters, voice');
    expect(progress(tab)[0]).toEqual(expect.objectContaining({ phase: 'started', groups: ['B'] }));
    // A call run on its own is a full run of its group, never a single-lens re-read.
    expect(progress(tab)[0].lens).toBeUndefined();
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'finished', groupsBack: 1 });
    expect(readingOf(host, 'B')).toMatchObject({ status: 'ok', lenses: ['characters', 'voice'] });
    expect(host.service.currentBoard()?.readings.filter((group) => group.group !== 'B').every((group) => group.status === 'not-run')).toBe(true);
  });

  it('adds the widget\'s own lens even when it is off, and leaves the call\'s other off lenses out', async () => {
    const { host, tab } = await setup();
    await tab.run({ mode: 'group', group: 'A', lens: 'gravity' }, { estimateKey: await tab.setLenses(['gravity', 'palette']) });
    await settle();

    expect(lensLine(host.runInitial.mock.calls[0][0])).toBe('headline, motifs, tension arc, lexical gravity');
    expect(readingOf(host, 'A')?.lenses).toEqual(['headline', 'motif', 'tension', 'gravity']);
  });

  it('re-runs a call that already has readings, clearing it first and replacing it whole; the other calls keep theirs', async () => {
    const { host, tab } = await setup();
    await tab.run();
    await settle();
    const before = host.service.currentBoard();
    const otherIds = before?.readings.filter((group) => group.group !== 'C').map((group) => group.tiles.map((tile) => tile.id));
    expect(before?.readings.find((group) => group.group === 'C')?.tiles.every((tile) => tile.id.startsWith('lbt-run-1-to'))).toBe(true);
    const boards = tab.ofType(MessageType.LIGHTBOX_BOARD).length;

    await tab.run({ mode: 'group', group: 'C', lens: 'spark' });
    await settle();

    // Started: call C cleared and running, as a full run clears its groups.
    const started = tab.ofType(MessageType.LIGHTBOX_BOARD)[boards].payload.board?.readings.find((group) => group.group === 'C');
    expect(started).toMatchObject({ status: 'running', tiles: [], lenses: [], pending: ['genre', 'lineage', 'spark'] });
    const after = host.service.currentBoard();
    const c = after?.readings.find((group) => group.group === 'C');
    expect(c?.status).toBe('ok');
    expect(c?.tiles.length).toBeGreaterThan(0);
    expect(c?.tiles.every((tile) => tile.id.startsWith('lbt-run-2-to'))).toBe(true);
    expect(after?.readings.filter((group) => group.group !== 'C').map((group) => group.tiles.map((tile) => tile.id))).toEqual(otherIds);
    expect(groupsCalled(host).slice(7)).toEqual(['C']);
  });

  it('runs craft steering (G) alone on a board nothing has read: its task carries the board\'s measured counts', async () => {
    const { host, tab } = await setup();
    await tab.run({ mode: 'group', group: 'G', lens: 'steering' });
    await settle();

    expect(groupsCalled(host)).toEqual(['G']);
    const task = host.runInitial.mock.calls[0][0].userMessage;
    expect(task).toContain('Read each of these figures by its id, whatever its rate.');
    expect(task).toMatch(/- `being-verbs`: an instance is /);
    expect(readingOf(host, 'G')).toMatchObject({ status: 'ok', lenses: ['steering'] });
    expect(readingOf(host, 'G')?.tiles.length).toBeGreaterThan(0);
  });
});

describe('the Opinion\'s Analyze runs group F alone, over the board as it stands', () => {
  it('is refused with the Opinion\'s own reason while nothing on the board is read and current, and nothing is held', async () => {
    const { host, tab } = await setup();
    const key = await tab.setLenses([]);
    const prompts = host.loadPrompts.mock.calls.length;
    await tab.run({ mode: 'group', group: 'F', lens: 'opinion' }, { estimateKey: key });
    await settle();

    expect(progress(tab)).toEqual([expect.objectContaining({ phase: 'refused', message: LIGHTBOX_OPINION_NOTHING_TO_WEIGH })]);
    expect(host.loadPrompts.mock.calls.length).toBe(prompts);
    expect(host.runInitial).not.toHaveBeenCalled();
    expect(readingOf(host, 'F')?.status).toBe('not-run');
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
  });

  it('is refused when every reading on the board is stale', async () => {
    const { host, tab } = await setup();
    await tab.run({ mode: 'group', group: 'B' });
    await settle();
    host.service.updateReadings(host.board.boardId, (readings) => readings.map((group) => ({
      ...group,
      staleLenses: group.lenses.map((lens) => ({ lens, readAgainst: 'earlier-hash' }))
    })));
    await tab.run({ mode: 'group', group: 'F', lens: 'opinion' });
    await settle();

    expect(progress(tab).at(-1)).toMatchObject({ phase: 'refused', message: LIGHTBOX_OPINION_NOTHING_TO_WEIGH });
    expect(groupsCalled(host)).toEqual(['B']);
  });

  it('with one call read, makes the Opinion\'s call alone, on that call\'s readings', async () => {
    const { host, tab } = await setup();
    await tab.run({ mode: 'group', group: 'B' });
    await settle();
    const characters = readingOf(host, 'B')?.tiles[0];

    await tab.run({ mode: 'group', group: 'F', lens: 'opinion' });
    await settle();

    expect(groupsCalled(host)).toEqual(['B', 'F']);
    const digest = host.runInitial.mock.calls[1][0].userMessage;
    expect(digest).toContain(`[${characters?.id}]`);
    expect(readingOf(host, 'F')).toMatchObject({ status: 'ok', lenses: ['opinion'] });
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'finished', groups: ['F'], groupsBack: 1 });
  });
});

describe('one run at a time, and the press guards hold for a call run on its own', () => {
  it('refuses a call pressed while another run is going, and Stop still stops the one going', async () => {
    const reply = deferred<void>();
    const host = await createLightboxReadingHost({
      respond: async (request): Promise<ExecutionResult> => {
        await reply.promise;
        return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
      }
    });
    const tab = host.openTab();
    await tab.run({ mode: 'group', group: 'B' });
    await settle();
    const running = host.runner.activeRun(host.board.boardId);
    expect(running?.groups).toEqual(['B']);

    await tab.run({ mode: 'group', group: 'C' });
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'refused', message: 'This board is already being read. Stop that run first.' });
    await tab.run({ mode: 'all' });
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'refused', message: 'This board is already being read. Stop that run first.' });
    expect(groupsCalled(host)).toEqual(['B']);

    await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: host.board.boardId, token: running?.token });
    reply.resolve();
    await settle();
    expect(progress(tab).at(-1)).toMatchObject({ phase: 'cancelled', groups: ['B'] });
    expect(readingOf(host, 'B')?.status).toBe('cancelled');
    expect(groupsCalled(host)).toEqual(['B']);
  });

  it.each([
    ['a lens turned off', /^The estimate changed since it was shown/, async (_host: Host, tab: Tab) => {
      void tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: ['voice'] });
    }],
    ['the model\'s price changed', /^The estimate changed since it was shown/, async (host: Host) => {
      host.setPricing({ promptUsdPerToken: 0.00003, completionUsdPerToken: 0.00015 });
    }],
    ['another board adopted', /^The board changed\. Read the board on screen\.$/, async (host: Host) => {
      await host.service.buildBoard({ kind: 'file', text: 'Another chapter.\n\nWith two paragraphs.', displayPath: 'Drafts/two.md' });
    }]
  ])('refuses, with nothing sent, a call whose inputs change while it is prepared: %s', async (_label, message, change) => {
    const { host, tab } = await setup();
    const key = await tab.setLenses([]);
    host.holdPrompts();
    const press = tab.run({ mode: 'group', group: 'B', lens: 'voice' }, { estimateKey: key });
    await settle();

    await change(host, tab);
    host.releasePrompts();
    await press;
    await settle();

    expect(host.runInitial).not.toHaveBeenCalled();
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    expect(progress(tab).find((entry) => entry.phase === 'refused')).toMatchObject({ reestimate: true, groups: ['B'], message: expect.stringMatching(message) });
  });

  it('refuses a call pressed at an estimate that is no longer current, before reading a prompt file', async () => {
    const { host, tab } = await setup();
    const key = await tab.setLenses([]);
    await tab.setLenses(['voice']);
    const prompts = host.loadPrompts.mock.calls.length;
    await tab.run({ mode: 'group', group: 'B', lens: 'voice' }, { estimateKey: key });
    expect(progress(tab)).toEqual([expect.objectContaining({ phase: 'refused', reestimate: true })]);
    expect(host.loadPrompts.mock.calls.length).toBe(prompts);
  });
});

describe('the estimate prices each call a widget or a call\'s Run sends', () => {
  it('prices a call run on its own exactly as the call it sends, its lenses those that are on', async () => {
    const { host, tab } = await setup();
    await tab.setLenses(['subtext', 'palette']);
    const estimate = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate;
    const b = estimate?.groups.find((call) => call.group === 'B');
    expect(b?.lenses).toEqual(['characters', 'voice']);
    expect(b?.costUsd).toBeGreaterThan(0);
    expect(estimate?.groups.find((call) => call.group === 'F')).toMatchObject({ lenses: ['opinion'], inputBound: 'digest' });

    await tab.run({ mode: 'group', group: 'B', lens: 'voice' });
    await settle();
    // The call sent reads exactly the lenses the estimate priced for it.
    expect(lensLine(host.runInitial.mock.calls[0][0])).toBe('characters, voice');
  });
});
