/**
 * A model-settings host for tests (Lightbox Slice 4L), over the real parts
 * that meet when a writer picks a model:
 *
 * - one settings store, shared as VS Code's is;
 * - the real `AIResourceManager`, which builds every scope's engine (the
 *   composition root's one instance) and hot-swaps them;
 * - a real `ConfigurationHandler` per webview: the sidebar (its Settings
 *   overlay), the Lightbox tab and the Workshop tab;
 * - the config watcher as `MessageHandler.handleConfigurationChange` runs it
 *   for a model key: the hot-swap, then `MODEL_DATA` from every webview's
 *   handler except the one whose own write it was (echo prevention).
 *
 * The catalog is a stubbed fetch of placeholder ids (`stubModelCatalog`): no
 * provider is called.
 */
import { ConfigurationHandler } from '@/application/handlers/domain/ConfigurationHandler';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { OpenRouterModels, type OpenRouterModel } from '@providers/OpenRouterModels';
import {
  MessageType,
  type ExtensionToWebviewMessage,
  type ModelDataPayload,
  type SetModelSelectionPayload
} from '@messages';

export const MODEL_SETTINGS_SURFACES = ['sidebar', 'lightbox', 'workshop'] as const;
export type ModelSettingsSurface = typeof MODEL_SETTINGS_SURFACES[number];

/** Serve these placeholder models as the live catalog and the curated list; each label is its entry in `labels`, else its id. */
export function stubModelCatalog(ids: readonly string[], labels: Readonly<Record<string, string>> = {}): void {
  OpenRouterModels.clearCache();
  const catalog: OpenRouterModel[] = ids.map((id) => ({
    id, name: labels[id] ?? id, description: `${labels[id] ?? id} (stub)`, family: 'Placeholder',
    pricing: { prompt: '0.000001', completion: '0.000002' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- the catalog's wire field.
    context_length: 100_000
  }));
  jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(
    catalog.map(({ id, name, family, description }) => ({ id, name, family: family ?? 'Placeholder', description: description ?? '' })) as never
  );
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: catalog }) }));
}

/** Long enough for the handler's 50 ms read-back, the watcher's 50 ms broadcast delay and the hot-swap. */
export const settleModelSettings = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 150));

const built: AIResourceManager[] = [];

/** Dispose every host's manager (an `afterEach`), so no engine's cleanup timer outlives a failed test. */
export function disposeModelSettingsHosts(): void {
  built.splice(0).forEach((manager) => manager.dispose());
}

export interface ModelSettingsHostOptions {
  /** Where each webview's host messages go besides its inbox (a rendered root, say). */
  deliver?: (surface: ModelSettingsSurface, message: ExtensionToWebviewMessage) => void;
}

export async function createModelSettingsHosts(
  initial: Record<string, unknown>,
  options: ModelSettingsHostOptions = {}
) {
  const values: Record<string, unknown> = { ...initial };
  const writes: Array<[string, unknown]> = [];
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const inboxes: Record<ModelSettingsSurface, ExtensionToWebviewMessage[]> = { sidebar: [], lightbox: [], workshop: [] };
  const handlers = {} as Record<ModelSettingsSurface, ConfigurationHandler>;

  const settings = {
    get: (_section: string, key: string, fallback?: unknown) => (values[key] !== undefined ? values[key] : fallback),
    update: async (_section: string, key: string, value: unknown) => {
      writes.push([key, value]);
      if (value === undefined) {
        delete values[key];
      } else {
        values[key] = value;
      }
      // VS Code fires its change event after the write: every MessageHandler's watcher.
      setTimeout(() => void watch(`proseMinion.${key}`), 0);
    }
  };

  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn().mockResolvedValue('sk-placeholder') } as never,
    settings as never,
    { createProvider: jest.fn() } as never,
    log
  );
  built.push(manager);
  await manager.ensureInitialized();

  const watch = async (changedKey: string) => {
    await manager.refreshModelSelections();
    for (const surface of MODEL_SETTINGS_SURFACES) {
      if (handlers[surface].shouldBroadcastConfigChange(changedKey)) {
        setTimeout(() => void handlers[surface].sendModelData(), 50);
      }
    }
  };

  for (const surface of MODEL_SETTINGS_SURFACES) {
    handlers[surface] = new ConfigurationHandler(
      manager, {} as never, {} as never, {} as never,
      { getApiKey: async () => 'sk-placeholder' } as never,
      settings as never, {} as never,
      async (message: ExtensionToWebviewMessage) => {
        inboxes[surface].push(message);
        options.deliver?.(surface, message);
      },
      log
    );
  }

  const select = async (surface: ModelSettingsSurface, payload: SetModelSelectionPayload) => {
    await handlers[surface].handleSetModelSelection({
      type: MessageType.SET_MODEL_SELECTION, source: `webview.${surface}`, payload, timestamp: Date.now()
    });
    await settleModelSettings();
  };
  /** The Settings UI, or settings.json: a write no webview made. */
  const editSettingsExternally = async (key: string, value: unknown) => {
    await settings.update('proseMinion', key, value);
    await settleModelSettings();
  };
  const modelData = (surface: ModelSettingsSurface): ModelDataPayload[] =>
    inboxes[surface].filter((message) => message.type === MessageType.MODEL_DATA).map((message) => message.payload as ModelDataPayload);
  const latestModelData = (surface: ModelSettingsSurface): ModelDataPayload | undefined => modelData(surface).at(-1);
  const errors = (surface: ModelSettingsSurface) => inboxes[surface].filter((message) => message.type === MessageType.ERROR);

  return { values, writes, manager, handlers, inboxes, select, editSettingsExternally, modelData, latestModelData, errors };
}
