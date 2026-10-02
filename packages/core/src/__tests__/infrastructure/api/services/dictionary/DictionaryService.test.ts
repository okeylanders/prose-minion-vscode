jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { DictionaryService } from '@/infrastructure/api/services/dictionary/DictionaryService';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import * as fs from 'fs';
import * as path from 'path';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../../../resources/system-prompts');

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

    expect(promptPaths).toContain('dictionary-fast/15-special-focus-block.md');
    expect(promptPaths).toContain('dictionary-fast/16-ai-advisory-notes-block.md');
    expect(result.metadata.totalBlocks).toBe(16);
    expect(result.result.indexOf('# special focus')).toBeGreaterThan(-1);
    expect(result.result.indexOf('# ai advisory notes')).toBeGreaterThan(
      result.result.indexOf('# special focus')
    );
  });

  it('sums cache counts only when every parallel dictionary block reports them', async () => {
    let omitDefinitionCacheRead = false;
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => ({
      content: `## ${toolName}`,
      usage: {
        promptTokens: 10,
        completionTokens: 2,
        totalTokens: 12,
        ...(omitDefinitionCacheRead && toolName === 'dictionary-fast-definition' ? {} : { cachedTokens: 2 }),
        cacheWriteTokens: 1
      }
    }));
    const { service } = await buildLookupService(runInitial);

    const fullyReported = await service.generateParallelDictionary('crash');
    expect(fullyReported.metadata.totalBlocks).toBe(16);
    expect(fullyReported.usage).toMatchObject({
      promptTokens: 160,
      completionTokens: 32,
      totalTokens: 192,
      cachedTokens: 32,
      cacheWriteTokens: 16
    });

    omitDefinitionCacheRead = true;
    const partiallyReported = await service.generateParallelDictionary('crash');
    expect(partiallyReported.usage?.cachedTokens).toBeUndefined();
    expect(partiallyReported.usage?.cacheWriteTokens).toBe(16);
  });

  it('loads every bundled fast prompt and assembles topic families between collocations and morphology', async () => {
    const loadPrompts = jest.fn(async (paths: string[]) =>
      paths.map((file) => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8')).join('\n\n'));
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => ({
      content: toolName === 'dictionary-fast-topic-related-lexicon'
        ? '# 📂 Topic & Related Lexicon\n\n### Phonetics\nHow speech sounds are formed.\n- **Fricative** — A contrasting consonant class.'
        : `# ${toolName.replace('dictionary-fast-', '').replace(/-/g, ' ')}`,
      usage: undefined
    }));
    const service = new DictionaryService(
      { ensureInitialized: async () => undefined, getEngine: () => ({ runInitial }) } as never,
      { getPromptLoader: () => ({ loadPrompts }) } as never,
      {} as never
    );
    const onProgress = jest.fn();

    const result = await service.generateParallelDictionary(
      'plosive', 'Compare consonant textures in prose.', { onProgress }
    );

    expect(result.metadata).toMatchObject({ totalBlocks: 16, successCount: 16, partialFailures: [] });
    expect(loadPrompts.mock.calls.map(([paths]) => paths[0]))
      .toContain('dictionary-fast/08-topic-related-lexicon-block.md');
    const request = runInitial.mock.calls.find(([call]) => call.toolName === 'dictionary-fast-topic-related-lexicon')![0];
    expect(request.systemMessage).toContain('# 📂 Topic & Related Lexicon');
    expect(request.systemMessage).toContain('not automatically synonyms or antonyms');
    const senseRequest = runInitial.mock.calls.find(([call]) => call.toolName === 'dictionary-fast-sense-explorer')![0];
    expect(senseRequest.systemMessage).toContain('no direct antonym exists');
    expect(request.userMessage).toContain('Compare consonant textures in prose.');
    expect(result.result.indexOf('# 📂 Topic & Related Lexicon'))
      .toBeGreaterThan(result.result.indexOf('# collocations idioms'));
    expect(result.result.indexOf('# morphology family'))
      .toBeGreaterThan(result.result.indexOf('# 📂 Topic & Related Lexicon'));
    expect(onProgress).toHaveBeenLastCalledWith({
      word: 'plosive', completedBlocks: expect.arrayContaining(['topic-related-lexicon']), totalBlocks: 16
    });
  });

  it('reports a failed topic-family block without losing the other sections', async () => {
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => {
      if (toolName.startsWith('dictionary-fast-topic-related-lexicon')) {
        throw new Error('Topic generation unavailable');
      }
      return { content: `# ${toolName}`, usage: undefined };
    });
    const { service } = await buildLookupService(runInitial);

    const result = await service.generateParallelDictionary('plosive');

    expect(result.metadata).toMatchObject({
      totalBlocks: 16, successCount: 15, partialFailures: ['topic-related-lexicon']
    });
    expect(runInitial.mock.calls.filter(([call]) => call.toolName.startsWith('dictionary-fast-topic-related-lexicon')))
      .toHaveLength(2);
    expect(result.result).toContain('# dictionary-fast-definition');
    expect(result.result).toContain('# dictionary-fast-morphology-family');
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
