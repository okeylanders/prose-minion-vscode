import { AIResourceManager } from '@orchestration/AIResourceManager';
import { DEFAULT_CATEGORY_MODEL } from '@providers/OpenRouterModels';

describe('AIResourceManager lifecycle', () => {
  it('keeps the assistant engine stable across explicit configuration rebuilds', async () => {
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue('key') } as never,
      { get: jest.fn((_section, _key, fallback) => fallback) } as never,
      { createProvider: jest.fn() } as never
    );

    await Promise.all([manager.ensureInitialized(), manager.ensureInitialized()]);
    const first = manager.getEngine('assistant');
    expect(first).toBeDefined();
    expect(manager.getGeneration('assistant')).toBe(1);

    await manager.refreshConfiguration();
    expect(manager.getGeneration('assistant')).toBe(2);
    expect(manager.getEngine('assistant')).toBe(first);
    manager.dispose();
  });

  it('keeps one offline assistant engine and attaches its provider when a key appears', async () => {
    const getApiKey = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('key');
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey } as never,
      { get: jest.fn((_section, _key, fallback) => fallback) } as never,
      { createProvider: jest.fn() } as never
    );

    await manager.ensureInitialized();
    const offline = manager.getEngine('assistant');
    expect(offline).toBeDefined();
    expect(offline?.isProviderAvailable()).toBe(false);

    await manager.refreshConfiguration();
    expect(manager.getEngine('assistant')).toBe(offline);
    expect(offline?.isProviderAvailable()).toBe(true);
    manager.dispose();
  });

  it('changes configured models in place without replacing any scoped engine', async () => {
    const configured: Record<string, string | undefined> = {};
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue('key') } as never,
      {
        get: jest.fn((_section, key, fallback) => configured[key] ?? fallback)
      } as never,
      { createProvider: jest.fn() } as never
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
    expect(manager.getEngine('category')?.getModel()).toBe(DEFAULT_CATEGORY_MODEL);
    manager.dispose();
  });

  it('fans explicit processed-usage resets out to every live surface', () => {
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn() } as never,
      { get: jest.fn() } as never,
      { createProvider: jest.fn() } as never
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
      { createProvider: jest.fn() } as never,
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
      { createProvider: jest.fn() } as never,
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
      { get: jest.fn((_section, _key, fallback) => fallback) } as never,
      { createProvider: jest.fn() } as never
    );

    await expect(manager.ensureInitialized()).rejects.toThrow('keychain locked');
    await expect(manager.ensureInitialized()).resolves.toBeUndefined();
    expect(manager.getEngine('assistant')).toBeDefined();
    manager.dispose();
  });
});

/**
 * The Lightbox's own model scope (Slice 4L): its engine and client are its
 * own, built by the manager the composition root owns, so a Lightbox model
 * never moves the assistant engine the Workshop's conversations live on.
 * Model ids are placeholders; no provider is called.
 */
describe('AIResourceManager, the lightbox scope (Slice 4L)', () => {
  const WORKSHOP = 'placeholder/workshop-model';
  const WORKSHOP_NEXT = 'placeholder/workshop-model-next';
  const LIGHTBOX = 'placeholder/lightbox-model';
  // Disposed even when an expectation fails first, so no engine's cleanup timer outlives its test.
  const built: AIResourceManager[] = [];
  afterEach(() => built.splice(0).forEach((manager) => manager.dispose()));

  async function managerWith(configured: Record<string, string | undefined>, apiKey: string | null = 'key') {
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey: jest.fn().mockResolvedValue(apiKey ?? undefined) } as never,
      { get: jest.fn((_section, key, fallback) => configured[key] ?? fallback) } as never,
      { createProvider: jest.fn() } as never
    );
    built.push(manager);
    await manager.ensureInitialized();
    return manager;
  }

  it('builds the Lightbox its own engine, on the assistant model while it has none of its own', async () => {
    const manager = await managerWith({ assistantModel: WORKSHOP });

    const lightbox = manager.getEngine('lightbox');
    expect(lightbox).toBeDefined();
    expect(lightbox).not.toBe(manager.getEngine('assistant'));
    expect(lightbox?.getModel()).toBe(WORKSHOP);
    expect(manager.getResolvedModel('lightbox')).toBe(WORKSHOP);
    manager.dispose();
  });

  it('hot-swaps only the Lightbox engine when its model is picked, never the assistant engine', async () => {
    const configured: Record<string, string | undefined> = { assistantModel: WORKSHOP };
    const manager = await managerWith(configured);
    const engines = { assistant: manager.getEngine('assistant'), lightbox: manager.getEngine('lightbox') };
    const assistantSetModel = jest.spyOn(engines.assistant!, 'setModel');

    configured.lightboxModel = LIGHTBOX;
    await manager.refreshModelSelections();

    expect(manager.getEngine('lightbox')).toBe(engines.lightbox);
    expect(engines.lightbox?.getModel()).toBe(LIGHTBOX);
    expect(manager.getResolvedModel('lightbox')).toBe(LIGHTBOX);
    expect(assistantSetModel).not.toHaveBeenCalled();
    expect(engines.assistant?.getModel()).toBe(WORKSHOP);
    expect(manager.getResolvedModel('assistant')).toBe(WORKSHOP);
    manager.dispose();
  });

  it('keeps a Lightbox model that has been set when the assistant model changes', async () => {
    const configured: Record<string, string | undefined> = { assistantModel: WORKSHOP, lightboxModel: LIGHTBOX };
    const manager = await managerWith(configured);

    configured.assistantModel = WORKSHOP_NEXT;
    await manager.refreshModelSelections();

    expect(manager.getEngine('assistant')?.getModel()).toBe(WORKSHOP_NEXT);
    expect(manager.getEngine('lightbox')?.getModel()).toBe(LIGHTBOX);
    expect(manager.getResolvedModel('lightbox')).toBe(LIGHTBOX);
    manager.dispose();
  });

  it('follows the assistant model while unset, and again once its own model is cleared', async () => {
    const configured: Record<string, string | undefined> = { assistantModel: WORKSHOP };
    const manager = await managerWith(configured);

    configured.assistantModel = WORKSHOP_NEXT;
    await manager.refreshModelSelections();
    expect(manager.getEngine('lightbox')?.getModel()).toBe(WORKSHOP_NEXT);

    configured.lightboxModel = LIGHTBOX;
    await manager.refreshModelSelections();
    expect(manager.getEngine('lightbox')?.getModel()).toBe(LIGHTBOX);

    configured.lightboxModel = undefined;
    await manager.refreshModelSelections();
    expect(manager.getEngine('lightbox')?.getModel()).toBe(WORKSHOP_NEXT);
    expect(manager.getResolvedModel('lightbox')).toBe(WORKSHOP_NEXT);
    manager.dispose();
  });

  it('retires every disposable engine\'s transport when its bundle is rebuilt, so a held engine starts no new call (PR #169 F-01)', async () => {
    const manager = await managerWith({ assistantModel: WORKSHOP });
    const retired = (['lightbox', 'dictionary', 'context', 'category', 'widget'] as const)
      .map((scope) => manager.getEngine(scope));
    expect(retired.every((engine) => engine?.isProviderAvailable())).toBe(true);

    await manager.refreshConfiguration();

    expect(retired.map((engine) => engine?.isProviderAvailable())).toEqual([false, false, false, false, false]);
    await expect(retired[0]!.runInitial({} as never)).rejects.toMatchObject({ reason: 'missing-credentials' });
    expect(manager.getEngine('lightbox')).not.toBe(retired[0]);
    expect(manager.getEngine('lightbox')?.isProviderAvailable()).toBe(true);
  });

  it('never lets a rebuild that read the old key replace a newer one\'s transports (PR #169 F-01)', async () => {
    const keys: Array<(key: string | undefined) => void> = [];
    const getApiKey = jest.fn(() => new Promise<string | undefined>((resolve) => keys.push(resolve)));
    const manager = new AIResourceManager(
      { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
      { getApiKey } as never,
      { get: jest.fn((_section, key, fallback) => ({ assistantModel: WORKSHOP } as Record<string, string>)[key] ?? fallback) } as never,
      { createProvider: jest.fn() } as never
    );
    built.push(manager);
    const keyOf = (engine: unknown) => Reflect.get(Reflect.get(engine as object, 'openRouterClient') as object, 'apiKey');

    // Two webviews refresh at once: the first reads the key before it changed, and answers last.
    const stale = manager.refreshConfiguration();
    const fresh = manager.refreshConfiguration();
    keys[1]('sk-placeholder-next');
    await fresh;
    const current = { lightbox: manager.getEngine('lightbox'), assistant: manager.getEngine('assistant') };
    keys[0]('sk-placeholder-first');
    await stale;

    expect(manager.getEngine('lightbox')).toBe(current.lightbox);
    expect(current.lightbox?.isProviderAvailable()).toBe(true);
    expect(keyOf(current.lightbox)).toBe('sk-placeholder-next');
    expect(keyOf(manager.getEngine('assistant'))).toBe('sk-placeholder-next');
  });

  it('has no Lightbox engine without an API key, but still resolves its model for estimates', async () => {
    const manager = await managerWith({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX }, null);

    expect(manager.getEngine('lightbox')).toBeUndefined();
    expect(manager.getResolvedModel('lightbox')).toBe(LIGHTBOX);
    manager.dispose();
  });
});
