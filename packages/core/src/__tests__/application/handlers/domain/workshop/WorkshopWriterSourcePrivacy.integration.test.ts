/**
 * No host-private field reaches the webview through a writer-source row
 * (PR #187 F-02). The codec refuses a fingerprint on a writer row; this is the
 * second guard: `activeContextBudget` projects every row it sends, writer rows
 * included, for the host, a guest and a tool alike. The rows here are given a
 * fingerprint behind the codec's back, the way only a defect could.
 */

import { MessageType } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const FINGERPRINT = 'f'.repeat(64);

type Internals = {
  hostWriterSources: Array<Record<string, unknown>>;
  toolWriterSources: Record<string, Array<Record<string, unknown>> | undefined>;
  guestWriterSources: Map<string, Array<Record<string, unknown>>>;
};

describe('writer-source rows in the session snapshot', () => {
  it('never carry the fingerprint, for the host, a guest or a tool', async () => {
    const harness = createWorkshopRouteTestHarness();
    const { router, session, posted } = harness;
    await harness.pin();
    await harness.runProse();
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as never);
    await router.route(message(
      MessageType.WORKSHOP_INVITE_GUEST,
      { personaId: 'margot', openingMessage: 'Join us.' }
    ) as never);

    const internals = session as unknown as Internals;
    const rows = [
      ...internals.hostWriterSources,
      ...(internals.toolWriterSources.prose ?? []),
      ...(internals.guestWriterSources.get('margot') ?? [])
    ];
    expect(internals.hostWriterSources.length).toBeGreaterThan(0);
    expect(internals.toolWriterSources.prose?.length).toBeGreaterThan(0);
    expect(internals.guestWriterSources.get('margot')?.length).toBeGreaterThan(0);
    for (const row of rows) {
      row.sourceFingerprint = FINGERPRINT;
      row.turnId = 'turn-1';
    }

    const snapshotSources = async (target: object) => {
      await router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, target) as never);
      await router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as never);
      return posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.contextBudget.sources as
        Array<Record<string, unknown>>;
    };

    for (const target of [
      { kind: 'host' },
      { kind: 'personaGuest', personaId: 'margot' },
      { kind: 'tool', toolId: 'prose' }
    ]) {
      const sources = await snapshotSources(target);
      const writerRows = sources.filter((row) => row.origin === 'writer');
      expect(writerRows.length).toBeGreaterThan(0);
      // The display-safe provenance stays; the fingerprint does not.
      expect(writerRows.some((row) => row.turnId === 'turn-1')).toBe(true);
      expect(sources.every((row) => !('sourceFingerprint' in row))).toBe(true);
    }
    expect(JSON.stringify(posted(MessageType.WORKSHOP_SESSION_STATE))).not.toContain(FINGERPRINT);
  });
});
