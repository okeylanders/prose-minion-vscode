/**
 * What a persona's passage search refuses before anything is sent (ADR
 * 2026-11-20 D19a, D21), through the real routes, room handler and session
 * with the fake engine:
 * - a delivery whose results do not fit what is left of the conversation
 *   records and sends nothing, and the card stays ready with its report
 *   (PR #296 F4);
 * - a Run while every held-result place holds a result not yet delivered
 *   plans and sends nothing, and says how to free one (PR #296 F5);
 * - a search that ended `complete` but did not read everything it planned
 *   is never sent by the host: it waits for Send partial results, and the
 *   card and the directive say what was not searched, the compact summary
 *   included; where not even the summary with that caveat fits, nothing is
 *   sent and the card keeps its report (PR #296 re-review P3);
 * - a search whose Stop was acknowledged is never sent by the host, even
 *   when the engine's result says it read everything: it waits for Send.
 *   The Stop is that operation's alone (PR #296 combined re-review).
 * Made-up text: Alice.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import {
  renderWorkshopPassageSearchDirective,
  renderWorkshopPassageSearchSummary
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import { workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS } from '@shared/constants/workshopPassageSearchWords';
import { aliceResult, callsOf } from './passageSearchRouteFixtures';
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

  it.each([
    ['a failed read', { calls: callsOf({ planned: 4, answered: 3, failed: 1 }) },
      '1 read did not finish, so the text it covers was not searched.', '1 call failed, so the text it covers was not searched.'],
    ['a reply cut off', { calls: callsOf({ planned: 4, answered: 4, cut: 1 }) },
      '1 reply was cut off, so instances past the cut are missing.', '1 reply was cut off at the length limit']
  ])('a complete search with %s waits for Send partial results, saying what was not searched', async (_name, change, cardWords, directiveWords) => {
    const { harness, search } = driver;
    search.result = aliceResult(3, change);
    const answers = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(answers.at(-1).message).toContain(cardWords);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(driver.requestTurns()).toHaveLength(0);
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));

    const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent.outcome).toBe('done');
    const [, message] = harness.service.continueConversation.mock.calls.at(-1) as unknown as [string, string];
    expect(message).toContain(directiveWords);
    expect(search.run).toHaveBeenCalledTimes(1);
  });

  describe('a Stop acknowledged for the search (PR #296 combined re-review)', () => {
    it('is never followed by the host\'s send, even when the engine reports everything read: the result waits for Send', async () => {
      const { harness, search } = driver;
      // An engine that ignores its signal and reports a search that read everything it planned.
      let finish!: () => void;
      search.run.mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => { finish = resolve; });
        return aliceResult();
      });
      const { requestId, running } = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      await driver.settle();
      const [stopped] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP);
      expect(stopped.outcome).toBe('done');
      finish();
      await running;
      await driver.settle();

      expect(driver.answersOf(requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'finished' }));
      expect(driver.answersOf(requestId).at(-1).message).not.toContain('The results were sent.');
      expect(harness.service.continueConversation).not.toHaveBeenCalled();
      expect(driver.requestTurns()).toHaveLength(0);
      expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
      // Held whole, as the engine reported it: only the acknowledged Stop kept the host from sending it.
      expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: false, counts: expect.objectContaining({ ended: 'complete' }) }));

      // Send is the writer's press: the held result goes, with no second search.
      const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent.outcome).toBe('done');
      expect(search.run).toHaveBeenCalledTimes(1);
      expect(harness.service.continueConversation).toHaveBeenCalledTimes(1);
      expect(await driver.view()).toEqual(expect.objectContaining({ status: 'delivered' }));
    });

    it('belongs to that search alone: the next card\'s search, read in full, is sent by the host', async () => {
      const { harness, search } = driver;
      search.hold = true;
      const { running } = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      await driver.settle();
      expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP))[0].outcome).toBe('done');
      await running;
      await driver.settle();
      const stoppedCard = driver.card;
      expect(await driver.view(stoppedCard.id)).toEqual(expect.objectContaining({ status: 'ready', partial: true }));

      search.hold = false;
      driver.card = await driver.askAgain();
      harness.service.continueConversation.mockClear();
      const answers = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      expect(answers.at(-1).message).toContain('The results were sent.');
      expect(harness.service.continueConversation).toHaveBeenCalledTimes(1);
      expect(await driver.view()).toEqual(expect.objectContaining({ status: 'delivered' }));
      expect(await driver.view(stoppedCard.id)).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    });
  });

  describe('a partial result in a nearly full conversation (PR #296 re-review P3)', () => {
    const CUT = '1 reply was cut off at the length limit; the instances finished before the cut are kept.';
    const roomOf = (freeInputTokens: number) => ({ contextLength: 200_000, requestTokens: 190_000, outputTokens: 9_000, headroomTokens: 920, freeInputTokens });

    it('sent where only the summary fits, the summary says what went unsearched', async () => {
      const { harness, search } = driver;
      search.result = aliceResult(3, { calls: callsOf({ planned: 4, answered: 4, cut: 1 }) });
      await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      const view = workshopPassageSearchView(search.result, driver.card.id);
      // One token short of the smallest frame by whole instances: only the summary fits.
      const least = Math.min(...[0, 1, 2, 3].map((shown) => estimateTextTokens(renderWorkshopPassageSearchDirective(view, shown))));
      harness.service.measureWorkshopReplyWindow.mockReturnValue(roomOf((least - 1) * 2) as never);

      const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent.outcome).toBe('done');
      const [, message] = harness.service.continueConversation.mock.calls.at(-1) as unknown as [string, string];
      expect(message).toContain('The writer\'s report has all of it');
      expect(message).toContain(CUT);
      expect(driver.ledger().at(-1)!.passageSearchDelivery?.shown).toBe(0);
    });

    it('where not even the summary with its caveat fits, nothing is sent, and the card keeps its report', async () => {
      const { harness, search } = driver;
      search.result = aliceResult(3, { calls: callsOf({ planned: 4, answered: 4, cut: 1 }) });
      await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      const view = workshopPassageSearchView(search.result, driver.card.id);
      harness.service.measureWorkshopReplyWindow.mockReturnValue(roomOf((estimateTextTokens(renderWorkshopPassageSearchSummary(view)) - 1) * 2) as never);

      const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'results-too-large' }));
      expect(harness.service.continueConversation).not.toHaveBeenCalled();
      expect(driver.requestTurns()).toHaveLength(0);
      expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
      expect((await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT))[0].outcome).toBe('done');
    });
  });
});
