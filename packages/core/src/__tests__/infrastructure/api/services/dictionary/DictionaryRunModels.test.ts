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

const run = (requestedModelId: string, served: string[], replySource: 'provider' | 'host-fallback' = 'provider') => ({
  models: { requestedModelId, servedModelIds: served },
  replySource
});

const buildService = async (runInitial: jest.Mock) => {
  const service = new DictionaryService(
    { ensureInitialized: jest.fn().mockResolvedValue(undefined), getEngine: jest.fn().mockReturnValue({ runInitial }) } as never,
    {
      getPromptLoader: () => ({
        loadSharedPrompts: jest.fn().mockResolvedValue('shared prompts'),
        loadPrompts: jest.fn().mockResolvedValue('dictionary prompts')
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

  it('gives a full entry the first block\'s requested model and every block\'s served models', async () => {
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
});
