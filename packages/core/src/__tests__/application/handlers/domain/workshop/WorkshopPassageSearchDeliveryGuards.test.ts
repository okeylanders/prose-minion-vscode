/**
 * What a persona's passage search refuses before anything is sent (ADR
 * 2026-11-20 D19a, D21), through the real routes, room handler and session
 * with the fake engine:
 * - a delivery whose results do not fit what is left of the conversation
 *   records and sends nothing, and the card stays ready with its report
 *   (PR #296 F4).
 * Made-up text: Alice.
 */

import { MessageType } from '@messages';
import { WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS } from '@shared/constants/workshopPassageSearchWords';
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
});
