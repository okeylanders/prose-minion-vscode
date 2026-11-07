/**
 * Committed participant runs over real session recall, for bookmark tests
 * (ADR 2026-11-05): the real engine runs each round a scripted provider
 * returns, through the real persona capability, over the real recall
 * service with its live-room port; the completion boundary commits the run.
 * A round may be a function, run when the provider is asked, so a test can
 * act as the writer mid-run.
 */

import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { WorkshopRoomDeliveryService } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import { completeWorkshopRun, workshopMessageCompletionCopy } from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopPersonaId, WorkshopTurn } from '@messages';
import { setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

export type RecallRound = string | (() => string);

export const recallCall = (operation: string, body: string): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;

export function createRecallRunHarness() {
  const harness = setupCoordinator();
  const { session, manager, coordinator, store, log, time } = harness;
  const client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
  const engine = new AgentRunEngine(client as never, manager);
  const delivery = new WorkshopRoomDeliveryService(session);
  const recall = new WorkshopTranscriptRecallService(store, coordinator, log, {
    liveRoom: new WorkshopLiveRoomBookmarkReader(session, () => time.exportState().timezone)
  });
  const factory = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
    session,
    log,
    recall,
    offProjectMemory
  );
  /** Everything every provider request carried, as one string. */
  const sent: string[] = [];

  const run = async (
    requestId: string,
    owner: WorkshopCapabilityPrincipal,
    text: string,
    rounds: readonly RecallRound[],
    settle: () => void
  ): Promise<WorkshopTurn> => {
    const label = owner.kind === 'host' ? 'Jill' : owner.personaId;
    client.createChatCompletion.mockReset();
    for (const round of rounds) {
      client.createChatCompletion.mockImplementationOnce(async (...request: unknown[]) => {
        sent.push(JSON.stringify(request));
        return { content: typeof round === 'string' ? round : round(), finishReason: 'stop' };
      });
    }
    const capability = factory.create({
      requestId,
      personaId: owner.kind === 'host' ? 'jill' : owner.personaId,
      owner,
      excerptVersion: session.getExcerptVersion(),
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    const existing = owner.kind === 'host' ? session.getHostConversationId() : session.getPersonaGuestConversationId(owner.personaId);
    const result = existing
      ? await engine.continueConversation({ conversationId: existing, userMessage: text, policy: AGENT_RUN_POLICIES.workshopHost, capability })
      : await engine.runInitial({ toolName: `workshop_${label}`, systemMessage: `${label} system`, userMessage: text, policy: AGENT_RUN_POLICIES.workshopHost, capability });
    const turn = completeWorkshopRun({
      session,
      requestId,
      label,
      result: { toolName: `workshop_${label}`, content: result.content, conversationId: result.conversationId } as never,
      aborted: false,
      createsRetainedConversation: owner.kind === 'personaGuest' && existing === undefined,
      copy: workshopMessageCompletionCopy(label),
      discardConversation: (id) => manager.deleteConversation(id),
      readRetainedHistory: (id) => manager.getCommittedHistoryCounts(id),
      settleCommittedRun: settle,
      log: () => undefined,
      events: {
        streamCompleted: () => undefined,
        turnCompleted: () => undefined,
        status: () => undefined,
        error: () => undefined,
        widgetRecommendationRejected: () => undefined
      }
    });
    if (!turn) {
      throw new Error(`run ${requestId} was not committed`);
    }
    return turn;
  };

  /** A host turn, with the room's catch-up delivered and committed as the real path does. */
  const host = (requestId: string, text: string, rounds: readonly RecallRound[]) => {
    session.setChatTarget({ kind: 'host' });
    const roomDelivery = delivery.prepare({ kind: 'host' });
    session.beginPersonaMessage(requestId, text);
    return run(requestId, { kind: 'host' }, text, rounds, () => delivery.commit(roomDelivery));
  };

  /** A guest's invitation turn: its join snapshot, then its first run. */
  const join = (personaId: WorkshopPersonaId, requestId: string, text: string, rounds: readonly RecallRound[]) => {
    const started = session.beginPersonaGuestJoin(personaId, requestId, text);
    const reader = { kind: 'personaGuest', personaId } as const;
    const snapshot = delivery.prepareJoinSnapshot(reader, started.turn.id);
    return run(requestId, reader, text, rounds,
      () => session.recordRoomThreadArtifactDeliveries(snapshot.map((turn) => turn.id), reader));
  };

  return { ...harness, client, engine, delivery, recall, run, host, join, sent, dispose: () => engine.dispose() };
}
