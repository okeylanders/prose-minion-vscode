/**
 * AIResourceRefresh (PR #171 F-01): the shared manager's extension-lifetime
 * key and model subscriptions. A key change rebuilds the manager once,
 * however many surfaces ask; a model change hot-swaps in place. The manager
 * here is a stand-in; keys are placeholders.
 */
import { AIResourceRefresh } from '@orchestration/AIResourceRefresh';
import { MODEL_SCOPE_SETTING_KEYS } from '@orchestration/ModelScopeSelections';

function createRefresh(options: { key?: string; legacyKey?: string; rebuild?: () => Promise<void> } = {}) {
  let key = options.key;
  const listeners = new Set<() => void>();
  const keys = {
    getApiKey: jest.fn(async () => key),
    onDidChange: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    })
  };
  const manager = {
    refreshConfiguration: jest.fn(options.rebuild ?? (async () => undefined)),
    refreshModelSelections: jest.fn(async () => undefined)
  };
  const settings = { get: jest.fn((_section: string, name: string) => (name === 'openRouterApiKey' ? options.legacyKey : undefined)) };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const refresh = new AIResourceRefresh(manager as never, keys, settings as never, log);
  return {
    refresh, manager, keys, log,
    setKey: (next: string | undefined) => { key = next; },
    fireKeyChange: () => [...listeners].forEach((listener) => listener()),
    listenerCount: () => listeners.size
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('AIResourceRefresh', () => {
  it('rebuilds the manager when the stored key changes, with no webview involved', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    host.setKey('sk-placeholder-next');
    host.fireKeyChange();
    await settle();

    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);
  });

  it('rebuilds once for one key change, however many surfaces ask at once', async () => {
    let finish: () => void = () => undefined;
    const host = createRefresh({ key: 'sk-placeholder-next', rebuild: () => new Promise<void>((resolve) => { finish = resolve; }) });
    host.fireKeyChange();
    const surfaces = [host.refresh.refreshKey(), host.refresh.refreshKey(), host.refresh.refreshKey()];
    await settle();
    finish();
    await Promise.all(surfaces);

    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);
  });

  it('builds nothing for a request that finds the key unchanged since its last rebuild, and rebuilds for the next key', async () => {
    const host = createRefresh({ key: 'sk-placeholder-first' });
    await host.refresh.refreshKey();
    await host.refresh.refreshKey();
    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);

    host.setKey(undefined);
    await host.refresh.refreshKey();
    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(2);
  });

  it('reads the legacy key setting when nothing is stored, as the manager does', async () => {
    const host = createRefresh({ legacyKey: 'sk-placeholder-legacy' });
    await host.refresh.refreshKey();
    host.refresh.handleConfigurationChange((section) => section === 'proseMinion.openRouterApiKey');
    await settle();

    expect(host.manager.refreshConfiguration).toHaveBeenCalledTimes(1);
  });

  it('tries again after a rebuild that failed', async () => {
    const rebuild = jest.fn()
      .mockRejectedValueOnce(new Error('synthetic build failure'))
      .mockResolvedValue(undefined);
    const host = createRefresh({ key: 'sk-placeholder-first', rebuild });
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
