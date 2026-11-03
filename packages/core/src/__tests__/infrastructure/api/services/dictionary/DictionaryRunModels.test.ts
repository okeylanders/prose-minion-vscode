/**
 * A dictionary lookup's run models, for the Workshop stamp a persona's lookup
 * carries (ADR 2026-11-03 D7, scope `dictionary`, after Astra's N-01). The
 * served ids are the engine's provider-reported ones, never the history's
 * `modelIds`, which keep their own reading.
 */
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { DictionaryService } from '@/infrastructure/api/services/dictionary/DictionaryService';
import { dictionaryEntryRunModel } from '@services/dictionary/DictionaryRunModel';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { ConversationManager } from '@orchestration/ConversationManager';

const run = (requestedModelId: string, served: string[], replySource: 'provider' | 'host-fallback' = 'provider') => ({
  models: { requestedModelId, servedModelIds: served },
  replySource
});

const buildService = async (
  runInitial: jest.Mock | AgentRunEngine['runInitial'],
  loadPrompts: jest.Mock = jest.fn().mockResolvedValue('dictionary prompts'),
  engine: unknown = { runInitial }
) => {
  const service = new DictionaryService(
    { ensureInitialized: jest.fn().mockResolvedValue(undefined), getEngine: jest.fn().mockReturnValue(engine) } as never,
    {
      getPromptLoader: () => ({
        loadSharedPrompts: jest.fn().mockResolvedValue('shared prompts'),
        loadPrompts
      })
    } as never,
    { getOptions: jest.fn().mockReturnValue({ temperature: 0.4, maxTokens: 1000 }) } as never,
    { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() } as never
  );
  await service.refreshConfiguration();
  return service;
};

describe('dictionary run models', () => {
  it('gives a single lookup its run\'s models, scoped dictionary, and reply source', async () => {
    const service = await buildService(jest.fn().mockResolvedValue({
      content: '# liminal',
      modelId: 'vendor/fallback-telemetry',
      ...run('vendor/dictionary', ['vendor/dictionary-0601'])
    }));

    const result = await service.lookupWordStreaming('liminal', undefined, jest.fn());

    expect(result.model).toEqual({
      scope: 'dictionary',
      requestedModelId: 'vendor/dictionary',
      servedModelIds: ['vendor/dictionary-0601']
    });
    expect(result.replySource).toBe('provider');
    expect(result.modelId).toBe('vendor/fallback-telemetry');
  });

  it('gives a full entry the earliest-requested block\'s model and every kept block\'s served models', async () => {
    const runInitial = jest.fn(async ({ toolName }: { toolName: string }) => {
      if (toolName.startsWith('dictionary-fast-definition')) {
        throw new Error('Definition unavailable');
      }
      return toolName.startsWith('dictionary-fast-pronunciation')
        ? { content: `# ${toolName}`, modelId: 'B', ...run('vendor/b', ['vendor/b-served']) }
        : { content: `# ${toolName}`, modelId: 'A', ...run('vendor/a', ['vendor/a-served']) };
    });
    const service = await buildService(runInitial);

    const result = await service.generateParallelDictionary('liminal');

    expect(result.metadata.partialFailures).toEqual(['definition']);
    expect(result.model).toEqual({
      scope: 'dictionary',
      requestedModelId: 'vendor/b',
      servedModelIds: ['vendor/b-served', 'vendor/a-served']
    });
    expect(result.replySource).toBe('provider');
  });

  it('keeps the run models out of the full entry when no block was generated', async () => {
    const service = await buildService(jest.fn().mockRejectedValue(new Error('unavailable')));

    const result = await service.generateParallelDictionary('liminal');

    expect(result.metadata.successCount).toBe(0);
    expect(result.model).toBeUndefined();
    expect(result.replySource).toBeUndefined();
  });

  it('marks a full entry host-written when any block in it was', () => {
    expect(dictionaryEntryRunModel([
      run('vendor/a', ['vendor/a']),
      run('vendor/a', [], 'host-fallback')
    ]).replySource).toBe('host-fallback');
    expect(dictionaryEntryRunModel([
      run('vendor/a', ['vendor/a']),
      run('vendor/a', ['vendor/a'])
    ])).toEqual({
      model: { scope: 'dictionary', requestedModelId: 'vendor/a', servedModelIds: ['vendor/a'] },
      replySource: 'provider'
    });
  });

  describe('a full entry is attributed only to text it kept (Astra F-04)', () => {
    const SPECIAL_FOCUS_ONLY = '## **Special Focus: Threshold**\nA section only the special-focus block keeps.';

    it('gives no stamp to an entry whose only answer normalization removed', async () => {
      const service = await buildService(jest.fn(async ({ toolName }: { toolName: string }) => {
        if (toolName.startsWith('dictionary-fast-definition')) {
          return { content: SPECIAL_FOCUS_ONLY, ...run('vendor/removed', ['vendor/removed']) };
        }
        throw new Error('unavailable');
      }));

      const result = await service.generateParallelDictionary('liminal');

      expect(result.result).not.toContain('Special Focus');
      expect(result.model).toBeUndefined();
      expect(result.replySource).toBeUndefined();
    });

    it('keeps a removed block\'s model out of the stamp beside text another model wrote', async () => {
      const service = await buildService(jest.fn(async ({ toolName }: { toolName: string }) =>
        toolName.startsWith('dictionary-fast-definition')
          ? { content: SPECIAL_FOCUS_ONLY, ...run('vendor/removed', ['vendor/removed']) }
          : { content: `# ${toolName}`, ...run('vendor/kept', ['vendor/kept-served']) }
      ));

      const result = await service.generateParallelDictionary('liminal');

      expect(result.model).toEqual({
        scope: 'dictionary',
        requestedModelId: 'vendor/kept',
        servedModelIds: ['vendor/kept-served']
      });
    });

    it('stamps an entry whose blocks it kept', async () => {
      const service = await buildService(jest.fn(async ({ toolName }: { toolName: string }) => (
        { content: `# ${toolName}`, ...run('vendor/kept', ['vendor/kept-served']) }
      )));

      const result = await service.generateParallelDictionary('liminal');

      expect(result.model?.servedModelIds).toEqual(['vendor/kept-served']);
      expect(result.replySource).toBe('provider');
    });
  });

  it('reads a full entry\'s runs in the order they were requested (Astra N-02)', async () => {
    // The real engine captures each block's requested model; the provider
    // names whichever model the client is set to when the request arrives.
    let selected = 'vendor/a';
    const client = {
      getModel: () => selected,
      setModel: (model: string) => { selected = model; },
      createChatCompletion: jest.fn(async () => ({ content: `# block on ${selected}`, servedModelId: `${selected}-served` })),
      createStreamingChatCompletion: jest.fn()
    };
    const engine = new AgentRunEngine(client as never, new ConversationManager());
    let releaseDefinition!: () => void;
    const definitionHeld = new Promise<void>((resolve) => { releaseDefinition = resolve; });
    const loadPrompts = jest.fn(async ([path]: string[]) => {
      if (path.includes('-definition-block')) {
        await definitionHeld;
      }
      return 'dictionary prompts';
    });
    const service = await buildService(engine.runInitial.bind(engine), loadPrompts, engine);

    // Fifteen blocks: neither optional one.
    const pending = service.generateParallelDictionary('liminal', undefined, {
      includeEncyclopedia: false,
      includePalettes: false
    });
    let result: Awaited<typeof pending>;
    try {
      // Every block but the first displayed one is sent on model A.
      for (let tick = 0; tick < 100 && client.createChatCompletion.mock.calls.length < 14; tick += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(client.createChatCompletion).toHaveBeenCalledTimes(14);
      engine.setModel('vendor/b');
    } finally {
      releaseDefinition();
      result = await pending;
      engine.dispose();
    }

    expect(result.result.indexOf('# block on vendor/b')).toBeLessThan(result.result.indexOf('# block on vendor/a'));
    expect(result.model).toEqual({
      scope: 'dictionary',
      requestedModelId: 'vendor/a',
      servedModelIds: ['vendor/a-served', 'vendor/b-served']
    });
  });
});
