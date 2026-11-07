/**
 * Pinned files reach the host as ordinary context (ADR 2026-11-04 D3;
 * Slice 2b). A room seeded by the real seed sends its first host turn
 * through the real room handler, assistant service and persona capability,
 * to an engine stand-in that applies the capability's contract as
 * `AgentRunEngine.runInitial` does:
 *
 * - the attachments arrive as one `replace`: one `<context-attachments>`
 *   frame, in pinned order, with no update frame;
 * - the system message is the one an unseeded room sends;
 * - with Project Memory on, its catalog frame still ends the first user
 *   message, after the context.
 *
 * *Alice*, with made-up paths and text. No provider is called.
 */
import { WorkshopRoomHandler } from '@/application/handlers/domain/workshop/WorkshopRoomHandler';
import { emptyPinnedContextServices } from '@/__tests__/application/handlers/domain/workshop/workshopPinnedContextTestServices';
import { unusedBookmarkBrowser, unusedMemoryDrafts } from '@/__tests__/application/handlers/domain/workshop/workshopBookmarkBrowserTestPort';
import { fakeFileEditApply, fakeFileEditStaging } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import type { WorkshopWidgetRuntime } from '@/application/handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopRoomDeliveryService } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION } from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { MessageType } from '@messages';
import type { LogSink } from '@/platform';
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import { libraryHost } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { createFakeFileSystem, createFakeSettings, createFakeShellService, createFakeWorkspace } from '../../../../mocks/platform';
import { seedHost } from './pinnedContextSeedHost';

const MEMORY_FRAME = '<project-memory note="n" built="2026-11-05">\n  <entry id="mem-7f3c2a" kind="canon" updated="2026-11-04">Watch: backward</entry>\n</project-memory>';

/** The first host run's system and user messages, after the capability's contract, for a room as `seed` leaves it. */
async function firstHostRun(seed: (session: WorkshopSessionService) => Promise<void>) {
  const runs: Array<{ systemMessage: string; userMessage: string }> = [];
  const engine = {
    runInitial: jest.fn(async ({ systemMessage, userMessage, capability }) => {
      runs.push({ systemMessage, userMessage: capability?.appendContract ? await capability.appendContract(userMessage) : userMessage });
      return { content: 'The Rabbit is late.', usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', conversationId: 'host-conv' };
    }),
    continueConversation: jest.fn(),
    discardConversation: jest.fn(),
    getConversationContextBudget: jest.fn(),
    getConversationContextSources: jest.fn().mockReturnValue([])
  } as unknown as jest.Mocked<AgentRunEngine>;
  const manager = {
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
    getEngine: jest.fn().mockReturnValue(engine),
    createGuideCapability: jest.fn(),
    createWorkshopToolContextCapability: jest.fn().mockReturnValue(undefined),
    setStatusCallback: jest.fn()
  } as unknown as AIResourceManager;
  const promptLoader = {
    loadSharedPrompts: jest.fn().mockResolvedValue('shared prompt'),
    loadPrompts: jest.fn().mockResolvedValue('persona prompt')
  };
  const output = { appendLine: jest.fn() } as unknown as LogSink;
  const assistant = new AssistantToolService(
    manager,
    { getPromptLoader: () => promptLoader } as unknown as ResourceLoaderService,
    { getOptions: jest.fn().mockReturnValue({ includeCraftGuides: false, temperature: 0.7, maxTokens: 1_000 }) } as unknown as ToolOptionsProvider,
    WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION,
    output
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  const session = new WorkshopSessionService(() => Date.parse('2026-11-05T10:00:00.000Z'));
  await seed(session);
  const analysis = new WorkshopAnalysisSidePass(assistant, session, output);
  const projectMemory = {
    ...offProjectMemory,
    frame: jest.fn(async () => ({
      kind: 'frame' as const,
      frame: {
        text: MEMORY_FRAME,
        pinnedLoaded: [],
        entries: ['mem-7f3c2a'],
        more: 0,
        estimate: { memories: 1, pinned: 0, pinnedLoaded: 0, pinnedTokens: 0, pinnedOver: false, catalogTokens: 20, frameTokens: 30, pinnedLoadedTokens: 0, catalogEntries: 1 }
      },
      snapshot: [{ id: 'mem-7f3c2a', version: '0123456789ab' }]
    })),
    update: jest.fn(async () => ({ kind: 'current' as const }))
  };
  const emptyCatalog = { createProvider: jest.fn(async () => ({ listResources: () => [], loadResources: async () => [] })) };
  const capabilities = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService, analysis, emptyCatalog as never, session, output, {} as WorkshopTranscriptRecallPort, projectMemory
  );
  const settings = createFakeSettings();
  const profile = new WorkshopWriterProfileService(settings, output);
  const delivery = new WorkshopRoomDeliveryService(session);
  const handler = new WorkshopRoomHandler(
    assistant,
    { generateContext: jest.fn() } as never,
    session,
    delivery,
    new RunWorkshopToolSidePass(assistant, analysis, session, delivery, capabilities, output, profile, () => true),
    capabilities,
    jest.fn().mockResolvedValue(undefined),
    createFakeShellService(),
    new WorkshopContextIntakeService(emptyCatalog as never, createFakeFileSystem(), createFakeWorkspace()),
    new WorkshopConversationSettingsService(session, assistant, settings, output, profile),
    new WorkshopSessionTimeService({ now: () => new Date('2026-11-05T10:00:00.000Z'), timezone: 'America/Chicago' }),
    {
      availability: jest.fn().mockReturnValue({ available: true, rootPath: '/workspace/novel' }),
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
      initialize: jest.fn().mockResolvedValue({ restored: false, degradedConversationKeys: [] }),
      resetSession: jest.fn().mockResolvedValue(undefined)
    } as unknown as WorkshopSessionPersistenceCoordinator,
    { export: jest.fn() },
    { gesturePlayground: { generateMenu: jest.fn() }, lexicalGravity: { model: {}, repository: {}, directives: {} } } as unknown as WorkshopWidgetRuntime,
    output,
    libraryHost().library,
    emptyPinnedContextServices(),
    unusedBookmarkBrowser(),
    fakeFileEditStaging(),
    fakeFileEditApply(),
    unusedMemoryDrafts()
  );
  const router = new MessageRouter();
  handler.registerRoutes(router);
  await router.route({ type: MessageType.WORKSHOP_SET_EXCERPT, source: 'webview.workshop', payload: { text: 'Alice sat on the bank.' }, timestamp: 1 });
  await router.route({ type: MessageType.WORKSHOP_SEND_MESSAGE, source: 'webview.workshop', payload: { text: 'Where is the Rabbit going?' }, timestamp: 2 });
  expect(runs).toHaveLength(1);
  return { ...runs[0], session };
}

describe('pinned files as the first host turn\'s context (ADR 2026-11-04 D3)', () => {
  it('arrive as one replace, leave the system message unchanged, and come before memory\'s frame', async () => {
    const pinned = seedHost();
    pinned.write('Project/brief.md', 'A girl, a hole, a garden.');
    pinned.write('Characters/alice.md', 'Alice is seven.');
    pinned.pin('Project/brief.md', 'Characters/alice.md');

    const seeded = await firstHostRun(async (session) => {
      pinned.seed.install(await pinned.seed.prepare('first'), session);
    });
    const unseeded = await firstHostRun(async () => undefined);

    expect(seeded.systemMessage).toBe(unseeded.systemMessage);

    const message = seeded.userMessage;
    expect(message.match(/<context-attachments /g)).toHaveLength(1);
    expect(message).toContain('<context-attachments count="2">');
    expect(message).not.toContain('<workshop-host-update>');
    expect(message.indexOf('Label: brief.md')).toBeLessThan(message.indexOf('Label: alice.md'));
    expect(message).toContain('A girl, a hole, a garden.');
    // Context first, then memory's frame, which still ends the message.
    expect(message.indexOf('</context-attachments>')).toBeLessThan(message.indexOf('<project-memory '));
    expect(message.trimEnd().endsWith('</project-memory>')).toBe(true);
    expect(seeded.session.exportCommittedState().hostContextDelivery?.attachments.map((attachment) => attachment.id))
      .toEqual(seeded.session.getContextAttachments().map((attachment) => attachment.id));
  });
});
