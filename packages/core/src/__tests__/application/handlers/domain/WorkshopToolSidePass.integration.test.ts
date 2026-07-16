import { WorkshopHandler } from '@/application/handlers/domain/WorkshopHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { MessageType } from '@messages';
import type { LogSink } from '@/platform';
import {
  createFakeFileSystem,
  createFakeShellService,
  createFakeWorkspace
} from '../../../mocks/platform';

describe('Workshop tool side-pass — handler to agent engine', () => {
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
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AgentRunEngine>;
    const manager = {
      ensureInitialized: jest.fn().mockResolvedValue(undefined),
      getEngine: jest.fn().mockReturnValue(engine),
      createGuideCapability: jest.fn(),
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
    const handler = new WorkshopHandler(
      assistantService,
      session,
      new RunWorkshopToolSidePass(
        assistantService,
        analysisSidePass,
        session,
        capabilityFactory,
        output
      ),
      capabilityFactory,
      postMessage,
      createFakeShellService(),
      createFakeFileSystem(),
      createFakeWorkspace(),
      output
    );
    await handler.handleSetExcerpt({
      type: MessageType.WORKSHOP_SET_EXCERPT,
      source: 'webview.workshop',
      payload: { text: 'The sentence under test.' },
      timestamp: 1
    });

    await handler.handleRunTool({
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
    expect(engine.runInitial.mock.calls[1][0].userMessage).toContain('<workshop-tool-evidence>');
    expect(session.getToolSidecarConversationId('prose')).toBe('engine-tool-conv');
    expect(session.getHostConversationId()).toBe('engine-host-conv');
    expect(session.getSnapshot().turns.map((turn) => turn.artifact)).toEqual([
      'tool_request',
      'tool_report',
      'persona_synthesis'
    ]);
  });
});
