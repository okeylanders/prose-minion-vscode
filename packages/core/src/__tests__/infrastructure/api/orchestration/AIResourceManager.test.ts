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
});
