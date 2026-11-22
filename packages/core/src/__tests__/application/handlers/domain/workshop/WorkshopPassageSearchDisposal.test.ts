/**
 * Closing the Workshop panel while a passage search's results are being
 * delivered (ADR 2026-11-20 D19a; PR #296 F2). The aggregate outlives the
 * webview and the composition flushes it on disposal, so the provisional
 * request turn must leave in the disposal itself, while it is still the
 * active run, as preemption takes it: no outcome but an adopted reply may
 * leave a results turn with no reply.
 *
 * Closing earlier, while the search itself runs (PR #296 re-review), ends
 * the search's operation: the late result the abort-aware engine returns is
 * held nowhere, and nothing is posted on the closed panel's transport.
 * Made-up text: Alice.
 */

import { MessageType } from '@messages';
import { createWorkshopRouteTestHarness } from './WorkshopRouteTestHarness';
import { heldReply, passageSearchRouteDriver, type PassageSearchRouteDriver } from './passageSearchRouteDriver';

describe('closing the panel while a passage search is delivered', () => {
  let driver: PassageSearchRouteDriver;

  beforeEach(async () => {
    driver = await passageSearchRouteDriver();
  });

  it('takes the request turn with it, so the flush and a reopened panel hold no results turn and no receipt', async () => {
    const { harness, search } = driver;
    const before = driver.ledger().map((turn) => turn.id);
    const provider = heldReply(harness);
    const { running } = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    // The search read everything into an idle room, so the host is delivering it: the request turn stands while it runs.
    expect(driver.requestTurns()).toHaveLength(1);
    expect(harness.session.getSnapshot().activeRequestId).toBeDefined();

    // What the flush writes is the committed state at the moment it is asked for.
    const flushed: boolean[] = [];
    (harness.persistence.flush as jest.Mock).mockClear().mockImplementation(async () => {
      flushed.push(harness.session.exportCommittedState().turns.some((turn) => turn.passageSearchResults));
    });
    harness.handler.dispose();

    expect(flushed).toEqual([false]);
    expect(driver.requestTurns()).toHaveLength(0);
    expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
    expect(driver.ledger().map((turn) => turn.id)).toEqual(before);
    expect(harness.session.exportCommittedState().turns.some((turn) => turn.passageSearchResults)).toBe(false);

    // The provider answers after the panel closed: nothing is adopted, and nothing comes back.
    provider.reply('Three watch moments, all in one chapter.');
    await running;
    await driver.settle();
    expect(driver.ledger().map((turn) => turn.id)).toEqual(before);
    expect(driver.ledger().some((turn) => turn.passageSearchDelivery)).toBe(false);

    // Reopened: the card is pending again (the result was the closed window's), and no results turn is waiting there.
    const reopened = createWorkshopRouteTestHarness({ session: harness.session, passageSearch: search.ports });
    await reopened.router.route({ type: MessageType.WORKSHOP_REQUEST_SESSION, source: 'test', payload: {}, timestamp: 1 } as never);
    const turns = reopened.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns as Array<{ id: string; passageSearchRequest?: { view?: unknown }; passageSearchResults?: unknown }>;
    expect(turns.find((turn) => turn.id === driver.card.id)?.passageSearchRequest?.view).toEqual({ status: 'pending' });
    expect(turns.some((turn) => turn.passageSearchResults)).toBe(false);
    expect(search.run).toHaveBeenCalledTimes(1);
  });

  it('an ordinary reply in flight keeps its writer turn on close, as before', async () => {
    const { harness } = driver;
    heldReply(harness);
    void driver.route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And the Duchess?' });
    await driver.settle();
    const asked = driver.ledger().at(-1)!;
    expect(asked.content).toBe('And the Duchess?');

    harness.handler.dispose();
    expect(driver.ledger().at(-1)!.id).toBe(asked.id);
    expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
  });

  it('closing while the search runs: the late stopped result fills nothing, sends nothing and posts nothing', async () => {
    const { harness, search } = driver;
    search.hold = true;
    const { running } = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    const posts = () => (harness.postMessage as jest.Mock).mock.calls
      .map(([entry]) => entry.type as MessageType)
      .filter((type) => [MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT, MessageType.WORKSHOP_PASSAGE_SEARCH_PROGRESS, MessageType.WORKSHOP_SESSION_STATE].includes(type));
    const before = posts().length;

    harness.handler.dispose();
    // The abort-aware engine settles on the abort with what it found: a late, stopped result.
    search.progress({ calls: { planned: 4, done: 3 }, found: 2 });
    await running;
    await driver.settle();

    expect(posts()).toHaveLength(before);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(driver.requestTurns()).toHaveLength(0);
    expect(driver.logs()).not.toContain('run finished');
    expect(driver.logs()).toContain(`run ended turn=${driver.card.id} reason=window-closed`);
    // The closed window's holder was not filled: the card reads pending, as after any closed window.
    expect(await driver.view()).toEqual({ status: 'pending' });
  });

  it('a Stop with the panel open keeps what was found, ready to send', async () => {
    const { search } = driver;
    search.hold = true;
    const { running } = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP))[0].outcome).toBe('done');
    await running;
    await driver.settle();
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    expect(driver.harness.service.continueConversation).not.toHaveBeenCalled();
  });
});
