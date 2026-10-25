/**
 * AIResourceRefresh (PR #171 F-01 and its re-review): the shared manager's
 * extension-lifetime key and model subscriptions. Requests are ordered when
 * made; only the newest one's reading of the key counts, and it rebuilds only
 * when that key is not the one the manager adopted. The manager here is a
 * stand-in that adopts the key it is handed, as the real one does; keys are
 * placeholders.
 */
import { AIResourceRefresh } from '@orchestration/AIResourceRefresh';
import { apiKeyFingerprint } from '@orchestration/apiKeyFingerprint';
import { MODEL_SCOPE_SETTING_KEYS } from '@orchestration/ModelScopeSelections';

function createRefresh(options: { key?: string; legacyKey?: string; rebuild?: (apiKey: string | undefined) => Promise<void> } = {}) {
  let key = options.key;
  /** Reads held by the test: each resolves with the key as it stood when read. */
  const held: Array<() => void> = [];
  let holdReads = false;
  const listeners = new Set<() => void>();
  const keys = {
    getApiKey: jest.fn(() => {
      const value = key;
      return holdReads ? new Promise<string | undefined>((resolve) => held.push(() => resolve(value))) : Promise.resolve(value);
    }),
    onDidChange: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    })
  };
  let adopted: string | undefined = apiKeyFingerprint(key);
  const manager = {
    refreshConfiguration: jest.fn(async (observed?: { apiKey: string | undefined }) => {
      // As the real manager does: the handed key is adopted at once, and a failed build adopts nothing.
      adopted = apiKeyFingerprint(observed?.apiKey);
      try {
        await (options.rebuild ?? (async () => undefined))(observed?.apiKey);
      } catch (error) {
        adopted = undefined;
        throw error;
      }
    }),
    adoptedKeyFingerprint: jest.fn(() => adopted),
    refreshModelSelections: jest.fn(async () => undefined)
  };
  const settings = { get: jest.fn((_section: string, name: string) => (name === 'openRouterApiKey' ? options.legacyKey : undefined)) };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const refresh = new AIResourceRefresh(manager as never, keys, settings as never, log);
  return {
    refresh, manager, keys, log,
    setKey: (next: string | undefined) => { key = next; },
    holdReads: (hold: boolean) => { holdReads = hold; },
    releaseRead: (index: number) => held[index](),
    fireKeyChange: () => [...listeners].forEach((listener) => listener()),
    listenerCount: () => listeners.size
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('AIResourceRefresh', () => {
  it('rebuilds the manager with the key now stored when it changes, with no webview involved', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    host.setKey('sk-placeholder-next');
    host.fireKeyChange();
    await settle();

    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(host.manager.refreshConfiguration).toHaveBeenCalledWith({ apiKey: 'sk-placeholder-next' });
  });

  it('rebuilds once for one key change, however many surfaces ask at once', async () => {
    let finish: () => void = () => undefined;
    const host = createRefresh({ key: 'sk-placeholder-first', rebuild: () => new Promise<void>((resolve) => { finish = resolve; }) });
    host.setKey('sk-placeholder-next');
    host.fireKeyChange();
    const surfaces = [host.refresh.refreshKey(), host.refresh.refreshKey(), host.refresh.refreshKey()];
    await settle();
    finish();
    await Promise.all(surfaces);

    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);
  });

  it('builds nothing when the stored key is the one the manager adopted', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    await host.refresh.refreshKey();
    expect(host.manager.refreshConfiguration).not.toHaveBeenCalled();

    host.setKey(undefined);
    await host.refresh.refreshKey();
    await host.refresh.refreshKey();
    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);
  });

  it('lets an older read that answers last build nothing, and a later change still rebuilds (re-review)', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    host.holdReads(true);
    host.setKey(undefined);
    host.fireKeyChange();                      // read 0 sees no key, and is held
    host.setKey('sk-placeholder-next');
    host.fireKeyChange();                      // read 1 sees the next key
    host.holdReads(false);
    host.releaseRead(1);
    await settle();
    expect(host.manager.refreshConfiguration.mock.calls).toEqual([[{ apiKey: 'sk-placeholder-next' }]]);

    host.releaseRead(0);                       // the obsolete read lands last
    await settle();
    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);

    host.setKey(undefined);
    await host.refresh.refreshKey();           // a real deletion is still heard
    expect(host.manager.refreshConfiguration.mock.calls.at(-1)).toEqual([{ apiKey: undefined }]);
  });

  it('builds nothing for a read still pending when the owner is disposed', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    host.holdReads(true);
    host.setKey('sk-placeholder-next');
    const pending = host.refresh.refreshKey();
    host.refresh.dispose();
    host.releaseRead(0);
    await pending;

    expect(host.manager.refreshConfiguration).not.toHaveBeenCalled();
    await host.refresh.refreshKey();
    expect(host.keys.getApiKey).toHaveBeenCalledTimes(1);
  });

  it('reads the legacy key setting when nothing is stored, as the manager does', async () => {
    const host = createRefresh({ legacyKey: 'sk-placeholder-legacy' });
    host.refresh.handleConfigurationChange((section) => section === 'proseMinion.openRouterApiKey');
    await settle();

    expect(host.manager.refreshConfiguration).toHaveBeenCalledWith({ apiKey: 'sk-placeholder-legacy' });
  });

  it('tries again after a rebuild that failed', async () => {
    const rebuild = jest.fn()
      .mockRejectedValueOnce(new Error('synthetic build failure'))
      .mockResolvedValue(undefined);
    const host = createRefresh({ key: 'sk-placeholder-first', rebuild });
    host.setKey('sk-placeholder-next');
    await expect(host.refresh.refreshKey()).rejects.toThrow('synthetic build failure');
    await host.refresh.refreshKey();

    expect(rebuild).toHaveBeenCalledTimes(2);
    expect(host.log.appendLine).toHaveBeenCalledWith(expect.stringContaining('[AIResourceRefresh] Rebuild after an API key change failed'));
  });

  it.each(Object.values(MODEL_SCOPE_SETTING_KEYS))('hot-swaps in place when proseMinion.%s changes, rebuilding nothing', async (key) => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    host.refresh.handleConfigurationChange((section) => section === `proseMinion.${key}`);
    await settle();

    expect(host.manager.refreshModelSelections).toHaveBeenCalledTimes(1);
    expect(host.manager.refreshConfiguration).not.toHaveBeenCalled();
  });

  it('ignores settings that change neither the key nor a model', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    host.refresh.handleConfigurationChange((section) => section === 'proseMinion.ui.showTokenWidget');
    await settle();

    expect(host.manager.refreshModelSelections).not.toHaveBeenCalled();
    expect(host.manager.refreshConfiguration).not.toHaveBeenCalled();
  });

  it('stops listening once disposed', () => {
    const host = createRefresh();
    expect(host.listenerCount()).toBe(1);
    host.refresh.dispose();
    expect(host.listenerCount()).toBe(0);
  });
});
