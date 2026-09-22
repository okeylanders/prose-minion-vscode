jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { DictionaryService } from '@/infrastructure/api/services/dictionary/DictionaryService';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';

describe('DictionaryService', () => {
  const buildLookupService = async (runInitial: jest.Mock) => {
    const outputChannel = {
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn()
    };
    const service = new DictionaryService(
      {
        ensureInitialized: jest.fn().mockResolvedValue(undefined),
        getEngine: jest.fn().mockReturnValue({ runInitial })
      } as any,
      {
        getPromptLoader: () => ({
          loadSharedPrompts: jest.fn().mockResolvedValue('shared prompts'),
          loadPrompts: jest.fn().mockResolvedValue('dictionary prompts')
        })
      } as any,
      {
        getOptions: jest.fn().mockReturnValue({ temperature: 0.4, maxTokens: 10000 })
      } as any,
      outputChannel
    );

    await service.refreshConfiguration();
    return { service, outputChannel };
  };

  it.each([
    ['standard', (service: DictionaryService) => service.lookupWord('commanding')],
    ['streaming', (service: DictionaryService) => service.lookupWordStreaming('commanding', undefined, jest.fn())]
  ])('includes provider details in %s lookup failures', async (_mode, lookup) => {
    const runInitial = jest.fn().mockRejectedValue(
      new AgentRunUnavailableError(
        'provider-unavailable',
        'OpenRouter API error 400: temperature is not supported'
      )
    );
    const { service, outputChannel } = await buildLookupService(runInitial);

    const result = await lookup(service);

    expect(result.content).toBe(
      'Error: The selected AI provider is temporarily unavailable. Try again shortly.\n\n' +
      'Provider details: OpenRouter API error 400: temperature is not supported'
    );
    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      '[DictionaryService] Lookup failed: The selected AI provider is temporarily unavailable. ' +
      'Try again shortly. | OpenRouter API error 400: temperature is not supported'
    );
  });

  it('keeps ordinary lookup failures concise while recording them', async () => {
    const { service, outputChannel } = await buildLookupService(
      jest.fn().mockRejectedValue(new Error('Prompt assembly failed'))
    );

    const result = await service.lookupWord('commanding');

    expect(result.content).toBe('Error: Prompt assembly failed');
    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      '[DictionaryService] Lookup failed: Prompt assembly failed'
    );
  });

  it('includes the Special Focus block before AI Advisory Notes in fast generation', async () => {
    const loadPrompts = jest.fn().mockImplementation(async (paths: string[]) => paths[0]);
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => ({
      content: `# ${toolName.replace('dictionary-fast-', '').replace(/-/g, ' ')}`,
      usage: undefined
    }));

    const aiResourceManager = {
      ensureInitialized: jest.fn().mockResolvedValue(undefined),
      getEngine: jest.fn().mockReturnValue({ runInitial })
    };

    const service = new DictionaryService(
      aiResourceManager as any,
      {
        getPromptLoader: () => ({ loadPrompts })
      } as any,
      {} as any
    );

    const result = await service.generateParallelDictionary(
      'crash',
      'Need a dedicated comparison for crash, clatter, and rattle.'
    );

    const promptPaths = loadPrompts.mock.calls.map(([paths]) => paths[0]);

    expect(promptPaths).toContain('dictionary-fast/14-special-focus-block.md');
    expect(promptPaths).toContain('dictionary-fast/15-ai-advisory-notes-block.md');
    expect(result.metadata.totalBlocks).toBe(15);
    expect(result.result.indexOf('# special focus')).toBeGreaterThan(-1);
    expect(result.result.indexOf('# ai advisory notes')).toBeGreaterThan(
      result.result.indexOf('# special focus')
    );
  });

  it('only asks the special-focus block to generate the Special Focus section', async () => {
    const loadPrompts = jest.fn().mockImplementation(async (paths: string[]) => paths[0]);
    const runInitial = jest.fn().mockResolvedValue({
      content: '## content',
      usage: undefined
    });

    const aiResourceManager = {
      ensureInitialized: jest.fn().mockResolvedValue(undefined),
      getEngine: jest.fn().mockReturnValue({ runInitial })
    };

    const service = new DictionaryService(
      aiResourceManager as any,
      {
        getPromptLoader: () => ({ loadPrompts })
      } as any,
      {} as any
    );

    await service.generateParallelDictionary('crash', 'Need scene-specific guidance.');

    const specialFocusCalls = runInitial.mock.calls.filter(([call]) => call.toolName === 'dictionary-fast-special-focus');
    const definitionCalls = runInitial.mock.calls.filter(([call]) => call.toolName === 'dictionary-fast-definition');

    expect(specialFocusCalls).toHaveLength(1);
    expect(definitionCalls).toHaveLength(1);
    expect(specialFocusCalls[0][0].userMessage).toContain('generate the dedicated "Special Focus" section');
    expect(definitionCalls[0][0].userMessage).toContain('Do NOT generate a "Special Focus" section in this block.');
  });

  it('strips stray Special Focus sections from non-special-focus blocks during assembly', async () => {
    const loadPrompts = jest.fn().mockImplementation(async (paths: string[]) => paths[0]);
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => {
      if (toolName === 'dictionary-fast-special-focus') {
        return {
          content: '## **Special Focus: Scene Fit**\n- Keep it punchy.',
          usage: undefined
        };
      }

      return {
        content: `## ${toolName}\n- Core block content.\n\n## **Special Focus: Duplicate**\n- Should be removed.`,
        usage: undefined
      };
    });

    const aiResourceManager = {
      ensureInitialized: jest.fn().mockResolvedValue(undefined),
      getEngine: jest.fn().mockReturnValue({ runInitial })
    };

    const service = new DictionaryService(
      aiResourceManager as any,
      {
        getPromptLoader: () => ({ loadPrompts })
      } as any,
      {} as any
    );

    const result = await service.generateParallelDictionary('crash', 'Need scene-specific guidance.');
    const specialFocusMatches = result.result.match(/## \*\*Special Focus:/g) ?? [];

    expect(specialFocusMatches).toHaveLength(1);
    expect(result.result).toContain('## **Special Focus: Scene Fit**');
    expect(result.result).not.toContain('## **Special Focus: Duplicate**');
  });
});
