jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { DictionaryService } from '@/infrastructure/api/services/dictionary/DictionaryService';

describe('DictionaryService', () => {
  it('includes the Special Focus block before AI Advisory Notes in fast generation', async () => {
    const loadPrompts = jest.fn().mockImplementation(async (paths: string[]) => paths[0]);
    const executeWithoutCapabilities = jest.fn().mockImplementation(async (toolName: string) => ({
      content: `# ${toolName.replace('dictionary-fast-', '').replace(/-/g, ' ')}`,
      usage: undefined
    }));

    const aiResourceManager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn().mockReturnValue({ executeWithoutCapabilities })
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
    const executeWithoutCapabilities = jest.fn().mockResolvedValue({
      content: '## content',
      usage: undefined
    });

    const aiResourceManager = {
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn().mockReturnValue({ executeWithoutCapabilities })
    };

    const service = new DictionaryService(
      aiResourceManager as any,
      {
        getPromptLoader: () => ({ loadPrompts })
      } as any,
      {} as any
    );

    await service.generateParallelDictionary('crash', 'Need scene-specific guidance.');

    const specialFocusCalls = executeWithoutCapabilities.mock.calls.filter((call) => call[0] === 'dictionary-fast-special-focus');
    const definitionCalls = executeWithoutCapabilities.mock.calls.filter((call) => call[0] === 'dictionary-fast-definition');

    expect(specialFocusCalls).toHaveLength(1);
    expect(definitionCalls).toHaveLength(1);
    expect(specialFocusCalls[0][2]).toContain('generate the dedicated "Special Focus" section');
    expect(definitionCalls[0][2]).toContain('Do NOT generate a "Special Focus" section in this block.');
  });

  it('strips stray Special Focus sections from non-special-focus blocks during assembly', async () => {
    const loadPrompts = jest.fn().mockImplementation(async (paths: string[]) => paths[0]);
    const executeWithoutCapabilities = jest.fn().mockImplementation(async (toolName: string) => {
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
      initializeResources: jest.fn().mockResolvedValue(undefined),
      getOrchestrator: jest.fn().mockReturnValue({ executeWithoutCapabilities })
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
