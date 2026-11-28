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

  it('distinguishes supported reasoning, known non-support and missing metadata', async () => {
    /* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire fields. */
    await catalog([
      { id: 'test/required', reasoning: { mandatory: true } },
      { id: 'test/optional', reasoning: { mandatory: false }, supported_parameters: ['temperature'] },
      { id: 'test/budget', supported_parameters: ['temperature', 'reasoning'] },
      { id: 'test/effort', supported_parameters: ['reasoning_effort'] },
      { id: 'test/plain', supported_parameters: ['temperature', 'max_tokens'] },
      { id: 'test/partial', supported_parameters: [] },
      { id: 'test/malformed', supported_parameters: ['temperature', 1] },
      { id: 'test/empty-param', supported_parameters: [''] },
      { id: 'test/fallback', isFallback: true, supported_parameters: ['temperature'] }
    ]);
    /* eslint-enable @typescript-eslint/naming-convention */

    for (const model of ['test/required', 'test/optional', 'test/budget', 'test/effort:nitro']) {
      expect(OpenRouterModels.getCachedSupportsReasoning(model)).toBe(true);
    }
    expect(OpenRouterModels.getCachedSupportsReasoning('test/plain')).toBe(false);
    for (const model of ['test/partial', 'test/malformed', 'test/empty-param', 'test/fallback', 'test/unlisted']) {
      expect(OpenRouterModels.getCachedSupportsReasoning(model)).toBeUndefined();
    }
  });

  it('is unknown before the catalog is read, and for the offline fallback', async () => {
    expect(OpenRouterModels.getCachedAlwaysReasons('anthropic/claude-haiku-5.5')).toBeUndefined();
    expect(OpenRouterModels.getCachedSupportsReasoning('anthropic/claude-haiku-5.5')).toBeUndefined();

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
