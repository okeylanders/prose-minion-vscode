jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { DictionaryService } from '@/infrastructure/api/services/dictionary/DictionaryService';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { DictionaryUtility } from '@/tools/utility/dictionaryUtility';
import * as fs from 'fs';
import * as path from 'path';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../../../resources/system-prompts');

describe('DictionaryService', () => {
  const buildLookupService = async (runInitial: jest.Mock, maxTokens = 10000) => {
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
        getOptions: jest.fn().mockReturnValue({ temperature: 0.4, maxTokens })
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

  describe('lookup outcome', () => {
    const lookups = [
      ['standard', (service: DictionaryService) => service.lookupWord('commanding')],
      ['streaming', (service: DictionaryService) => service.lookupWordStreaming('commanding', undefined, jest.fn())]
    ] as const;

    it.each(lookups)('marks a generated %s lookup as an entry', async (_mode, lookup) => {
      const { service } = await buildLookupService(
        jest.fn().mockResolvedValue({ content: '# Entry', finishReason: 'stop' })
      );

      await expect(lookup(service)).resolves.toMatchObject({
        toolName: 'dictionary_lookup', content: '# Entry', outcome: 'entry'
      });
    });

    it.each(lookups)('marks a truncated %s lookup as an entry', async (_mode, lookup) => {
      const { service } = await buildLookupService(
        jest.fn().mockResolvedValue({ content: '# Entr', finishReason: 'length' })
      );

      await expect(lookup(service)).resolves.toMatchObject({ finishReason: 'length', outcome: 'entry' });
    });

    it.each(lookups)('marks a failed %s lookup as failed', async (_mode, lookup) => {
      const { service } = await buildLookupService(jest.fn().mockRejectedValue(new Error('Prompt assembly failed')));

      await expect(lookup(service)).resolves.toMatchObject({
        content: 'Error: Prompt assembly failed', outcome: 'failed'
      });
    });

    it.each(lookups)('marks a %s lookup without an API key as unconfigured', async (_mode, lookup) => {
      const service = new DictionaryService(
        {
          ensureInitialized: jest.fn().mockResolvedValue(undefined),
          getEngine: jest.fn().mockReturnValue(undefined)
        } as never,
        { getPromptLoader: jest.fn() } as never,
        { getOptions: jest.fn() } as never
      );
      await service.refreshConfiguration();

      const result = await lookup(service);

      expect(result.outcome).toBe('unconfigured');
      expect(result.content).toContain('configure your OpenRouter API key');
    });
  });

  // Astra F-03: history must record the model that generated an entry. The
  // manager hot-swaps by mutating the shared engine in place, and the
  // provider picks its model when each call is dispatched, so a selection read
  // at request start (or at completion) can disagree with what actually ran.
  describe('model provenance', () => {
    /** Like the real engine: each call runs on the model selected when it is dispatched. */
    interface SwappableEngine {
      model: string;
      setModel: (model: string) => void;
      runInitial: jest.Mock;
    }

    const swappableEngine = (initialModel: string): SwappableEngine => {
      const engine: SwappableEngine = {
        model: initialModel,
        setModel: (model: string) => { engine.model = model; },
        runInitial: jest.fn(async ({ toolName }: { toolName: string }) => ({
          content: `# ${toolName} by ${engine.model}`,
          finishReason: 'stop',
          modelId: engine.model
        }))
      };
      return engine;
    };

    const held = () => {
      let release!: (value: string) => void;
      const promise = new Promise<string>(resolve => { release = resolve; });
      return { promise, release };
    };

    const settle = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

    const buildService = async (
      engine: SwappableEngine,
      promptLoader: { loadSharedPrompts: jest.Mock; loadPrompts: jest.Mock }
    ) => {
      const service = new DictionaryService(
        {
          ensureInitialized: jest.fn().mockResolvedValue(undefined),
          getEngine: jest.fn().mockReturnValue(engine),
          // The selection a snapshot would have read; it must not reach the result.
          getResolvedModel: jest.fn().mockReturnValue('model/A')
        } as never,
        { getPromptLoader: () => promptLoader } as never,
        { getOptions: jest.fn().mockReturnValue({ temperature: 0.4, maxTokens: 10000 }) } as never
      );
      await service.refreshConfiguration();
      return service;
    };

    it.each([
      ['standard', (service: DictionaryService) => service.lookupWord('plosive')],
      ['streaming', (service: DictionaryService) => service.lookupWordStreaming('plosive', undefined, jest.fn())]
    ])('reports the model that generated a %s lookup when a swap lands during prompt loading', async (_mode, lookup) => {
      const engine = swappableEngine('model/A');
      const sharedPrompts = held();
      const service = await buildService(engine, {
        loadSharedPrompts: jest.fn(() => sharedPrompts.promise),
        loadPrompts: jest.fn().mockResolvedValue('dictionary prompts')
      });

      const pending = lookup(service);
      await settle();
      expect(engine.runInitial).not.toHaveBeenCalled();
      engine.setModel('model/B');
      sharedPrompts.release('shared prompts');
      const result = await pending;

      expect(result).toMatchObject({ outcome: 'entry', content: '# dictionary-utility by model/B', modelId: 'model/B' });
    });

    it('reports no model for a lookup the provider did not attribute', async () => {
      const { service } = await buildLookupService(jest.fn().mockResolvedValue({ content: '# Entry', finishReason: 'stop' }));

      const result = await service.lookupWordStreaming('plosive', undefined, jest.fn());

      expect(result.outcome).toBe('entry');
      expect(result).not.toHaveProperty('modelId');
    });

    it('reports every model a fast lookup ran on when a swap lands between its blocks', async () => {
      const engine = swappableEngine('model/A');
      const specialFocusPrompt = held();
      const service = await buildService(engine, {
        loadSharedPrompts: jest.fn().mockResolvedValue('shared prompts'),
        loadPrompts: jest.fn(([promptPath]: string[]) => promptPath.includes('special-focus')
          ? specialFocusPrompt.promise
          : Promise.resolve('block prompt'))
      });

      const pending = service.generateParallelDictionary('plosive', 'Need scene-specific guidance.');
      await settle();
      // Every block but Special Focus has already run on model/A.
      engine.setModel('model/B');
      specialFocusPrompt.release('special focus prompt');
      const result = await pending;

      expect(result.result).toContain('# dictionary-fast-definition by model/A');
      expect(result.result).toContain('by model/B');
      expect(result.modelIds).toEqual(['model/A', 'model/B']);
    });

    it('lists only the models of blocks that produced content', async () => {
      const runInitial = jest.fn(async ({ toolName }: { toolName: string }) => {
        if (toolName.startsWith('dictionary-fast-definition')) {
          throw new Error('Definition unavailable');
        }
        return { content: `# ${toolName}`, modelId: toolName.startsWith('dictionary-fast-pronunciation') ? 'model/B' : 'model/A' };
      });
      const { service } = await buildLookupService(runInitial);

      const result = await service.generateParallelDictionary('plosive');

      expect(result.metadata.partialFailures).toEqual(['definition']);
      expect(result.modelIds).toEqual(['model/B', 'model/A']);
    });

    it('reports no models for the API-key notice', async () => {
      const service = new DictionaryService(
        { ensureInitialized: jest.fn().mockResolvedValue(undefined), getEngine: jest.fn().mockReturnValue(undefined) } as never,
        { getPromptLoader: jest.fn() } as never,
        { getOptions: jest.fn() } as never
      );
      await service.refreshConfiguration();

      expect((await service.generateParallelDictionary('plosive')).modelIds).toEqual([]);
    });
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

  it.each(['standard', 'streaming'] as const)('forwards the resolved entry choices for %s lookup', async mode => {
    const lookup = jest.spyOn(DictionaryUtility.prototype, 'lookup').mockResolvedValue({
      content: '# Entry', usedGuides: [], requestedResources: [], artifacts: []
    });
    try {
      const { service } = await buildLookupService(jest.fn());
      const controller = new AbortController();
      const onToken = jest.fn();

      // Encyclopedia is opt-out (absent = on); palettes are opt-in (absent = off).
      for (const [entryOptions, resolved] of [
        [undefined, { includeEncyclopedia: true, includePalettes: false }],
        [{ includeEncyclopedia: true }, { includeEncyclopedia: true, includePalettes: false }],
        [{ includeEncyclopedia: false }, { includeEncyclopedia: false, includePalettes: false }],
        [{ includePalettes: true }, { includeEncyclopedia: true, includePalettes: true }],
        [{ includeEncyclopedia: false, includePalettes: true }, { includeEncyclopedia: false, includePalettes: true }]
      ] as const) {
        if (mode === 'standard') {
          await service.lookupWord('plosive', 'Compare consonant textures.', entryOptions);
        } else {
          await service.lookupWordStreaming(
            'plosive', 'Compare consonant textures.', onToken, controller.signal, entryOptions
          );
        }
        expect(lookup).toHaveBeenLastCalledWith({
          word: 'plosive', contextText: 'Compare consonant textures.', ...resolved
        }, expect.objectContaining({
          temperature: 0.4,
          maxTokens: 10000,
          ...(mode === 'streaming' ? { onToken, signal: controller.signal } : {})
        }));
      }
    } finally {
      lookup.mockRestore();
    }
  });

  it.each([
    {
      label: 'enabled with the requested heading', includeEncyclopedia: true,
      content: '# 🧠 AI Advisory Notes\n\n# 📂 **Topic & Related Lexicon**\nPrivate generated text.',
      finishReason: 'stop', cancelled: false, hasTopicSection: true, missingDiagnostic: false
    },
    {
      label: 'disabled', includeEncyclopedia: false,
      content: '# 🧠 AI Advisory Notes\nPrivate generated text.',
      finishReason: 'stop', cancelled: false, hasTopicSection: false, missingDiagnostic: false
    },
    {
      label: 'enabled by default but omitted on normal completion', includeEncyclopedia: undefined,
      content: '# 🧠 AI Advisory Notes\nPrivate generated text mentions Topic & Related Lexicon without a heading.',
      finishReason: 'stop', cancelled: false, hasTopicSection: false, missingDiagnostic: true
    },
    {
      label: 'enabled but truncated before the heading', includeEncyclopedia: true,
      content: '# 🧠 AI Advisory Notes\nPrivate generated text.',
      finishReason: 'length', cancelled: false, hasTopicSection: false, missingDiagnostic: false
    },
    {
      label: 'enabled but cancelled before the heading', includeEncyclopedia: true,
      content: '# 🧠 AI Advisory Notes\nPrivate generated text.',
      finishReason: 'stop', cancelled: true, hasTopicSection: false, missingDiagnostic: false
    },
    {
      label: 'enabled with an unreported completion reason', includeEncyclopedia: true,
      content: '# 🧠 AI Advisory Notes\nPrivate generated text.',
      finishReason: undefined, cancelled: false, hasTopicSection: false, missingDiagnostic: false
    },
    {
      label: 'palettes enabled with two palette fences', includeEncyclopedia: true, includePalettes: true,
      content: '# 🎨 Chromatic Palettes\n\n```pm-palette\ntitle: Private palette\nPrivate Swatch | #B87333 | Private generated text.\n```\n\n' +
        '````pm-palette\r\nPrivate Swatch | #43B3AE | Private generated text.\n````\n\n# 📂 **Topic & Related Lexicon**\nPrivate generated text.',
      finishReason: 'stop', cancelled: false, hasTopicSection: true, missingDiagnostic: false, paletteFences: 2
    },
    {
      label: 'palettes enabled with only look-alike fences', includeEncyclopedia: false, includePalettes: true,
      content: 'Private generated text uses `pm-palette` inline.\n```pm-palette-draft\nPrivate Swatch | #B87333 | Private generated text.\n```\n```text\npm-palette\n```',
      finishReason: 'stop', cancelled: false, hasTopicSection: false, missingDiagnostic: false, paletteFences: 0
    }
  ])('logs lookup diagnostics without request or generated text: $label', async scenario => {
    for (const mode of ['standard', 'streaming'] as const) {
      const runInitial = jest.fn().mockResolvedValue({
        content: scenario.content,
        finishReason: scenario.finishReason,
        cancelled: scenario.cancelled,
        usage: { promptTokens: 20, completionTokens: 70, totalTokens: 90 }
      });
      const { service, outputChannel } = await buildLookupService(runInitial, 7000);
      const entryOptions = { includeEncyclopedia: scenario.includeEncyclopedia, includePalettes: scenario.includePalettes };
      const word = 'Private target word';
      const context = 'Private author context';
      if (mode === 'standard') {
        await service.lookupWord(word, context, entryOptions);
      } else {
        await service.lookupWordStreaming(word, context, jest.fn(), undefined, entryOptions);
      }

      const encyclopedia = scenario.includeEncyclopedia === false ? 'disabled' : 'enabled';
      const palettes = scenario.includePalettes === true ? 'enabled' : 'disabled';
      expect(outputChannel.appendLine).toHaveBeenCalledWith(
        `[DictionaryService] Lookup started: mode=${mode} encyclopedia=${encyclopedia} palettes=${palettes} maxTokens=7000`
      );
      expect(outputChannel.appendLine).toHaveBeenCalledWith(
        `[DictionaryService] Lookup completed: mode=${mode} encyclopedia=${encyclopedia} palettes=${palettes} ` +
        `finishReason=${scenario.finishReason ?? 'unreported'} completionTokens=70 ` +
        `cancelled=${scenario.cancelled} hasTopicSection=${scenario.hasTopicSection} paletteFences=${scenario.paletteFences ?? 0}`
      );
      const logs = outputChannel.appendLine.mock.calls.map(([line]) => line).join('\n');
      expect(logs.includes('Encyclopedia section missing from completed lookup')).toBe(scenario.missingDiagnostic);
      expect(logs).not.toContain(word);
      expect(logs).not.toContain(context);
      expect(logs).not.toContain('Private generated text');
      expect(logs).not.toContain('Private palette');
      expect(logs).not.toContain('#B87333');
      expect(runInitial).toHaveBeenCalledTimes(1);
      expect(runInitial.mock.calls[0][0].options.maxTokens).toBe(7000);
    }
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
    expect(result.metadata.totalBlocks).toBe(16);
    expect(result.result.indexOf('# special focus')).toBeGreaterThan(-1);
    expect(result.result.indexOf('# ai advisory notes')).toBeGreaterThan(
      result.result.indexOf('# special focus')
    );
  });

  it.each([
    [true, undefined, 16],
    [false, undefined, 15],
    [true, true, 17],
    [false, true, 16]
  ] as const)('sums cache counts only for selected blocks with encyclopedia=%s palettes=%s', async (
    includeEncyclopedia, includePalettes, totalBlocks
  ) => {
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

    const fullyReported = await service.generateParallelDictionary('crash', undefined, { includeEncyclopedia, includePalettes });
    expect(fullyReported.metadata.totalBlocks).toBe(totalBlocks);
    expect(fullyReported.usage).toMatchObject({
      promptTokens: 10 * totalBlocks,
      completionTokens: 2 * totalBlocks,
      totalTokens: 12 * totalBlocks,
      cachedTokens: 2 * totalBlocks,
      cacheWriteTokens: totalBlocks
    });

    omitDefinitionCacheRead = true;
    const partiallyReported = await service.generateParallelDictionary('crash', undefined, { includeEncyclopedia, includePalettes });
    expect(partiallyReported.usage?.cachedTokens).toBeUndefined();
    expect(partiallyReported.usage?.cacheWriteTokens).toBe(totalBlocks);
  });

  it.each([
    { includeEncyclopedia: true, includePalettes: undefined },
    { includeEncyclopedia: false, includePalettes: undefined },
    { includeEncyclopedia: true, includePalettes: true },
    { includeEncyclopedia: false, includePalettes: true }
  ])('loads only selected prompts in output order with encyclopedia=$includeEncyclopedia palettes=$includePalettes', async ({
    includeEncyclopedia, includePalettes
  }) => {
    const paletteSection = '# 🎨 Chromatic Palettes\n\n```pm-palette\ntitle: Warm Copper\nkind: literal\n' +
      'Copper | #B87333 | the reddish-orange of the bare metal, freshly polished\n```';
    const loadPrompts = jest.fn(async (paths: string[]) =>
      paths.map((file) => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8')).join('\n\n'));
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => ({
      content: toolName === 'dictionary-fast-topic-related-lexicon'
        ? '# 📂 Topic & Related Lexicon\n\n### Phonetics\nHow speech sounds are formed.\n- **Fricative** — A contrasting consonant class.'
        : toolName === 'dictionary-fast-chromatic-palettes'
          ? paletteSection
          : `# ${toolName.replace('dictionary-fast-', '').replace(/-/g, ' ')}`,
      usage: undefined
    }));
    const outputChannel = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const service = new DictionaryService(
      { ensureInitialized: async () => undefined, getEngine: () => ({ runInitial }) } as never,
      { getPromptLoader: () => ({ loadPrompts }) } as never,
      {} as never,
      outputChannel
    );
    const onProgress = jest.fn();

    const result = await service.generateParallelDictionary(
      'plosive', 'Compare consonant textures in prose.', { onProgress, includeEncyclopedia, includePalettes }
    );

    // Palettes are opt-in: an absent option leaves the block out.
    const withPalettes = includePalettes === true;
    const totalBlocks = 15 + Number(includeEncyclopedia) + Number(withPalettes);
    expect(result.metadata).toMatchObject({ totalBlocks, successCount: totalBlocks, partialFailures: [] });
    expect(Object.keys(result.metadata.blockDurations)).toHaveLength(totalBlocks);
    expect(runInitial).toHaveBeenCalledTimes(totalBlocks);
    const promptPaths = loadPrompts.mock.calls.map(([paths]) => paths[0]);
    expect(promptPaths).not.toContain('dictionary-fast/16-topic-related-lexicon-block.md');
    const topicRequest = runInitial.mock.calls.find(([call]) => call.toolName === 'dictionary-fast-topic-related-lexicon')?.[0];
    const paletteRequest = runInitial.mock.calls.find(([call]) => call.toolName === 'dictionary-fast-chromatic-palettes')?.[0];
    const selection = `encyclopedia=${includeEncyclopedia ? 'enabled' : 'disabled'} palettes=${withPalettes ? 'enabled' : 'disabled'}`;
    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      `\n[DictionaryService] Starting parallel dictionary generation for "plosive" ${selection}`
    );
    expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringMatching(
      new RegExp(`^\\[DictionaryService\\] Parallel generation completed: ${totalBlocks}/${totalBlocks} blocks in \\d+ms paletteFences=${Number(withPalettes)}$`)
    ));
    if (withPalettes) {
      expect(promptPaths).toContain('dictionary-fast/16-chromatic-palettes-block.md');
      expect(paletteRequest.systemMessage).toContain('Generate ONLY the **🎨 Chromatic Palettes** section.');
      expect(paletteRequest.systemMessage).toContain('```pm-palette\ntitle: Warm Copper');
      expect(paletteRequest.systemMessage).toContain('Output ONLY the section content, starting with "# 🎨 Chromatic Palettes".');
      expect(paletteRequest.userMessage).toContain('Compare consonant textures in prose.');
      expect(paletteRequest.options).toMatchObject({ maxTokens: 3500, timeoutMs: 15000 });
      expect(result.result.indexOf('# 🎨 Chromatic Palettes'))
        .toBeGreaterThan(result.result.indexOf('# ai advisory notes'));
      if (includeEncyclopedia) {
        expect(result.result.indexOf('# 📂 Topic & Related Lexicon'))
          .toBeGreaterThan(result.result.indexOf('# 🎨 Chromatic Palettes'));
      } else {
        expect(result.result.endsWith(paletteSection)).toBe(true);
      }
    } else {
      expect(promptPaths).not.toContain('dictionary-fast/16-chromatic-palettes-block.md');
      expect(paletteRequest).toBeUndefined();
      expect(result.result).not.toContain('Chromatic Palettes');
      expect(result.metadata.blockDurations).not.toHaveProperty('chromatic-palettes');
    }
    if (includeEncyclopedia) {
      expect(promptPaths).toContain('dictionary-fast/17-topic-related-lexicon-block.md');
      expect(topicRequest.systemMessage).toContain('# 📂 Topic & Related Lexicon');
      expect(topicRequest.systemMessage).toContain('not automatically synonyms or antonyms');
      expect(topicRequest.systemMessage).toContain('at least two developed paragraphs');
      expect(topicRequest.systemMessage).toContain('4–8 useful terms');
      expect(topicRequest.systemMessage).toContain('1–2 seminal or foundational reference books');
      expect(topicRequest.systemMessage).toContain('no short word cap');
      expect(topicRequest.userMessage).toContain('Compare consonant textures in prose.');
      expect(result.result.indexOf('# 📂 Topic & Related Lexicon'))
        .toBeGreaterThan(result.result.indexOf('# ai advisory notes'));
      expect(result.result.endsWith('- **Fricative** — A contrasting consonant class.')).toBe(true);
    } else {
      expect(promptPaths).not.toContain('dictionary-fast/17-topic-related-lexicon-block.md');
      expect(topicRequest).toBeUndefined();
      expect(result.result).not.toContain('Topic & Related Lexicon');
      expect(result.metadata.blockDurations).not.toHaveProperty('topic-related-lexicon');
      if (!withPalettes) {
        expect(result.result.endsWith('# ai advisory notes')).toBe(true);
      }
    }
    const senseRequest = runInitial.mock.calls.find(([call]) => call.toolName === 'dictionary-fast-sense-explorer')![0];
    expect(senseRequest.systemMessage).toContain('8-12 synonyms');
    expect(senseRequest.systemMessage).toContain('4-6 antonyms');
    expect(senseRequest.systemMessage).not.toContain('no direct antonym exists');
    expect(result.result.indexOf('# morphology family'))
      .toBeGreaterThan(result.result.indexOf('# collocations idioms'));
    expect(onProgress).toHaveBeenCalledTimes(totalBlocks);
    const finalProgress = onProgress.mock.calls.at(-1)![0];
    expect(finalProgress).toMatchObject({ word: 'plosive', totalBlocks });
    expect(finalProgress.completedBlocks).toHaveLength(totalBlocks);
    expect(finalProgress.completedBlocks.includes('topic-related-lexicon')).toBe(includeEncyclopedia);
    expect(finalProgress.completedBlocks.includes('chromatic-palettes')).toBe(withPalettes);
    for (const [progress] of onProgress.mock.calls) {
      expect(progress.totalBlocks).toBe(totalBlocks);
    }
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

  it('reserves the expanded generation budget for topic exploration on initial attempts and retries', async () => {
    const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => {
      if (toolName === 'dictionary-fast-topic-related-lexicon' || toolName === 'dictionary-fast-definition') {
        throw new Error('Transient generation failure');
      }
      return { content: `# ${toolName}`, usage: undefined };
    });
    const { service } = await buildLookupService(runInitial);
    const controller = new AbortController();

    const result = await service.generateParallelDictionary('plosive', undefined, { signal: controller.signal });

    expect(result.metadata).toMatchObject({ totalBlocks: 16, successCount: 16, partialFailures: [] });
    const topicRequests = runInitial.mock.calls.map(([call]) => call)
      .filter((call) => call.toolName.startsWith('dictionary-fast-topic-related-lexicon'));
    expect(topicRequests.map((call) => call.toolName)).toEqual([
      'dictionary-fast-topic-related-lexicon', 'dictionary-fast-topic-related-lexicon-retry'
    ]);
    for (const request of topicRequests) {
      expect(request.options).toMatchObject({ maxTokens: 6000, timeoutMs: 90000, signal: controller.signal });
    }

    const otherRequests = runInitial.mock.calls.map(([call]) => call)
      .filter((call) => !call.toolName.startsWith('dictionary-fast-topic-related-lexicon'));
    expect(otherRequests.map((call) => call.toolName)).toContain('dictionary-fast-definition-retry');
    expect(otherRequests).toHaveLength(16);
    for (const request of otherRequests) {
      expect(request.options).toMatchObject({ maxTokens: 3500, timeoutMs: 15000, signal: controller.signal });
    }
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
