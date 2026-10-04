import { OpenRouterModels } from '@providers/OpenRouterModels';

describe('live model context windows', () => {
  const previousFetch = global.fetch;
  beforeEach(() => OpenRouterModels.clearCache());
  afterEach(() => { global.fetch = previousFetch; OpenRouterModels.clearCache(); });

  it('resolves aliases and routing variants from live catalog evidence', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { id: 'anthropic/claude-sonnet-5', context_length: 1_000_000 },
      { id: 'fake/fallback', context_length: 200_000, isFallback: true },
      { id: 'fake/invalid', context_length: 0 }
    ] }) }) as never;
    await OpenRouterModels.fetchModels();
    expect(OpenRouterModels.getCachedContextLength(' ~anthropic/claude-sonnet-5:extended ')).toBe(1_000_000);
    expect(OpenRouterModels.getCachedContextLength('fake/fallback')).toBeUndefined();
    expect(OpenRouterModels.getCachedContextLength('fake/invalid')).toBeUndefined();
    expect(OpenRouterModels.getCachedContextLength('fake/unknown')).toBeUndefined();
  });

  it('leaves an unpopulated catalog unknown rather than assuming a 200K window', () => {
    expect(OpenRouterModels.getCachedContextLength('anthropic/claude-sonnet-5')).toBeUndefined();
  });
});
