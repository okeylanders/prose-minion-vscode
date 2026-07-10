import { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { API_KEY_NOT_CONFIGURED_HEADING } from '@messages';

const makeEngine = (label: string) => ({
  label,
  continueConversation: jest.fn().mockResolvedValue({
    content: `reply from ${label}`, usedGuides: [], requestedResources: [], artifacts: [],
    finishReason: 'stop', conversationId: 'conv-1'
  }),
  runInitial: jest.fn().mockResolvedValue({
    content: `started by ${label}`, usedGuides: [], requestedResources: [], artifacts: [],
    finishReason: 'stop', conversationId: 'host-conv'
  }),
  discardConversation: jest.fn()
}) as unknown as jest.Mocked<AgentRunEngine> & { label: string };

describe('AssistantToolService — manager-owned generation binding', () => {
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  const build = (manager: Partial<AIResourceManager>, loadPrompts = jest.fn().mockResolvedValue('system prompt')) =>
    new AssistantToolService(
      manager as AIResourceManager,
      { getPromptLoader: () => ({ loadPrompts }) } as unknown as ResourceLoaderService,
      { getOptions: jest.fn().mockReturnValue({ temperature: 0.7, maxTokens: 1000 }) } as unknown as ToolOptionsProvider,
      { appendLine: jest.fn() } as never
    );

  const managerFor = (getEngine: () => AgentRunEngine | undefined) => ({
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
    getEngine: jest.fn(getEngine),
    createGuideCapability: jest.fn().mockReturnValue({ catalog: 'guides' }),
    setStatusCallback: jest.fn()
  });

  it('keeps retained continuation on the captured generation while unrelated initialization is idempotent', async () => {
    const generation1 = makeEngine('gen-1');
    const generation2 = makeEngine('gen-2');
    let live: AgentRunEngine = generation1;
    const manager = managerFor(() => live);
    const service = build(manager);
    await flush();

    // A sibling service can only await manager initialization now; it cannot
    // rebuild every scope and strand this retained conversation.
    await manager.ensureInitialized();
    live = generation2;

    await service.continueConversation('conv-1', 'tighten it');
    expect(generation1.continueConversation).toHaveBeenCalledWith('conv-1', 'tighten it', expect.anything());
    expect(generation2.continueConversation).not.toHaveBeenCalled();
    expect(manager.ensureInitialized).toHaveBeenCalled();
  });

  it('recaptures the new generation only after an explicit configuration refresh', async () => {
    const first = makeEngine('first');
    const next = makeEngine('next');
    let live: AgentRunEngine = first;
    const service = build(managerFor(() => live));
    await flush();
    live = next;

    await service.refreshConfiguration();
    await service.continueConversation('conv-2', 'again');
    expect(next.continueConversation).toHaveBeenCalled();
    expect(first.continueConversation).not.toHaveBeenCalled();
  });

  it('uses the explicit Workshop host policy and preserves bounded persona input', async () => {
    const engine = makeEngine('host');
    const loadPrompts = jest.fn().mockResolvedValue('assembled prompt');
    const service = build(managerFor(() => engine), loadPrompts);
    await flush();

    await service.startWorkshopPersonaConversation({
      personaId: 'quinn',
      excerpt: { text: 'The cup moves.', relativePath: 'chapter.md', pinnedAt: 1 },
      message: 'Track it.',
      contextBrief: 'Mara enters.'
    });

    expect(loadPrompts).toHaveBeenCalledWith(['workshop-personas/base.md', 'workshop-personas/quinn.md']);
    expect(engine.runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'workshop_persona_quinn',
      policy: expect.objectContaining({ id: 'workshop-host', resourceCatalog: 'none', retention: 'retain' }),
      userMessage: expect.stringContaining('<pinned-excerpt>')
    }));
    expect(engine.runInitial.mock.calls[0][0].userMessage).toContain('<context-brief>');
  });

  it('returns the API key warning when the manager has no active assistant generation', async () => {
    const service = build(managerFor(() => undefined));
    await flush();
    const result = await service.continueConversation('missing', 'hello');
    expect(result.content).toContain(API_KEY_NOT_CONFIGURED_HEADING);
  });
});
