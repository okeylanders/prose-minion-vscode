/**
 * Review F-02 (docs/pr-reviews/pr-117-retained-history-marks-3ca270d-review.md):
 * the scripted room writes provider history through
 * `ConversationManager.addMessages`, so it proves the aggregate and the
 * completion boundary against history the script supplies. This case closes
 * the seam end to end: a real `AgentRunEngine` commits multi-round host turns
 * over a scripted transport, the production count reader
 * (`AssistantToolService.readWorkshopRetainedHistory`) reads them, and the
 * production completion boundary records the marks.
 *
 * The property a rewind depends on (ADR 2026-09-30 §5–§6): a mark slices the
 * later archive to a byte-identical prefix of the archive at the mark.
 */

import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { AgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import {
  ConversationManager,
  withContextSourceSupersedeChain
} from '@orchestration/ConversationManager';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopRoomDeliveryService } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import { AnalysisResultFactory } from '@/domain/models/AnalysisResult';
import type { LogSink } from '@/platform';

const LOOKUP = '<prose-minion-tool-call name="dictionary.lookup"><word>liminal</word><context>threshold</context><purpose>tone</purpose></prose-minion-tool-call>';

/** A persona capability whose every lookup delivers the same dictionary entry. */
const dictionaryCapability = (): AgentCapability<unknown> => ({
  catalog: 'workshopPersona',
  appendContract: jest.fn(async (message: string) => `${message}\n\nCapability contract`),
  appendTurnContract: jest.fn(async (message: string) => `${message}\n\nFresh capability budget.`),
  inspectRequest: jest.fn((candidate: string) => candidate === LOOKUP
    ? { kind: 'request', request: { capability: 'dictionary.lookup', word: 'liminal' } }
    : { kind: 'none' }),
  fulfill: jest.fn(async () => ({
    evidence: 'liminal: of a threshold.',
    deliveredItems: ['dictionary.lookup:success'],
    deliveredSources: [{ kind: 'dictionary' as const, label: 'liminal', sizeChars: 24 }],
    artifacts: []
  })),
  stripToolCalls: jest.fn((content: string) =>
    content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn(() => 'Jill is checking the dictionary…'),
  statusTicker: jest.fn(() => 'Dictionary · liminal'),
  requestLogSummary: jest.fn(() => 'word="liminal"'),
  invalidRequestInstruction: jest.fn(() => 'Correct the call or answer without it.'),
  limitInstruction: jest.fn(() => 'Produce the final answer now.')
} as unknown as AgentCapability<unknown>);

const silentEvents = (): WorkshopRunCompletionEvents => ({
  streamCompleted: () => undefined,
  turnCompleted: () => undefined,
  status: () => undefined,
  error: () => undefined,
  widgetRecommendationRejected: () => undefined
});

describe('retained-history marks over a real AgentRunEngine (review F-02)', () => {
  let engine: AgentRunEngine | undefined;

  // A failed assertion must not leave the engine's handles holding Jest open.
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });

  it('marks exact multi-round commits that slice later history to a byte-identical prefix', async () => {
    const client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    const conversations = new ConversationManager();
    const runEngine = new AgentRunEngine(client as never, conversations);
    engine = runEngine;
    const log: string[] = [];
    const sink = { appendLine: (line: string) => log.push(line) } as unknown as LogSink;
    // The production count reader, over the real engine generation.
    const assistant = new AssistantToolService(
      {
        ensureInitialized: jest.fn().mockResolvedValue(undefined),
        getEngine: jest.fn().mockReturnValue(runEngine),
        createGuideCapability: jest.fn(),
        setStatusCallback: jest.fn()
      } as unknown as AIResourceManager,
      {
        getPromptLoader: () => ({
          loadSharedPrompts: jest.fn().mockResolvedValue(''),
          loadPrompts: jest.fn().mockResolvedValue('')
        })
      } as unknown as ResourceLoaderService,
      { getOptions: jest.fn().mockReturnValue({}) } as unknown as ToolOptionsProvider,
      WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION,
      sink
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    let clock = 1_000;
    const session = new WorkshopSessionService(() => ++clock);
    session.recordSessionMarker('start', 'Session started.');
    session.setExcerpt({ text: 'The threshold creaks.', source: { kind: 'manual' } });
    session.setSessionScope('excerpt');
    const delivery = new WorkshopRoomDeliveryService(session);

    const hostTurn = async (
      requestId: string,
      text: string,
      replies: string[],
      conversationId: string | undefined
    ) => {
      replies.forEach((content) => client.createChatCompletion.mockResolvedValueOnce({ content }));
      const prepared = delivery.prepare({ kind: 'host' });
      session.beginPersonaMessage(requestId, text);
      const executed = conversationId
        ? await runEngine.continueConversation({
            conversationId,
            userMessage: text,
            policy: AGENT_RUN_POLICIES.workshopHost,
            capability: dictionaryCapability()
          })
        : await runEngine.runInitial({
            toolName: 'workshop_persona_jill',
            systemMessage: 'Jill system prompt',
            userMessage: text,
            policy: AGENT_RUN_POLICIES.workshopHost,
            capability: dictionaryCapability()
          });
      const turn = completeWorkshopRun({
        session,
        requestId,
        label: 'Jill',
        result: AnalysisResultFactory.createAnalysisResult('workshop', executed.content, {
          conversationId: executed.conversationId,
          usage: executed.usage,
          finishReason: executed.finishReason
        }),
        aborted: false,
        createsRetainedConversation: conversationId === undefined,
        copy: workshopMessageCompletionCopy('Jill'),
        discardConversation: (id) => assistant.discardConversation(id),
        readRetainedHistory: (id) => assistant.readWorkshopRetainedHistory(id),
        settleCommittedRun: () => delivery.commit(prepared),
        log: (line) => log.push(line),
        events: silentEvents()
      });
      if (!turn || !executed.conversationId) {
        throw new Error(`Host turn ${requestId} did not commit`);
      }
      return {
        turn,
        conversationId: executed.conversationId,
        archive: runEngine.exportConversationsBetweenRuns([
          { key: 'host' as const, conversationId: executed.conversationId }
        ])[0]
      };
    };

    // Two capability rounds, then final prose: one committed run, three pairs.
    const first = await hostTurn('req-1', 'What does liminal do here?', [LOOKUP, LOOKUP, 'Final one.'], undefined);
    // One more round in a continued turn.
    const second = await hostTurn('req-2', 'And the creak?', [LOOKUP, 'Final two.'], first.conversationId);

    const marks = session.exportCommittedState().retainedHistoryMarks ?? [];
    expect(marks.map(({ turnId, messageCount, contextSourceCount }) =>
      ({ turnId, messageCount, contextSourceCount }))).toEqual([
      { turnId: first.turn.id, messageCount: 6, contextSourceCount: 2 },
      { turnId: second.turn.id, messageCount: 10, contextSourceCount: 3 }
    ]);
    // Each mark equals the archive the engine exports at its commit, in the
    // same units: system prompt excluded, manifest rows counted.
    expect(marks[0].messageCount).toBe(first.archive.messages.length);
    expect(marks[0].contextSourceCount).toBe(first.archive.contextSources.length);
    expect(marks[1].messageCount).toBe(second.archive.messages.length);
    expect(marks[1].contextSourceCount).toBe(second.archive.contextSources.length);
    expect(first.archive.messages.map(({ role }) => role)).toEqual([
      'user', 'assistant', 'user', 'assistant', 'user', 'assistant'
    ]);

    // The rewind property: the first mark cuts the later archive back to
    // exactly what the host held after its first commit.
    expect(second.archive.messages.slice(0, marks[0].messageCount)).toEqual(first.archive.messages);
    expect(withContextSourceSupersedeChain(
      second.archive.contextSources.slice(0, marks[0].contextSourceCount)
    )).toEqual(first.archive.contextSources);
    // Re-delivery appended and staled; the later archive keeps the whole chain.
    expect(second.archive.contextSources.map((row) => [row.artifactId, row.stale === true])).toEqual([
      ['art-1', true],
      ['art-2', true],
      ['art-3', false]
    ]);
    expect(log.filter((line) => line.includes('Retained-history mark recorded'))).toHaveLength(2);
  });
});
