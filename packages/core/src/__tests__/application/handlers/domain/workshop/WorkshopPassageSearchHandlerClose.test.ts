/**
 * The passage-search route owner after its panel closed (PR #296 re-review),
 * against contract doubles: an engine that ignores its abort and returns a
 * late result, a spied directed-run port, and the real open-room instance.
 * A late complete result never reaches the directed-run port, nothing is
 * held, and nothing is posted; with the panel open the same double does
 * reach the port. Made-up text: Alice.
 */

import type { WorkshopTurn } from '@messages';
import type { PassageSearchPlan, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { WorkshopPassageSearchHandler, type WorkshopPassageSearchPorts } from '@handlers/domain/workshop/WorkshopPassageSearchHandler';
import { WorkshopOpenRoomInstance } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import { aliceResult, planOf, QUESTION } from './passageSearchRouteFixtures';

const CARD: WorkshopTurn = {
  id: 'turn-2', role: 'assistant', participant: 'host', personaId: 'jill', personaLabel: 'Jill', content: 'Asking.', timestamp: 1,
  passageSearchRequest: { question: QUESTION, scopes: [{ kind: 'excerpt' }] }
} as WorkshopTurn;

function closedPanelRig() {
  const late: { plan?: (plan: PassageSearchPlan) => void; run?: (result: PassageSearchResult) => void } = {};
  const holdPlan = { on: false };
  const ports: WorkshopPassageSearchPorts = {
    engine: {
      plan: jest.fn(async () => (holdPlan.on
        ? new Promise((resolve) => { late.plan = (plan) => resolve({ kind: 'planned', plan }); })
        : { kind: 'planned', plan: planOf('key-1') })) as never,
      // A contract double: it ignores the abort, and returns whatever the test hands it, whenever.
      run: jest.fn(() => new Promise<PassageSearchResult>((resolve) => { late.run = resolve; }))
    },
    listing: { listGroupFiles: jest.fn(async () => []) },
    reports: { save: jest.fn(async () => ({ status: 'saved' as const, filePath: 'prose-minion/reports/r.md', opened: true })) }
  };
  const room = new WorkshopOpenRoomInstance(() => undefined);
  const runDirected = jest.fn(async () => ({ committed: true }));
  const effects = { postSessionState: jest.fn(), markDirty: jest.fn() };
  const postMessage = jest.fn(async () => undefined);
  const handler = new WorkshopPassageSearchHandler(
    {
      readRoomRevision: () => 5,
      readRoomLedger: () => [CARD],
      getExcerpt: () => ({ text: 'Alice saw the White Rabbit take a watch out of its waistcoat-pocket.' }),
      getSelectedPersonaId: () => 'jill',
      isLivePersonaGuest: () => false,
      cancelPassageSearch: () => undefined,
      markPassageSearchResultsTurn: () => undefined
    },
    ports,
    {
      activeRunLabel: () => undefined,
      sessionOperationPending: () => false,
      runDirected,
      openRoomInstance: () => room.current(),
      onRoomReplaced: (listener) => room.subscribe(listener)
    },
    effects,
    postMessage,
    { appendLine: jest.fn() } as never
  );
  const payload = (requestId: string) => ({ requestId, roomRevision: 5, turnId: CARD.id, planKey: 'key-1' });
  const tick = async () => {
    for (let round = 0; round < 5; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  return { handler, ports, late, holdPlan, runDirected, effects, postMessage, payload, tick };
}

describe('the passage-search route owner after its panel closed', () => {
  it('with the panel open, the double\'s complete result reaches the directed-run port', async () => {
    const rig = closedPanelRig();
    const running = rig.handler.handleRun(rig.payload('ps-1'));
    await rig.tick();
    rig.late.run!(aliceResult(3));
    await running;
    expect(rig.runDirected).toHaveBeenCalledTimes(1);
  });

  it('a late complete result after the close never reaches the directed-run port, fills nothing and posts nothing', async () => {
    const rig = closedPanelRig();
    const running = rig.handler.handleRun(rig.payload('ps-1'));
    await rig.tick();
    expect(rig.ports.engine.run).toHaveBeenCalledTimes(1);
    rig.handler.dispose();
    const posts = rig.postMessage.mock.calls.length;
    const states = rig.effects.postSessionState.mock.calls.length;

    rig.late.run!(aliceResult(3));
    await running;
    await rig.tick();
    expect(rig.runDirected).not.toHaveBeenCalled();
    expect(rig.postMessage.mock.calls.length).toBe(posts);
    expect(rig.effects.postSessionState.mock.calls.length).toBe(states);
    expect(rig.handler.windowCard(CARD.id)).toBeUndefined();
  });

  it('a Run or an Estimate whose plan settles after the close starts nothing and posts nothing', async () => {
    const rig = closedPanelRig();
    rig.holdPlan.on = true;
    const estimating = rig.handler.handleEstimate(rig.payload('ps-1'));
    await rig.tick();
    const priced = rig.late.plan!;
    const running = rig.handler.handleRun(rig.payload('ps-2'));
    await rig.tick();
    const planned = rig.late.plan!;
    rig.handler.dispose();
    const posts = rig.postMessage.mock.calls.length;

    priced(planOf('key-1'));
    planned(planOf('key-1'));
    await Promise.all([estimating, running]);
    await rig.tick();
    expect(rig.ports.engine.run).not.toHaveBeenCalled();
    expect(rig.runDirected).not.toHaveBeenCalled();
    expect(rig.postMessage.mock.calls.length).toBe(posts);
  });

  it('after the close, a Run takes no slot and a Send reaches no port', async () => {
    const rig = closedPanelRig();
    rig.handler.dispose();
    await rig.handler.handleRun(rig.payload('ps-1'));
    await rig.handler.handleSend(rig.payload('ps-2'));
    expect(rig.ports.engine.plan).not.toHaveBeenCalled();
    expect(rig.runDirected).not.toHaveBeenCalled();
    expect(rig.postMessage).not.toHaveBeenCalled();
  });
});
