/**
 * The reader's "changed since", through the real room (ADR 2026-11-03 D4):
 * the content route asks for the row the reader opened in the chat target's
 * own retained conversation, compares fingerprints on the host, and posts only
 * the answer.
 */

import { createHash } from 'crypto';
import { MessageType } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const RAVEN = 'Raven is seventeen and keeps the marked token.';
const fingerprintOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('Read in provenance through the room', () => {
  it('looks the row up in the chat target\'s conversation and answers whether the file changed', async () => {
    const harness = createWorkshopRouteTestHarness();
    const { router, service, session, posted, resourceFiles } = harness;
    await harness.pin();
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Who is Raven?' }) as never);
    const hostConversationId = session.getHostConversationId();
    expect(hostConversationId).toBeDefined();
    service.findConversationContextSourceRead.mockReturnValue({
      lineRange: { start: 1, end: 1 },
      sourceFingerprint: fingerprintOf(RAVEN)
    });
    const request = {
      requestId: 'readin-1',
      group: 'characters',
      path: 'Characters/raven.md',
      deliveredAt: 1_793_632_440_000
    };

    await router.route(message(MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE, request) as never);
    resourceFiles[0].content = `${RAVEN}\nShe has a sister.`;
    await router.route(message(MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE, { ...request, requestId: 'readin-2' }) as never);

    expect(service.findConversationContextSourceRead).toHaveBeenCalledWith(hostConversationId, {
      group: 'characters',
      path: 'Characters/raven.md',
      deliveredAt: 1_793_632_440_000
    });
    const replies = posted(MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT).map((entry) => entry.payload);
    expect(replies.map(({ requestId, changedSinceRead, lineRange }) => ({ requestId, changedSinceRead, lineRange })))
      .toEqual([
        { requestId: 'readin-1', changedSinceRead: false, lineRange: { start: 1, end: 1 } },
        { requestId: 'readin-2', changedSinceRead: true, lineRange: { start: 1, end: 1 } }
      ]);
    expect(JSON.stringify(replies)).not.toContain(fingerprintOf(RAVEN));
  });
});
