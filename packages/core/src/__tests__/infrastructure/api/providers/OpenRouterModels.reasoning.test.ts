/**
 * PR #181 F-01: whether the live catalog marks a model as always reasoning
 * (`reasoning.mandatory`). Only a live entry's boolean counts; everything
 * else is unknown. The catalog is a stand-in; model ids are placeholders.
 */
import { OpenRouterModels } from '@providers/OpenRouterModels';

describe('live catalog reasoning marks', () => {
  const previousFetch = global.fetch;
  beforeEach(() => OpenRouterModels.clearCache());
  afterEach(() => { global.fetch = previousFetch; OpenRouterModels.clearCache(); });

  const catalog = (data: unknown[]) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }) as never;
    return OpenRouterModels.fetchModels();
  };

  it('reads a live entry\'s boolean mark, and nothing else', async () => {
    await catalog([
      { id: 'test/always', reasoning: { mandatory: true, efforts: ['high', 'low'] } },
      { id: 'test/optional', reasoning: { mandatory: false } },
      { id: 'test/no-reasoning' },
      { id: 'test/null', reasoning: null },
      { id: 'test/not-an-object', reasoning: true },
      { id: 'test/string-mark', reasoning: { mandatory: 'true' } },
      { id: 'test/no-mark', reasoning: { efforts: ['low'] } },
      { id: 'test/fallback', isFallback: true, reasoning: { mandatory: true } }
    ]);

    expect(OpenRouterModels.getCachedAlwaysReasons('test/always')).toBe(true);
    expect(OpenRouterModels.getCachedAlwaysReasons('test/optional')).toBe(false);
    for (const unknown of ['test/no-reasoning', 'test/null', 'test/not-an-object', 'test/string-mark', 'test/no-mark', 'test/fallback', 'test/unlisted']) {
      expect(OpenRouterModels.getCachedAlwaysReasons(unknown)).toBeUndefined();
    }
  });

  it('resolves routing variants as the context window does', async () => {
    await catalog([{ id: 'test/always', reasoning: { mandatory: true } }]);

    expect(OpenRouterModels.getCachedAlwaysReasons(' ~test/always:nitro ')).toBe(true);
  });

  it('is unknown before the catalog is read, and for the offline fallback', async () => {
    expect(OpenRouterModels.getCachedAlwaysReasons('anthropic/claude-haiku-5.5')).toBeUndefined();

    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await OpenRouterModels.fetchModels({ appendLine: jest.fn() } as never);
    } finally {
      consoleError.mockRestore();
    }

    expect(OpenRouterModels.getCachedAlwaysReasons('anthropic/claude-haiku-5.5')).toBeUndefined();
  });
});
