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

  it('fans explicit processed-usage resets out to every live surface', () => {
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn() } as never,
      { get: jest.fn() } as never
    );
    const first = jest.fn();
    const second = jest.fn();
    const disposeFirst = manager.addTokenUsageResetListener(first);
    manager.addTokenUsageResetListener(second);

    manager.resetTokenUsage();
    disposeFirst();
    manager.resetTokenUsage();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    manager.dispose();
  });

  it('names an invalid scope and leaves every model unchanged when validation fails', async () => {
    const configured: Record<string, string | undefined> = {};
    const log = { appendLine: jest.fn() };
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue('key') } as never,
      { get: jest.fn((_section, key, fallback) => configured[key] ?? fallback) } as never,
      log as never
    );
    await manager.ensureInitialized();
    const originalAssistant = manager.getResolvedModel('assistant');
    const originalContext = manager.getResolvedModel('context');
    configured.assistantModel = 'openai/gpt-5.2';
    configured.contextModel = '';

    await expect(manager.refreshModelSelections()).rejects.toThrow(
      'Model hot-swap failed for context'
    );

    expect(manager.getEngine('assistant')?.getModel()).toBe(originalAssistant);
    expect(manager.getEngine('context')?.getModel()).toBe(originalContext);
    expect(manager.getResolvedModel('assistant')).toBe(originalAssistant);
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('failed for context')
    );
    manager.dispose();
  });

  it('rolls back earlier scopes when a later engine rejects a hot-swap', async () => {
    const configured: Record<string, string | undefined> = {};
    const log = { appendLine: jest.fn() };
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue('key') } as never,
      { get: jest.fn((_section, key, fallback) => configured[key] ?? fallback) } as never,
      log as never
    );
    await manager.ensureInitialized();
    const originalAssistant = manager.getResolvedModel('assistant')!;
    const originalContext = manager.getResolvedModel('context')!;
    configured.assistantModel = 'openai/gpt-5.2';
    configured.contextModel = 'google/gemini-3.1-pro-preview';
    jest.spyOn(manager.getEngine('context')!, 'setModel')
      .mockImplementationOnce(() => { throw new Error('provider rejected model'); });

    await expect(manager.refreshModelSelections()).rejects.toThrow('provider rejected model');

    expect(manager.getEngine('assistant')?.getModel()).toBe(originalAssistant);
    expect(manager.getEngine('context')?.getModel()).toBe(originalContext);
    expect(manager.getResolvedModel('assistant')).toBe(originalAssistant);
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('failed for context; applied scopes rolled back')
    );
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
