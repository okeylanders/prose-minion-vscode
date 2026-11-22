/**
 * One match across twenty searched files, delivered (ADR 2026-11-20 D19a,
 * D21; PR #296): the card, the results turn's line, the transcript and the
 * receipt each keep the files an instance was found in apart from the files
 * searched. Made-up text: Alice.
 */

import { MessageType } from '@messages';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { analysisResult } from './WorkshopRouteTestHarness';
import { aliceAcrossFiles } from './passageSearchRouteFixtures';
import { passageSearchRouteDriver } from './passageSearchRouteDriver';

describe('a passage search\'s file counts', () => {
  it('one instance in one of twenty files searched reads "in 1 file" everywhere, and the receipt keeps both', async () => {
    const driver = await passageSearchRouteDriver();
    driver.search.result = aliceAcrossFiles(1, 20);
    driver.harness.service.continueConversation.mockResolvedValueOnce(analysisResult('One watch moment, in the first chapter.', { conversationId: 'host-conv' }) as never);

    const answers = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(answers.at(-1).message).toBe('Found 1 instance in 1 file. 20 files were searched. The results were sent.');
    const [request] = driver.requestTurns();
    expect(request.content).toBe('Passage search finished: 1 instance in 1 file.');
    expect(driver.ledger().at(-1)!.passageSearchDelivery).toEqual(expect.objectContaining({ instances: 1, files: 1, searched: 20 }));
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'delivered', counts: expect.objectContaining({ files: 1, searched: 20 }) }));

    const transcript = projectWorkshopTranscript(driver.ledger(), { title: 'Alice', exportedAt: 0, timezone: 'UTC' } as never);
    const events = transcript.entries.filter((entry) => entry.kind === 'event').map((entry) => (entry as { text: string }).text);
    expect(events).toContain('Passage search finished: 1 instance in 1 file.');
    expect(events.join('\n')).not.toContain('20 files');
    expect(driver.logs()).toContain('instances=1 files=1 searched=20');
  });
});
