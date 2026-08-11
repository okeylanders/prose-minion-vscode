import { WorkshopRoomHandler } from '@handlers/domain/workshop/WorkshopRoomHandler';
import type {
  WorkshopWidgetRuntime
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import {
  WorkshopPersonaCapabilityFactory
} from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  WorkshopRoomDeliveryService
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
import {
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import type { FileSystem, LogSink, SettingsStore, ShellService, Workspace } from '@/platform';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import { ContextBudgetSnapshot, MessageType } from '@messages';
import {
  createFakeFileSystem,
  createFakeSettings,
  createFakeShellService,
  createFakeWorkspace
} from '../../../../mocks/platform';

export const analysisResult = (content: string, extra: Record<string, unknown> = {}) => ({
  toolName: 'workshop-test',
  content,
  timestamp: new Date(0),
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  ...extra
});

export const message = (type: MessageType, payload: unknown) => ({
  type,
  source: 'webview.workshop' as const,
  payload,
  timestamp: 1
});

const widgetRuntime = (
  gesturePlayground: WorkshopWidgetRuntime['gesturePlayground']
): WorkshopWidgetRuntime => ({
  gesturePlayground,
  creativeVariations: {
    generate: jest.fn()
  },
  standingDirectives: {
    apply: jest.fn(),
    remove: jest.fn()
  },
  lexicalGravity: {
    model: {
      buildLenses: jest.fn(),
      preview: jest.fn()
    },
    repository: {
      availability: jest.fn(() => ({
        rootPath: '/workspace',
        lensesDirectory: '/workspace/prose-minion/lenses',
        displayPath: 'prose-minion/lenses'
      })),
      list: jest.fn(),
      findForQuery: jest.fn(),
      assertIncompatibleResource: jest.fn(),
      replaceIncompatibleForQuery: jest.fn(),
      saveManyForQuery: jest.fn()
    }
  }
});

export interface WorkshopRouteTestHarness {
  session: WorkshopSessionService;
  postMessage: jest.Mock;
  log: LogSink;
  service: jest.Mocked<AssistantToolService>;
  contextAssistant: { generateContext: jest.Mock; };
  shell: ShellService;
  fileSystem: FileSystem;
  workspace: Workspace;
  settings: SettingsStore;
  handler: WorkshopRoomHandler;
  router: MessageRouter;
  roomDelivery: WorkshopRoomDeliveryService;
  writerProfileService: WorkshopWriterProfileService;
  capabilityFactory: WorkshopPersonaCapabilityFactory;
  contextBudgets: Map<string, ContextBudgetSnapshot>;
  contextSources: Map<string, import('@messages').ContextSourceEntry[]>;
  resourceFiles: Array<{
    group: string;
    path: string;
    label: string;
    sizeBytes: number;
    absolutePath: string;
    content: string;
  }>;
  resourceProviderFactory: { createProvider: jest.Mock; };
  persistence: jest.Mocked<WorkshopSessionPersistenceCoordinator>;
  disposeStatusListener: jest.Mock;
  disposeSessionSaveStatusListener: jest.Mock;
  setTimeNow: (value: Date) => void;
  posted: (type: MessageType) => any[];
  storeContext: (key: string, promptTokens: number, completionTokens?: number) => void;
  pin: () => Promise<void>;
  runProse: () => Promise<void>;
}

export const createWorkshopRouteTestHarness = (): WorkshopRouteTestHarness => {
  let timeNow = new Date('2026-07-23T14:00:00.000Z');
  const session = new WorkshopSessionService(() => 1);
  const contextBudgets = new Map<string, ContextBudgetSnapshot>();
  const contextSources = new Map<string, import('@messages').ContextSourceEntry[]>();
  const postMessage = jest.fn().mockResolvedValue(undefined);
  const log = { appendLine: jest.fn() } as unknown as LogSink;
  const disposeStatusListener = jest.fn();
  const disposeSessionSaveStatusListener = jest.fn();
  const service = {
    analyzeDialogue: jest.fn().mockResolvedValue(
      analysisResult('tool report', { conversationId: 'tool-conv' })
    ),
    analyzeProse: jest.fn().mockResolvedValue(
      analysisResult('tool report', { conversationId: 'tool-conv' })
    ),
    analyzeWritingTools: jest.fn().mockResolvedValue(
      analysisResult('tool report', { conversationId: 'tool-conv' })
    ),
    startWorkshopPersonaConversation: jest.fn().mockResolvedValue(
      analysisResult('Jill synthesis', { conversationId: 'host-conv' })
    ),
    startWorkshopGuestConversation: jest.fn().mockResolvedValue(
      analysisResult('Margot guest read', { conversationId: 'guest-conv' })
    ),
    continueConversation: jest.fn().mockImplementation(async (conversationId: string) =>
      analysisResult('continued reply', { conversationId })
    ),
    replaceWorkshopConversationSettings: jest.fn().mockResolvedValue(undefined),
    discardConversation: jest.fn((conversationId: string) => {
      contextBudgets.delete(conversationId);
    }),
    getConversationContextBudget: jest.fn((conversationId: string | undefined) =>
      conversationId ? contextBudgets.get(conversationId) : undefined
    ),
    getConversationContextSources: jest.fn((conversationId: string | undefined) =>
      conversationId ? contextSources.get(conversationId) ?? [] : []
    ),
    addStatusListener: jest.fn(() => disposeStatusListener)
  } as unknown as jest.Mocked<AssistantToolService>;
  const contextAssistant = {
    generateContext: jest.fn().mockResolvedValue({
      toolName: 'context_assistant',
      content: 'Wizard brief body.',
      timestamp: new Date(0),
      requestedResources: ['Characters/raven.md']
    })
  };
  const shell = createFakeShellService({
    revealFileInOS: jest.fn().mockResolvedValue(undefined),
    openFileInEditor: jest.fn().mockResolvedValue(undefined)
  });
  const fileSystem = createFakeFileSystem();
  const workspace = createFakeWorkspace();
  const settings = {
    ...createFakeSettings(),
    update: jest.fn().mockResolvedValue(undefined)
  };
  const capabilityFactory = {
    create: jest.fn(() => ({ catalog: 'workshopPersona' }))
  } as unknown as WorkshopPersonaCapabilityFactory;
  const resourceFiles = [
    {
      group: 'characters',
      path: 'Characters/raven.md',
      label: 'raven',
      sizeBytes: 120,
      absolutePath: '/ws/Characters/raven.md',
      content: 'Raven is seventeen and keeps the marked token.'
    },
    {
      group: 'themes',
      path: 'Themes/echoes.md',
      label: 'echoes',
      sizeBytes: 80,
      absolutePath: '/ws/Themes/echoes.md',
      content: 'Echo: sacred breaks into terror.'
    }
  ];
  const resourceProviderFactory = {
    createProvider: jest.fn(async () => ({
      listResources: () => resourceFiles.map(({ content: _content, ...summary }) => summary),
      loadResources: async (paths: string[]) =>
        resourceFiles.filter((file) => paths.includes(file.path))
    }))
  };
  const analysisSidePass = new WorkshopAnalysisSidePass(service, session, log);
  const writerProfileService = new WorkshopWriterProfileService(settings, log);
  const persistence = {
    availability: jest.fn().mockReturnValue({
      available: true,
      rootPath: '/workspace',
      sessionsDirectory: '/workspace/prose-minion/sessions',
      currentPath: '/workspace/prose-minion/sessions/current.json'
    }),
    getDegradedConversationKeys: jest.fn().mockReturnValue([]),
    getDegradedConversations: jest.fn().mockReturnValue([]),
    consumeRecoveryNotices: jest.fn().mockReturnValue([]),
    isCurrentCheckpointProtected: jest.fn().mockReturnValue(false),
    getCurrentCheckpointError: jest.fn().mockReturnValue(undefined),
    isSessionOperationPending: jest.fn().mockReturnValue(false),
    addSessionSaveStatusListener: jest.fn().mockReturnValue(
      disposeSessionSaveStatusListener
    ),
    waitForSessionOperations: jest.fn().mockResolvedValue(undefined),
    markDirty: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue({
      restored: false,
      degradedConversationKeys: []
    }),
    resetSession: jest.fn(async () => {
      session.reset().forEach((conversationId) => service.discardConversation(conversationId));
    }),
    saveNamed: jest.fn().mockResolvedValue({ sessionId: 'saved-1', title: 'Saved Room' }),
    list: jest.fn().mockResolvedValue({
      availability: { available: true },
      current: {
        sessionId: 'current',
        title: 'Current Room',
        fileName: 'current.json',
        kind: 'current',
        startedAt: 1,
        updatedAt: 2,
        timezone: 'America/Chicago',
        hostPersonaId: 'jill',
        participantPersonaIds: [],
        turnCount: 0,
        excerptWordCount: 0
      },
      sessions: [],
      truncated: false,
      searchTruncated: false
    }),
    openNamed: jest.fn().mockResolvedValue({
      restored: true,
      degradedConversationKeys: []
    }),
    renameNamed: jest.fn().mockResolvedValue({ sessionId: 'saved-1', title: 'Renamed Room' }),
    duplicateNamed: jest.fn().mockResolvedValue({ sessionId: 'saved-2', title: 'Copied Room' }),
    resolveRevealPath: jest.fn().mockResolvedValue(
      '/workspace/prose-minion/sessions/saved-1.json'
    ),
    deleteNamed: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<WorkshopSessionPersistenceCoordinator>;
  const roomDelivery = new WorkshopRoomDeliveryService(session);
  const handler = new WorkshopRoomHandler(
    service,
    contextAssistant as never,
    session,
    roomDelivery,
    new RunWorkshopToolSidePass(
      service,
      analysisSidePass,
      session,
      roomDelivery,
      capabilityFactory,
      log,
      writerProfileService,
      () => false
    ),
    capabilityFactory,
    postMessage,
    shell,
    new WorkshopContextIntakeService(
      resourceProviderFactory as never,
      fileSystem,
      workspace
    ),
    new WorkshopConversationSettingsService(
      session,
      service,
      settings,
      log,
      writerProfileService
    ),
    new WorkshopSessionTimeService({
      now: () => new Date(timeNow),
      timezone: 'America/Chicago'
    }),
    persistence,
    widgetRuntime({ generateMenu: jest.fn(), generateMore: jest.fn() }),
    log
  );
  const router = new MessageRouter();
  handler.registerRoutes(router);

  const posted = (type: MessageType) => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === type);

  const storeContext = (key: string, promptTokens: number, completionTokens = 2) => {
    contextBudgets.set(key, {
      modelId: 'model/a',
      contextTokens: promptTokens + completionTokens,
      promptTokens,
      completionTokens,
      peakPromptTokensThisTurn: promptTokens,
      requestedMaxOutputTokens: 10_000,
      callsThisTurn: 1,
      turnProcessedTokens: promptTokens + completionTokens,
      contextCompression: 'unknown',
      measuredAt: promptTokens
    });
  };

  const pin = async () => router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
    text: 'A pinned excerpt.',
    source: { kind: 'file', sourceUri: 'file:///chapter-one.md', relativePath: 'chapter-one.md' }
  }) as any);

  const runProse = async () => router.route(
    message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
  );

  return {
    session,
    postMessage,
    log,
    service,
    contextAssistant,
    shell,
    fileSystem,
    workspace,
    settings,
    handler,
    router,
    roomDelivery,
    writerProfileService,
    capabilityFactory,
    contextBudgets,
    contextSources,
    resourceFiles,
    resourceProviderFactory,
    persistence,
    disposeStatusListener,
    disposeSessionSaveStatusListener,
    setTimeNow: (value: Date) => {
      timeNow = value;
    },
    posted,
    storeContext,
    pin,
    runProse
  };
};
