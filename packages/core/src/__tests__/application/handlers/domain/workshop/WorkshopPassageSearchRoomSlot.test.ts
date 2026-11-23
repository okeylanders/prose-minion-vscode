/**
 * The previous room's search never blocks the new room (ADR 2026-11-20 D20;
 * PR #296 re-review). Through the real routes, room handler and session,
 * with the harness's real open-room instance as the emitter: an old Run is
 * held open (its re-plan, or its search), room 5 is replaced by room 6
 * holding the same card under the same turn id, and the new card is priced,
 * cancelled or run at once. The old operation settling afterwards changes
 * nothing in the new room: it releases only its own slot. Made-up text:
 * Alice.
 */

import { MessageType } from '@messages';
import type { PassageSearchPlan, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { aliceResult, planOf } from './passageSearchRouteFixtures';
import { passageSearchRouteDriver, type PassageSearchRouteDriver } from './passageSearchRouteDriver';

describe('the previous room\'s search, once the room is replaced', () => {
  let driver: PassageSearchRouteDriver;

  /** Room 5 replaced by room 6: the same ledger, so the same card under the same turn id, announced by the real emitter. */
  const replaceWithTheSameCard = (): void => {
    const { harness } = driver;
    const state = harness.session.exportCommittedState();
    harness.session.hydrateCommittedState(state, { host: 'host-conv' } as never, harness.session.getConversationBehavior());
    harness.roomInstance.replaced();
  };

  /** An old Run whose re-plan is held open until `settle` resolves it with `plan`. */
  const oldRunHeldAtItsPlan = async () => {
    let resolve!: (outcome: { kind: 'planned'; plan: PassageSearchPlan }) => void;
    driver.search.plan.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const before = driver.harness.session.readRoomRevision();
    const old = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    replaceWithTheSameCard();
    expect(driver.harness.session.readRoomRevision()).not.toBe(before);
    return { old, settle: (plan: PassageSearchPlan) => resolve({ kind: 'planned', plan }) };
  };

  beforeEach(async () => {
    driver = await passageSearchRouteDriver();
  });

  it('the new card\'s Estimate and Cancel work at once, and the old plan settling afterwards changes nothing', async () => {
    const { old, settle } = await oldRunHeldAtItsPlan();

    const [priced] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
    expect(priced).toEqual(expect.objectContaining({ outcome: 'done', estimate: expect.objectContaining({ planKey: 'key-1' }) }));
    const [cancelled] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_CANCEL);
    expect(cancelled.outcome).toBe('done');
    expect(await driver.view()).toEqual({ status: 'cancelled' });

    settle(planOf('key-1'));
    await old.running;
    await driver.settle();
    expect(driver.answersOf(old.requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'room-changed' }));
    expect(driver.search.run).not.toHaveBeenCalled();
    expect(await driver.view()).toEqual({ status: 'cancelled' });
  });

  it('the new card\'s Run works at once, and the old plan settling afterwards, at another price, never clears the new search', async () => {
    const { old, settle } = await oldRunHeldAtItsPlan();
    driver.search.hold = true;
    const fresh = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    expect(driver.answersOf(fresh.requestId).map((answer) => answer.outcome)).toEqual(['started']);
    expect(await driver.view()).toEqual({ status: 'running' });

    // The old Run's plan comes back at another price: once its early exit would have emptied the slot.
    settle(planOf('key-elsewhere'));
    await old.running;
    await driver.settle();
    expect(driver.answersOf(old.requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'room-changed' }));
    expect(await driver.view()).toEqual({ status: 'running' });
    const [second] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(second).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'search-running' }));

    // The new search is still the one Stop reaches, and its result lands on the new card.
    expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP))[0].outcome).toBe('done');
    await fresh.running;
    await driver.settle();
    expect(driver.answersOf(fresh.requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'finished' }));
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    expect(driver.search.run).toHaveBeenCalledTimes(1);
  });

  it('an old search that ignores its abort and finishes after the new one began never clears or fills the new room', async () => {
    let finishOld!: (result: PassageSearchResult) => void;
    driver.search.run.mockImplementationOnce(() => new Promise((done) => { finishOld = done; }));
    const old = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    replaceWithTheSameCard();

    driver.search.hold = true;
    const fresh = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    expect(driver.answersOf(fresh.requestId).map((answer) => answer.outcome)).toEqual(['started']);

    finishOld(aliceResult(7));
    await old.running;
    await driver.settle();
    expect(driver.answersOf(old.requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'room-changed' }));
    expect(await driver.view()).toEqual({ status: 'running' });
    expect(driver.harness.service.continueConversation).not.toHaveBeenCalled();
    expect(driver.logs()).toContain(`run dropped turn=${driver.card.id} reason=room-changed`);

    driver.search.finish();
    await fresh.running;
    await driver.settle();
    expect(await driver.view()).toEqual(expect.objectContaining({ status: expect.stringMatching(/^(ready|delivered)$/) }));
  });
});
