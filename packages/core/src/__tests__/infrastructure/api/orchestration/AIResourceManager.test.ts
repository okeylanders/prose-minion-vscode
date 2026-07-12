import { AIResourceManager } from '@orchestration/AIResourceManager';

describe('AIResourceManager lifecycle', () => {
  it('creates one observable generation until an explicit configuration rebuild', async () => {
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue('key') } as never,
      { get: jest.fn((_section, _key, fallback) => fallback) } as never
    );

    await Promise.all([manager.ensureInitialized(), manager.ensureInitialized()]);
    const first = manager.getEngine('assistant');
    expect(first).toBeDefined();
    expect(manager.getGeneration('assistant')).toBe(1);

    await manager.refreshConfiguration();
    expect(manager.getGeneration('assistant')).toBe(2);
    expect(manager.getEngine('assistant')).not.toBe(first);
    manager.dispose();
  });

  it('changes configured models in place without replacing any scoped engine', async () => {
    const configured: Record<string, string | undefined> = {};
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue('key') } as never,
      {
        get: jest.fn((_section, key, fallback) => configured[key] ?? fallback)
      } as never
    );
    await manager.ensureInitialized();
    const engines = {
      assistant: manager.getEngine('assistant'),
      dictionary: manager.getEngine('dictionary'),
      context: manager.getEngine('context'),
      category: manager.getEngine('category')
    };

    configured.contextModel = 'google/gemini-3.1-pro-preview';
    await Promise.all([
      manager.refreshModelSelections(),
      manager.refreshModelSelections()
    ]);

    expect(manager.getEngine('assistant')).toBe(engines.assistant);
    expect(manager.getEngine('dictionary')).toBe(engines.dictionary);
    expect(manager.getEngine('context')).toBe(engines.context);
    expect(manager.getEngine('category')).toBe(engines.category);
    expect(manager.getGeneration('context')).toBe(1);
    expect(manager.getResolvedModel('context')).toBe('google/gemini-3.1-pro-preview');
    expect(manager.getEngine('context')?.getModel()).toBe('google/gemini-3.1-pro-preview');
    expect(manager.getEngine('assistant')?.getModel()).toBe('anthropic/claude-sonnet-5');
    manager.dispose();
  });

  it('retries after a failed build instead of caching the rejection forever', async () => {
    const getApiKey = jest.fn()
      .mockRejectedValueOnce(new Error('keychain locked'))
      .mockResolvedValue('key');
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey } as never,
      { get: jest.fn((_section, _key, fallback) => fallback) } as never
    );

    await expect(manager.ensureInitialized()).rejects.toThrow('keychain locked');
    await expect(manager.ensureInitialized()).resolves.toBeUndefined();
    expect(manager.getEngine('assistant')).toBeDefined();
    manager.dispose();
  });
});
