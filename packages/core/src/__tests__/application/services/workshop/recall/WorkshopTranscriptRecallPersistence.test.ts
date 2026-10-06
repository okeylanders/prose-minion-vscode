/**
 * A room that used session recall saves and reopens (ADR 2026-10-05
 * Consequences, §10). The operation and artifact lists are checked on load
 * and save; the Past session kind only when a conversation archive is
 * imported at reopen, where a missed kind would drop that participant's
 * retained history. So this drives the real path: the engine runs a host
 * turn and a guest join through the persona capability over real recall,
 * the completion boundary commits them, the coordinator saves through the
 * store, and opening the saved session imports every conversation.
 */

import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { WorkshopRoomDeliveryService } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { ConversationImportOutcome } from '@orchestration/ConversationManager';
import { WORKSHOP_TURN_ARTIFACTS } from '@messages';
import { setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

const silentEvents = (): WorkshopRunCompletionEvents => ({
  streamCompleted: () => undefined,
  turnCompleted: () => undefined,
  status: () => undefined,
  error: () => undefined,
  widgetRecommendationRejected: () => undefined
});

const call = (operation: string, body: string): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;

const afterEachDispose: Array<() => void> = [];

afterEach(() => {
  afterEachDispose.splice(0).forEach((dispose) => dispose());
});

describe('a room that used session recall', () => {
  it('saves, reopens, and imports every participant’s retained conversation with its Past session rows', async () => {
    const harness = setupCoordinator();
    const { session, manager, coordinator, store, log } = harness;
    await coordinator.initialize();
    const client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    const engine = new AgentRunEngine(client as never, manager);
    // The engine sweeps idle conversations on an interval; stop it with the test.
    afterEachDispose.push(() => engine.dispose());
    const delivery = new WorkshopRoomDeliveryService(session);
    const factory = new WorkshopPersonaCapabilityFactory(
      {} as DictionaryService,
      {} as WorkshopAnalysisSidePass,
      { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
      session,
      log,
      new WorkshopTranscriptRecallService(store, coordinator, log)
    );
    const capabilityFor = (requestId: string, owner: WorkshopCapabilityPrincipal) => factory.create({
      requestId,
      personaId: owner.kind === 'host' ? 'jill' : owner.personaId,
      owner,
      excerptVersion: session.getExcerptVersion(),
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    /** One committed participant run: the engine's rounds, then the completion boundary. */
    const run = async (
      requestId: string,
      label: string,
      owner: WorkshopCapabilityPrincipal,
      text: string,
      replies: string[],
      settle: () => void
    ) => {
      client.createChatCompletion.mockReset();
      for (const reply of replies) {
        client.createChatCompletion.mockResolvedValueOnce({ content: reply, finishReason: 'stop' });
      }
      const existing = owner.kind === 'host' ? session.getHostConversationId() : undefined;
      const capability = capabilityFor(requestId, owner);
      const result = existing
        ? await engine.continueConversation({ conversationId: existing, userMessage: text, policy: AGENT_RUN_POLICIES.workshopHost, capability })
        : await engine.runInitial({ toolName: `workshop_${label}`, systemMessage: `${label} system`, userMessage: text, policy: AGENT_RUN_POLICIES.workshopHost, capability });
      const turn = completeWorkshopRun({
        session,
        requestId,
        label,
        result: { toolName: `workshop_${label}`, content: result.content, conversationId: result.conversationId } as never,
        aborted: false,
        createsRetainedConversation: owner.kind === 'personaGuest',
        copy: workshopMessageCompletionCopy(label),
        discardConversation: (id) => manager.deleteConversation(id),
        readRetainedHistory: (id) => manager.getCommittedHistoryCounts(id),
        settleCommittedRun: settle,
        log: () => undefined,
        events: silentEvents()
      });
      if (!turn) {
        throw new Error(`run ${requestId} was not committed`);
      }
      return turn;
    };
    const hostRun = (requestId: string, text: string, replies: string[]) => {
      session.setChatTarget({ kind: 'host' });
      const roomDelivery = delivery.prepare({ kind: 'host' });
      session.beginPersonaMessage(requestId, text);
      return run(requestId, 'Jill', { kind: 'host' }, text, replies, () => delivery.commit(roomDelivery));
    };

    // A past room to recall, with a to-do promoted from its reply, saved; then a fresh live room.
    session.setSessionScope('open');
    const pastReply = await hostRun('past-1', 'Where did the lighthouse scene land?', [
      'PAST-REPLY: the keeper rows out at dawn.\n\n### Next steps\n- Draft the dawn crossing.'
    ]);
    session.addTodoFromFinding(pastReply.id, pastReply.actionableFindings![0].key);
    const past = await coordinator.saveNamed('Lighthouse past');
    await coordinator.resetSession({ clearWorkingSet: true });

    // The host recalls with every operation in one turn.
    session.setSessionScope('open');
    await hostRun('live-1', 'Pick up the lighthouse idea.', [
      call('transcript.catalog', '<match>lighthouse</match>'),
      call('transcript.search', '<query>keeper</query>'),
      call('transcript.read', `<session>${past.sessionId}</session>`),
      call('transcript.todos', '<status>all</status>'),
      'HOST-FINAL: the keeper rows out at dawn, as we decided.'
    ]);
    // A guest joins and reads the same session in its own conversation.
    const joinId = 'join-cliff';
    const join = session.beginPersonaGuestJoin('cliff', joinId, 'What do you make of the lighthouse thread?');
    const joinTurns = delivery.prepareJoinSnapshot({ kind: 'personaGuest', personaId: 'cliff' }, join.turn.id);
    await run(joinId, 'cliff', { kind: 'personaGuest', personaId: 'cliff' }, 'Join the room.', [
      call('transcript.read', `<session turns="1-9">${past.sessionId}</session>`),
      'GUEST-FINAL: the dawn image repeats.'
    ], () => session.recordRoomThreadArtifactDeliveries(joinTurns.map((turn) => turn.id), { kind: 'personaGuest', personaId: 'cliff' }));

    const hostBefore = manager.getContextSources(session.getHostConversationId());
    const guestBefore = manager.getContextSources(session.getPersonaGuestConversationId('cliff'));
    expect(hostBefore.map((source) => source.kind)).toEqual(['transcript', 'transcript']);
    expect(guestBefore.map((source) => source.kind)).toEqual(['transcript']);

    const saved = await coordinator.saveNamed('Recall room');
    await coordinator.resetSession({ clearWorkingSet: true });
    harness.assistant.importWorkshopConversationArchive.mockClear();
    await coordinator.openNamed(saved.sessionId);

    const imported = await (harness.assistant.importWorkshopConversationArchive.mock.results[0].value as Promise<
      Array<ConversationImportOutcome<string>>
    >);
    expect(imported.map((outcome) => [outcome.key, outcome.status])).toEqual([
      ['host', 'imported'],
      ['guest:cliff', 'imported']
    ]);
    const hostAfter = manager.getContextSources(session.getHostConversationId());
    const guestAfter = manager.getContextSources(session.getPersonaGuestConversationId('cliff'));
    expect(hostAfter.map(({ kind, label }) => ({ kind, label }))).toEqual(hostBefore.map(({ kind, label }) => ({ kind, label })));
    expect(guestAfter.map(({ kind, label }) => ({ kind, label }))).toEqual(guestBefore.map(({ kind, label }) => ({ kind, label })));
    expect(hostAfter[0].label).toMatch(/^“Lighthouse past” · turns 1-\d+$/);
    expect(hostAfter[1].label).toBe('To-dos · “Lighthouse past”');

    const artifacts = session.readRoomLedger().map((turn) => turn.artifact);
    for (const artifact of WORKSHOP_TURN_ARTIFACTS.filter((name) => name.startsWith('transcript_'))) {
      expect(artifacts).toContain(artifact);
    }
    const reads = session.readRoomLedger().filter((turn) => turn.artifact === 'transcript_read');
    expect(reads.map((turn) => [turn.capability!.invokedBy.kind, turn.capability!.publishedWithTurnId !== undefined]))
      .toEqual([['host', true], ['personaGuest', true]]);
  });
});
