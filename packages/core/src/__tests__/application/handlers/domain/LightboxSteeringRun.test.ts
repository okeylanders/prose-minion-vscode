/**
 * A press reads group G, craft steering (Slice 4F), through the real
 * LightboxReadingHandler, LightboxService, runner, quote verifier and gates.
 * Only the provider is played, with the prompt bundle's worked examples; no
 * provider is called. G is asked with its own prompt files and a task that
 * says what an instance of each figure is, never a count; it is sent with
 * A–E, priced as a call of its own, and the Opinion waits for it. Its tiles
 * land minted on the host; an answer after a stop, or one framed for
 * another group, never lands. The board reads ¶1–¶8 of "Alice's Adventures
 * in Wonderland" (1865, public domain).
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import type { LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { MessageType } from '@/shared/types/messages';
import { createLightboxReadingHost, examples, groupOf, ok, opinionReplyFor, settle } from './lightboxReadingHarness';

const answer = (request: InitialRunRequest): ExecutionResult =>
  ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);

/** A host whose group G answer waits for `answerG(result)`, deaf to a stop, as a late reply would be. */
async function heldSteering() {
  let pendingG: ((result: ExecutionResult) => void) | undefined;
  let requestG: InitialRunRequest | undefined;
  const host = await createLightboxReadingHost({
    respond: (request) => {
      if (groupOf(request) !== 'G') {
        return answer(request);
      }
      requestG = request;
      return new Promise<ExecutionResult>((resolve) => { pendingG = resolve; });
    }
  });
  const tab = host.openTab();
  const answerG = async (result: ExecutionResult = ok('G')) => {
    pendingG?.(result);
    await settle();
  };
  const asked = () => host.runInitial.mock.calls.map(([request]) => groupOf(request));
  return { host, tab, answerG, asked, request: () => requestG };
}

const groupIn = (host: Awaited<ReturnType<typeof createLightboxReadingHost>>, id: LightboxReadingGroupId): LightboxReadingGroup => {
  const group = host.service.currentBoard()?.readings.find((candidate) => candidate.group === id);
  if (!group) {
    throw new Error(`expected group ${id} on the board`);
  }
  return group;
};

describe('a press with craft steering on (Slice 4F)', () => {
  it('asks group G with its own prompt files and the worked example\'s task, byte for byte', async () => {
    const host = await createLightboxReadingHost();
    await host.openTab().run();
    await settle();
    const request = host.runInitial.mock.calls.map(([call]) => call).find((call) => groupOf(call) === 'G');
    expect(request?.systemMessage).toBe('SYSTEM lightbox/00-lightbox-shared.md + lightbox/58-steering.md + lightbox/46-example-group-g.md');
    // The board is the worked example's chapter with no context, so its request is the example's own.
    expect(request?.userMessage).toBe(examples.G.request);
    expect(request?.userMessage).toContain('exactly these lens keys: "steering".');
    // What an instance is, never how many: no task line states a count.
    expect(request?.userMessage).not.toMatch(/\b(?:17|7|11) (?:being verbs|-ly words|intensifiers)/);
  });

  it('sends G with A–E at once, and starts the Opinion only once G has answered', async () => {
    const press = await heldSteering();
    await press.tab.run();
    await settle();
    expect([...press.asked()].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'G']);
    await press.answerG();
    expect(press.asked().at(-1)).toBe('F');
    expect(press.asked().filter((group) => group === 'F')).toHaveLength(1);
  });

  it('prices G as a call of its own, re-reads steering alone, and drops G when the lens is off', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    await tab.setLenses([]);
    const estimate = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate;
    expect(estimate?.groups.map((call) => call.group)).toEqual(['A', 'B', 'C', 'D', 'E', 'G', 'F']);
    expect(estimate?.groups.find((call) => call.group === 'G')?.lenses).toEqual(['steering']);
    expect(estimate?.rereads.find((call) => call.lenses.includes('steering'))).toMatchObject({ group: 'G', lenses: ['steering'] });
    await tab.setLenses(['steering']);
    const without = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate;
    expect(without?.groups.map((call) => call.group)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    await tab.run();
    await settle();
    expect(host.runInitial.mock.calls.map(([request]) => groupOf(request))).not.toContain('G');
    expect(groupIn(host, 'G')).toMatchObject({ tiles: [] });
  });

  it('lands G on the board: every reading and note minted on the host, each quote holding an instance', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    await tab.run();
    await settle();
    const group = groupIn(host, 'G');
    expect(group.status).toBe('ok');
    expect(group.lenses).toEqual(['steering']);
    expect(group.withheldClaims).toEqual([]);
    expect(group.tiles.map((tile) => tile.kind)).toEqual([
      'steering-reading', 'steering-note', 'steering-note', 'steering-reading', 'steering-note', 'steering-note',
      'steering-reading', 'steering-note', 'steering-note', 'steering-note'
    ]);
    expect(group.tiles.every((tile) => tile.id.startsWith('lbt-run-1-'))).toBe(true);
    expect(group.quoteChecks).toEqual([{ lens: 'steering', checked: 13, withheld: 0 }]);
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload).toMatchObject({ phase: 'finished', groupsBack: 7 });
  });

  it('re-reads craft steering in one call, replacing G\'s tiles and keeping every other group\'s', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    await tab.run();
    await settle();
    const before = host.service.currentBoard()?.readings ?? [];
    host.runInitial.mockClear();
    await tab.run({ mode: 'lens', lens: 'steering' });
    await settle();
    expect(host.runInitial.mock.calls.map(([request]) => groupOf(request))).toEqual(['G']);
    const after = groupIn(host, 'G');
    expect(after.tiles).toHaveLength(10);
    expect(after.tiles.every((tile) => tile.id.startsWith('lbt-run-2-'))).toBe(true);
    for (const id of ['A', 'B', 'C', 'D', 'E'] as const) {
      expect(groupIn(host, id).tiles.map((tile) => tile.id)).toEqual(before.find((group) => group.group === id)?.tiles.map((tile) => tile.id));
    }
  });

  it('never lands a G answer that comes after a stop, and never starts the Opinion', async () => {
    const press = await heldSteering();
    await press.tab.run();
    await settle();
    const token = press.tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload.token;
    await press.tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: press.host.board.boardId, token });
    await settle();
    expect(press.request()?.options?.signal?.aborted).toBe(true);
    await press.answerG();
    expect(groupIn(press.host, 'G')).toMatchObject({ status: 'cancelled', tiles: [] });
    expect(press.asked()).not.toContain('F');
  });

  it('never lands an answer framed for another group on G', async () => {
    const press = await heldSteering();
    await press.tab.run();
    await settle();
    await press.answerG(ok('G', examples.D.response));
    const group = groupIn(press.host, 'G');
    expect(group.tiles).toEqual([]);
    expect([group.status, group.error]).toEqual([
      'failed',
      'The reading came back unusable (The group G response must contain exactly one ===LIGHTBOX_GROUP_G_V1===). ' +
        'The complete response could not be saved; see the Prose Minion output for details. Read the rest to try again.'
    ]);
    // The other groups and the Opinion still read.
    expect(groupIn(press.host, 'D').tiles.length).toBeGreaterThan(0);
    expect(press.asked().at(-1)).toBe('F');
  });
});
