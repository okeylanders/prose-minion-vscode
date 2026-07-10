/**
 * AssistantToolService tests — the continuation path's generation symmetry
 * (Sprint 3 field bug).
 *
 * Sibling services (DictionaryService, ContextAssistantService) rebuild ALL
 * AI resource bundles via initializeResources() during their own
 * startup/refresh, so `getOrchestrator('assistant')` can return a NEWER
 * generation than the one this service's assistants were built from. A tool
 * run retains its conversation in the CAPTURED generation's
 * ConversationManager — so continueConversation/discardConversation must use
 * that same capture, never a live lookup, or the very first follow-up dies
 * with "Conversation … not found".
 */

import { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { AIResourceManager } from '@orchestration/AIResourceManager';
import type { AIResourceOrchestrator } from '@orchestration/AIResourceOrchestrator';
import type { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { API_KEY_NOT_CONFIGURED_HEADING } from '@messages';

const makeOrchestrator = (label: string) =>
  ({
    label,
    continueConversation: jest.fn().mockResolvedValue({
      content: `reply from ${label}`,
      usedGuides: [],
      usage: undefined,
      finishReason: 'stop',
      conversationId: 'conv-1'
    }),
    executeWithoutCapabilities: jest.fn().mockResolvedValue({
      content: `started by ${label}`,
      usedGuides: [],
      usage: undefined,
      finishReason: 'stop',
      conversationId: 'host-conv'
    }),
    discardConversation: jest.fn()
  }) as unknown as jest.Mocked<AIResourceOrchestrator> & { label: string };

describe('AssistantToolService — continuation generation symmetry', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  const build = (manager: Partial<AIResourceManager>) => {
    const resourceLoader = {
      getPromptLoader: jest.fn().mockReturnValue({})
    } as unknown as ResourceLoaderService;
    const toolOptions = {
      getOptions: jest.fn().mockReturnValue({ temperature: 0.7, maxTokens: 1000 })
    } as unknown as ToolOptionsProvider;
    return new AssistantToolService(
      manager as AIResourceManager,
      resourceLoader,
      toolOptions,
      { appendLine: jest.fn() } as never
    );
  };

  it('continues and discards against the orchestrator CAPTURED at init, not a live lookup', async () => {
    const generation1 = makeOrchestrator('gen-1');
    const generation3 = makeOrchestrator('gen-3');
    let liveOrchestrator: AIResourceOrchestrator = generation1;

    const manager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn(() => liveOrchestrator),
      setStatusCallback: jest.fn()
    } as unknown as AIResourceManager;

    const service = build(manager);
    await flush(); // let the constructor's void initializeAssistants() settle

    // A sibling service rebuilds the bundles: the live lookup now returns a
    // newer generation whose ConversationManager never saw the conversation.
    liveOrchestrator = generation3;

    const result = await service.continueConversation('conv-1', 'now tighten it');
    expect(generation1.continueConversation).toHaveBeenCalledWith(
      'conv-1',
      'now tighten it',
      expect.anything()
    );
    expect(generation3.continueConversation).not.toHaveBeenCalled();
    expect(result.content).toBe('reply from gen-1');

    service.discardConversation('conv-1');
    expect(generation1.discardConversation).toHaveBeenCalledWith('conv-1');
    expect(generation3.discardConversation).not.toHaveBeenCalled();
  });

  it('a refresh re-captures: post-refresh continuations use the NEW generation', async () => {
    const generation1 = makeOrchestrator('gen-1');
    const generation2 = makeOrchestrator('gen-2');
    let liveOrchestrator: AIResourceOrchestrator = generation1;

    const manager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn(() => liveOrchestrator),
      setStatusCallback: jest.fn()
    } as unknown as AIResourceManager;

    const service = build(manager);
    await flush();

    // A genuine config change: THIS service refreshes and re-captures.
    liveOrchestrator = generation2;
    await service.refreshConfiguration();

    await service.continueConversation('conv-2', 'hello again');
    expect(generation2.continueConversation).toHaveBeenCalled();
    expect(generation1.continueConversation).not.toHaveBeenCalled();
  });

  it('returns the API-key warning when no orchestrator was captured', async () => {
    const manager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn(() => undefined),
      setStatusCallback: jest.fn()
    } as unknown as AIResourceManager;

    const service = build(manager);
    await flush();

    const result = await service.continueConversation('conv-1', 'anyone there?');
    expect(result.content).toContain(API_KEY_NOT_CONFIGURED_HEADING);
    // And discard is safe with nothing captured.
    expect(() => service.discardConversation('conv-1')).not.toThrow();
  });

  it('starts a persona with base + curated prompt on the captured generation', async () => {
    const generation1 = makeOrchestrator('gen-1');
    const generation2 = makeOrchestrator('gen-2');
    let liveOrchestrator: AIResourceOrchestrator = generation1;
    const loadPrompts = jest.fn().mockResolvedValue('assembled system prompt');
    const manager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn(() => liveOrchestrator),
      setStatusCallback: jest.fn()
    } as unknown as AIResourceManager;
    const service = new AssistantToolService(
      manager,
      { getPromptLoader: () => ({ loadPrompts }) } as unknown as ResourceLoaderService,
      { getOptions: jest.fn().mockReturnValue({ temperature: 0.7, maxTokens: 1000 }) } as unknown as ToolOptionsProvider,
      { appendLine: jest.fn() } as never
    );
    await flush();
    liveOrchestrator = generation2;

    const result = await service.startWorkshopPersonaConversation({
      personaId: 'quinn',
      excerpt: { text: 'The cup moves from the table to her hand.', relativePath: 'chapter.md', pinnedAt: 1 },
      message: 'Track the cup.',
      contextBrief: 'Mara has just entered the kitchen.'
    });

    expect(loadPrompts).toHaveBeenCalledWith([
      'workshop-personas/base.md',
      'workshop-personas/quinn.md'
    ]);
    expect(generation1.executeWithoutCapabilities).toHaveBeenCalledWith(
      'workshop_persona_quinn',
      'assembled system prompt',
      expect.stringContaining('<pinned-excerpt>'),
      expect.objectContaining({ retainConversation: true })
    );
    expect(generation2.executeWithoutCapabilities).not.toHaveBeenCalled();
    expect(generation1.executeWithoutCapabilities.mock.calls[0][2]).toContain('<context-brief>');
    expect(result.conversationId).toBe('host-conv');
  });

  it('discloses a direct-pinned excerpt head slice in the persona message', async () => {
    const generation = makeOrchestrator('gen-1');
    const manager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn(() => generation),
      setStatusCallback: jest.fn()
    } as unknown as AIResourceManager;
    const service = new AssistantToolService(
      manager,
      { getPromptLoader: () => ({ loadPrompts: jest.fn().mockResolvedValue('system prompt') }) } as unknown as ResourceLoaderService,
      { getOptions: jest.fn().mockReturnValue({ temperature: 0.7, maxTokens: 1000 }) } as unknown as ToolOptionsProvider,
      { appendLine: jest.fn() } as never
    );
    await flush();
    const excerpt = Array.from({ length: 10_001 }, (_, index) => `word${index}`).join(' ');

    await service.startWorkshopPersonaConversation({
      personaId: 'jill',
      excerpt: { text: excerpt, pinnedAt: 1 },
      message: 'Read this.'
    });

    const userMessage = generation.executeWithoutCapabilities.mock.calls[0][2];
    expect(userMessage).toContain('Persona input is a head slice: 10000 of 10001 pinned words.');
    expect(userMessage).toContain('word9999');
    expect(userMessage).not.toContain('word10000');
  });
});
