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
