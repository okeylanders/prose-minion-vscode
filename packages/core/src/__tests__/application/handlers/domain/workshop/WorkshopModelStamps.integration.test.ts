import { emptyPinnedContextServices } from './workshopPinnedContextTestServices';
import { unusedBookmarkBrowser, unusedMemoryDrafts } from '@/__tests__/application/handlers/domain/workshop/workshopBookmarkBrowserTestPort';
import {
  WorkshopRoomHandler
} from '@/application/handlers/domain/workshop/WorkshopRoomHandler';
import { libraryHost } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import type {
  WorkshopWidgetRuntime
} from '@/application/handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopRoomDeliveryService
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { API_KEY_NOT_CONFIGURED_HEADING, MessageType } from '@messages';
import type { LogSink } from '@/platform';
import {
  createFakeFileSystem,
  createFakeSettings,
  createFakeShellService,
  createFakeWorkspace
} from '../../../../mocks/platform';

/**
 * Workshop Wayfinding Slice 6 (ADR 2026-11-03 D7): every committed assistant
 * turn a provider call produced carries the run's model stamp, through the
 * real handler, side pass and AssistantToolService, with only the engine
 * faked. Each run requests its own model, so a stamp on the wrong turn shows.
 */
const engineReply = (content: string, conversationId: string, requestedModelId: string) => ({
  content,
  usedGuides: [],
  requestedResources: [],
  artifacts: [],
  usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
  finishReason: 'stop',
  conversationId,
  models: { requestedModelId, servedModelIds: [`${requestedModelId}-served`] },
  replySource: 'provider' as const
});

const stampFor = (requestedModelId: string) => ({
  scope: 'assistant',
  requestedModelId,
  servedModelIds: [`${requestedModelId}-served`]
});

describe('Workshop model stamps — every provider-made commit path', () => {
  const build = async () => {
    const continueOutcome: { kind: 'reply' | 'throw' | 'no-key' | 'host-fallback' } = { kind: 'reply' };
    const engine = {
      runInitial: jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => {
        if (toolName === 'prose-assistant') return engineReply('Tool report.', 'tool-conv', 'vendor/tool-report');
        if (toolName.startsWith('workshop_guest_')) return engineReply('Guest hello.', 'guest-conv', 'vendor/guest-join');
        return engineReply('Host synthesis.', 'host-conv', 'vendor/host-synthesis');
      }),
      continueConversation: jest.fn().mockImplementation(async ({ conversationId }: { conversationId: string }) => {
        if (continueOutcome.kind === 'throw') throw new Error('transport closed');
        if (continueOutcome.kind === 'no-key') {
          return engineReply(`${API_KEY_NOT_CONFIGURED_HEADING}

Add a key.`, conversationId, 'vendor/never');
        }
        if (continueOutcome.kind === 'host-fallback') {
          // The engine's stand-in for an unusable reply (Astra F-02).
          return {
            ...engineReply('The assistant returned no usable final response. Please try again.', conversationId, 'vendor/never'),
            replySource: 'host-fallback' as const
          };
        }
        return engineReply(`Reply on ${conversationId}.`, conversationId, `vendor/${conversationId}`);
      }),
      discardConversation: jest.fn(),
      getConversationContextBudget: jest.fn(),
      getConversationContextSources: jest.fn().mockReturnValue([])
    } as unknown as jest.Mocked<AgentRunEngine>;
    const manager = {
      ensureInitialized: jest.fn().mockResolvedValue(undefined),
      getEngine: jest.fn().mockReturnValue(engine),
      createGuideCapability: jest.fn(),
      // Guides disabled + no configured source → the real manager mints nothing.
      createWorkshopToolContextCapability: jest.fn().mockReturnValue(undefined),
      setStatusCallback: jest.fn()
    } as unknown as AIResourceManager;
    const promptLoader = {
      loadSharedPrompts: jest.fn().mockResolvedValue('shared prompt'),
      loadPrompts: jest.fn().mockResolvedValue('tool or persona prompt')
    };
    const assistantService = new AssistantToolService(
      manager,
      { getPromptLoader: () => promptLoader } as unknown as ResourceLoaderService,
      {
        getOptions: jest.fn().mockReturnValue({
          includeCraftGuides: false,
          temperature: 0.7,
          maxTokens: 1_000
        })
      } as unknown as ToolOptionsProvider,
      WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION,
      { appendLine: jest.fn() } as unknown as LogSink
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const session = new WorkshopSessionService(() => 1);
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const output = { appendLine: jest.fn() } as unknown as LogSink;
    const analysisSidePass = new WorkshopAnalysisSidePass(assistantService, session, output);
    const capabilityFactory = {
      create: jest.fn(() => ({ catalog: 'workshopPersona' }))
    } as unknown as WorkshopPersonaCapabilityFactory;
    const settings = createFakeSettings();
    const fileSystem = createFakeFileSystem();
    const workspace = createFakeWorkspace();
    const writerProfileService = new WorkshopWriterProfileService(settings, output);
    const roomDelivery = new WorkshopRoomDeliveryService(session);
    const handler = new WorkshopRoomHandler(
      assistantService,
      { generateContext: jest.fn() } as never,
      session,
      roomDelivery,
      new RunWorkshopToolSidePass(
        assistantService,
        analysisSidePass,
        session,
        roomDelivery,
        capabilityFactory,
        output,
        writerProfileService,
        () => true
      ),
      capabilityFactory,
      postMessage,
      createFakeShellService(),
      new WorkshopContextIntakeService(
        {
          createProvider: jest.fn(async () => ({
            listResources: () => [],
            loadResources: async () => []
          }))
        } as never,
        fileSystem,
        workspace
      ),
      new WorkshopConversationSettingsService(
        session,
        assistantService,
        settings,
        output,
        writerProfileService
      ),
      new WorkshopSessionTimeService({
        now: () => new Date('2026-07-23T14:00:00.000Z'),
        timezone: 'America/Chicago'
      }),
      {
        availability: jest.fn().mockReturnValue({
          available: true,
          rootPath: '/workspace',
          sessionsDirectory: '/workspace/prose-minion/sessions',
          currentPath: '/workspace/prose-minion/sessions/current.json'
        }),
        getDegradedConversationKeys: jest.fn().mockReturnValue([]),
        getDegradedConversations: jest.fn().mockReturnValue([]),
        isCurrentCheckpointProtected: jest.fn().mockReturnValue(false),
        getCurrentCheckpointError: jest.fn().mockReturnValue(undefined),
        isSessionOperationPending: jest.fn().mockReturnValue(false),
        addSessionSaveStatusListener: jest.fn().mockReturnValue(() => undefined),
        waitForSessionOperations: jest.fn().mockResolvedValue(undefined),
        beginInteraction: jest.fn(),
        markDirty: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue({
          restored: false,
          degradedConversationKeys: []
        }),
        resetSession: jest.fn().mockResolvedValue({ attachmentLabels: [] })
      } as unknown as WorkshopSessionPersistenceCoordinator,
      { export: jest.fn() },
      {
        gesturePlayground: { generateMenu: jest.fn() },
        lexicalGravity: { model: {}, repository: {}, directives: {} }
      } as unknown as WorkshopWidgetRuntime,
      output,
      libraryHost().library,
      emptyPinnedContextServices(),
      unusedBookmarkBrowser(),
      unusedMemoryDrafts()
    );
    const router = new MessageRouter();
    handler.registerRoutes(router);
    let timestamp = 0;
    const route = (type: MessageType, payload: unknown) =>
      router.route({ type, source: 'webview.workshop', payload, timestamp: ++timestamp } as never);
    await route(MessageType.WORKSHOP_SET_EXCERPT, { text: 'She lifted the lantern.' });
    return { engine, session, route, continueOutcome, assistantService };
  };

  const lastAssistantTurn = (session: WorkshopSessionService) =>
    session.getSnapshot().turns.filter((turn) => turn.role === 'assistant').at(-1)!;

  it('stamps the writer\'s tool report and its host synthesis with their own runs', async () => {
    const { session, route } = await build();

    await route(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' });

    const [report, synthesis] = session.getSnapshot().turns.filter((turn) => turn.role === 'assistant');
    expect(report.artifact).toBe('tool_report');
    expect(report.model).toEqual(stampFor('vendor/tool-report'));
    expect(synthesis.artifact).toBe('persona_synthesis');
    expect(synthesis.model).toEqual(stampFor('vendor/host-synthesis'));
  });

  it('stamps a host reply, a tool-sidecar reply, a guest\'s first reply and a guest reply', async () => {
    const { session, route } = await build();
    await route(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' });

    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And the lantern?' });
    expect(lastAssistantTurn(session)).toMatchObject({ participant: 'host', model: stampFor('vendor/host-conv') });

    await route(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' });
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Say more about pacing.' });
    expect(lastAssistantTurn(session)).toMatchObject({ participant: 'tool', toolId: 'prose', model: stampFor('vendor/tool-conv') });

    await route(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' });
    expect(lastAssistantTurn(session)).toMatchObject({ participant: 'guest', model: stampFor('vendor/guest-join') });

    await route(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'personaGuest', personaId: 'margot' });
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Margot, the ending?' });
    expect(lastAssistantTurn(session)).toMatchObject({ participant: 'guest', model: stampFor('vendor/guest-conv') });

    expect(session.getSnapshot().turns.filter((turn) => turn.role === 'user').every((turn) => turn.model === undefined))
      .toBe(true);
    expect(session.exportCommittedState().turns.filter((turn) => turn.role === 'assistant').every((turn) => turn.model))
      .toBe(true);
  });

  it.each(['throw', 'no-key'] as const)('commits no reply, and so no stamp, for a failed run (%s)', async (kind) => {
    const { session, route, continueOutcome } = await build();
    await route(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' });
    const before = session.getSnapshot().turns.filter((turn) => turn.role === 'assistant');

    continueOutcome.kind = kind;
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And the lantern?' });

    const after = session.getSnapshot().turns.filter((turn) => turn.role === 'assistant');
    expect(after).toEqual(before);
    expect(JSON.stringify(session.exportCommittedState())).not.toContain('vendor/never');
  });

  it('commits the engine\'s stand-in for an unusable reply without a stamp (Astra F-02)', async () => {
    const { session, route, continueOutcome } = await build();
    await route(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' });

    continueOutcome.kind = 'host-fallback';
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And the lantern?' });

    const reply = lastAssistantTurn(session);
    expect(reply.content).toContain('no usable final response');
    expect(reply.model).toBeUndefined();
    expect(JSON.stringify(session.exportCommittedState())).not.toContain('vendor/never');
  });

  it('never puts a stamp in a prompt, a room frame or provider history', async () => {
    const { engine, session, route } = await build();
    await route(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' });
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And the lantern?' });
    // The guest's join carries a room catch-up of the stamped turns above.
    await route(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' });
    await route(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' });
    // The host's next turn carries a room frame of the guest's stamped reply.
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'What did Margot see?' });

    expect(session.getSnapshot().turns.filter((turn) => turn.model).length).toBeGreaterThanOrEqual(4);
    const sent = JSON.stringify([
      ...engine.runInitial.mock.calls.map(([request]) => request),
      ...engine.continueConversation.mock.calls.map(([request]) => request)
    ]);
    expect(engine.runInitial.mock.calls.some(([request]) => request.userMessage.includes('<workshop-room-catch-up>'))).toBe(true);
    expect(sent).toContain('Guest hello.');
    expect(sent).not.toContain('vendor/');
    expect(sent).not.toContain('servedModelIds');
    expect(sent).not.toContain('requestedModelId');
  });
});
