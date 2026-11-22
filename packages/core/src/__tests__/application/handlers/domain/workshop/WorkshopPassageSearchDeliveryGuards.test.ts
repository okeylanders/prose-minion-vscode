/**
 * What a persona's passage search refuses before anything is sent (ADR
 * 2026-11-20 D19a, D21), through the real routes, room handler and session
 * with the fake engine:
 * - a delivery whose results do not fit what is left of the conversation
 *   records and sends nothing, and the card stays ready with its report
 *   (PR #296 F4);
 * - a Run while every held-result place holds a result not yet delivered
 *   plans and sends nothing, and says how to free one (PR #296 F5).
 * Made-up text: Alice.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS } from '@shared/constants/workshopPassageSearchWords';
import { aliceResult } from './passageSearchRouteFixtures';
import { passageSearchRouteDriver, type PassageSearchRouteDriver } from './passageSearchRouteDriver';

describe('a passage search\'s delivery, refused before anything is sent', () => {
  let driver: PassageSearchRouteDriver;

  beforeEach(async () => {
    driver = await passageSearchRouteDriver();
  });

  it('results that do not fit what is left of the conversation record nothing, send nothing, and stay ready with their report', async () => {
    const { harness, search } = driver;
    // A room nearly full: 80 tokens left, so a bound of 40 that not even the summary fits.
    harness.service.measureWorkshopReplyWindow.mockReturnValue({
      contextLength: 200_000, requestTokens: 190_000, outputTokens: 9_000, headroomTokens: 920, freeInputTokens: 80
    } as never);
    const ledgerBefore = driver.ledger().map((turn) => turn.id);

    const answers = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(answers.at(-1)).toEqual(expect.objectContaining({ outcome: 'finished' }));
    expect(answers.at(-1).message).toContain(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['results-too-large']);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(driver.ledger().map((turn) => turn.id)).toEqual(ledgerBefore);
    expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: false }));
    expect(driver.logs()).toContain(`delivery refused turn=${driver.card.id} reason=results-too-large`);

    // Send is refused the same way; the report still opens.
    const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'results-too-large' }));
    const [opened] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    expect(opened.outcome).toBe('done');

    // With room again, Send delivers the held result: no second search.
    harness.service.measureWorkshopReplyWindow.mockReturnValue(undefined);
    const [again] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(again.outcome).toBe('done');
    expect(search.run).toHaveBeenCalledTimes(1);
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'delivered' }));
  });

  it('five stopped searches in a row: the fifth is refused before anything is planned, until Send or Discard frees a place', async () => {
    const { harness, search } = driver;
    const bound = PROMPT_BUDGETS.workshopPassageSearch.heldResults;
    expect(bound).toBe(4);
    search.result = aliceResult(2, { ended: 'stopped' });
    const cards: WorkshopTurn[] = [driver.card];
    for (let index = 1; index <= bound; index += 1) {
      cards.push(await driver.askAgain());
    }
    const runOn = async (card: WorkshopTurn) => {
      driver.card = card;
      return (await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' })).at(-1);
    };
    for (const card of cards.slice(0, bound)) {
      expect((await runOn(card)).outcome).toBe('finished');
    }
    expect(search.run).toHaveBeenCalledTimes(bound);
    for (const card of cards.slice(0, bound)) {
      expect(await driver.view(card.id)).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    }

    const plans = search.plan.mock.calls.length;
    const refused = await runOn(cards[bound]);
    expect(refused).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'results-full', message: WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['results-full'] }));
    expect(refused.message).toContain('Send or Discard one of them');
    expect(search.plan.mock.calls.length).toBe(plans);
    expect(search.run).toHaveBeenCalledTimes(bound);
    expect(await driver.view(cards[bound].id)).toEqual({ status: 'pending' });
    // Every result the window holds is still there to send: none was evicted to make room.
    for (const card of cards.slice(0, bound)) {
      expect(await driver.view(card.id)).toEqual(expect.objectContaining({ status: 'ready' }));
    }

    // Discard frees a place.
    driver.card = cards[0];
    expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_DISCARD))[0].outcome).toBe('done');
    expect((await runOn(cards[bound])).outcome).toBe('finished');
    expect(search.run).toHaveBeenCalledTimes(bound + 1);

    // Full again: Send frees one too. The sent result is the one evicted when the next lands, never an unsent one.
    driver.card = cards[1];
    harness.service.continueConversation.mockResolvedValueOnce({ content: 'Two watch moments.', conversationId: 'host-conv', timestamp: new Date(0), toolName: 'workshop' } as never);
    expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND))[0].outcome).toBe('done');
    const sixth = await driver.askAgain();
    expect((await runOn(sixth)).outcome).toBe('finished');
    expect(await driver.view(cards[1].id)).toEqual(expect.objectContaining({ status: 'delivered', reportHeld: false }));
    for (const card of [cards[2], cards[3], cards[bound], sixth]) {
      expect(await driver.view(card.id)).toEqual(expect.objectContaining({ status: 'ready' }));
    }
  });
});
