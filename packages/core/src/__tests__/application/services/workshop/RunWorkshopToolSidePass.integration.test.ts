import {
  WorkshopRoomHandler
} from '@/application/handlers/domain/workshop/WorkshopRoomHandler';
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
import { MessageType } from '@messages';
import type { LogSink } from '@/platform';
import {
  createFakeFileSystem,
  createFakeSettings,
  createFakeShellService,
  createFakeWorkspace
} from '../../../mocks/platform';

describe('RunWorkshopToolSidePass — handler to agent engine', () => {
  it('uses isolated retained tool and host policies without crossing conversation identities', async () => {
    const engine = {
      runInitial: jest.fn().mockImplementation(async ({ toolName }) => ({
        content: toolName === 'prose-assistant' ? 'verbatim engine report' : 'engine host synthesis',
        usedGuides: [],
        requestedResources: [],
        artifacts: [],
        usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
        finishReason: 'stop',
        conversationId: toolName === 'prose-assistant' ? 'engine-tool-conv' : 'engine-host-conv'
      })),
      continueConversation: jest.fn(),
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
        markDirty: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue({
          restored: false,
          degradedConversationKeys: []
        }),
        resetSession: jest.fn().mockResolvedValue(undefined)
      } as unknown as WorkshopSessionPersistenceCoordinator,
      {
        gesturePlayground: { generateMenu: jest.fn() },
        lexicalGravity: { model: {}, repository: {}, directives: {} }
      } as unknown as WorkshopWidgetRuntime,
      output
    );
    const router = new MessageRouter();
    handler.registerRoutes(router);
    await router.route({
      type: MessageType.WORKSHOP_SET_EXCERPT,
      source: 'webview.workshop',
      payload: { text: 'The sentence under test.' },
      timestamp: 1
    });

    await router.route({
      type: MessageType.WORKSHOP_RUN_TOOL,
      source: 'webview.workshop',
      payload: { toolId: 'prose' },
      timestamp: 2
    });

    expect(engine.runInitial).toHaveBeenCalledTimes(2);
    expect(engine.runInitial.mock.calls[0][0]).toMatchObject({
      toolName: 'prose-assistant',
      policy: { id: 'workshop-tool-no-resources', retention: 'retain' }
    });
    expect(engine.runInitial.mock.calls[1][0]).toMatchObject({
      toolName: 'workshop_persona_jill',
      policy: {
        id: 'workshop-host',
        capabilityCatalog: 'workshopPersona',
        maxCapabilityRounds: 5,
        retention: 'retain'
      },
      capability: { catalog: 'workshopPersona' }
    });
    expect(engine.runInitial.mock.calls[1][0].userMessage).toContain('verbatim engine report');
    expect(engine.runInitial.mock.calls[1][0].userMessage).toContain('<workshop-room-catch-up>');
    expect(engine.runInitial.mock.calls[1][0].userMessage).toContain('<workshop-interaction');
    expect(promptLoader.loadPrompts.mock.calls[1][0]).toContain(
      'workshop-personas/interaction-modes/balanced.md'
    );
    expect(session.getToolSidecarConversationId('prose')).toBe('engine-tool-conv');
    expect(session.getHostConversationId()).toBe('engine-host-conv');
    expect(session.getSnapshot().turns.map((turn) => turn.artifact)).toEqual([
      'tool_request',
      'tool_report',
      'persona_synthesis'
    ]);
    expect(engine.runInitial.mock.calls[1]![0].options?.tools).toEqual([{
      type: 'openrouter:web_search',
      parameters: { engine: 'auto', max_uses: 2, max_total_results: 10 }
    }]);
    expect(session.getSnapshot().turns.at(-1)?.behavior).toMatchObject({
      interactionMode: 'balanced',
      expressionLevel: 'full'
    });
  });
});
