/**
 * AIResourceRefresh — keeps the shared `AIResourceManager` current for the
 * extension's whole lifetime (PR #171 F-01).
 *
 * The manager outlives every webview, and an editor command (Proofread) uses
 * it with no webview open. So its subscriptions belong here, built once at
 * the composition root, not in a webview's `MessageHandler`:
 * - **A key change** (set, cleared, replaced, from this window or another)
 *   rebuilds the manager. That retires every engine a run still holds, so a
 *   run in progress starts no call on the old key (PR #169 F-01).
 * - **A model setting change** hot-swaps the model in place. The swap is
 *   idempotent, so an open webview's own swap repeats it harmlessly.
 *
 * One rebuild per key. Every surface that hears a key change asks through
 * `refreshKey`: this owner, and each open webview's handler. The first to
 * read the new key rebuilds; the rest join that rebuild. A request that finds
 * the key unchanged since the rebuild it last started builds nothing, so a
 * run that began after the change is not retired by a second rebuild. The
 * key is compared by a fingerprint, never kept.
 */

import { createHash } from 'node:crypto';
import type { LogSink, PlatformDisposable, SettingsStore } from '@/platform';
import type { AIResourceManager } from './AIResourceManager';
import { MODEL_SCOPE_SETTING_KEYS } from './ModelScopeSelections';

/** The key source the manager reads: secret storage, with the legacy setting as a fallback. */
export interface AIResourceKeySource {
  getApiKey(): Promise<string | undefined>;
  onDidChange(listener: () => void): PlatformDisposable;
}

const SECTION = 'proseMinion';
const LEGACY_KEY_SETTING = 'openRouterApiKey';
const MODEL_SETTINGS: readonly string[] = Object.values(MODEL_SCOPE_SETTING_KEYS).map((key) => `${SECTION}.${key}`);

export class AIResourceRefresh {
  /** The fingerprint of the key the latest rebuild this owner started read; undefined before one, or after one failed. */
  private builtFor?: string;
  private latest: Promise<void> = Promise.resolve();
  private readonly subscription: PlatformDisposable;

  constructor(
    private readonly manager: AIResourceManager,
    private readonly keys: AIResourceKeySource,
    private readonly settings: SettingsStore,
    private readonly log: LogSink
  ) {
    this.subscription = keys.onDidChange(() => {
      void this.refreshKey().catch(() => undefined);
    });
  }

  /** Rebuild the manager for the key stored now, joining a rebuild already started for it. */
  async refreshKey(): Promise<void> {
    const fingerprint = await this.fingerprintOfStoredKey();
    if (fingerprint === this.builtFor) {
      return this.latest;
    }
    this.builtFor = fingerprint;
    const rebuild = this.manager.refreshConfiguration();
    this.latest = rebuild;
    try {
      await rebuild;
      this.log.appendLine('[AIResourceRefresh] API key changed; AI resources rebuilt');
    } catch (error) {
      if (this.latest === rebuild) {
        this.builtFor = undefined;
      }
      this.log.appendLine(`[AIResourceRefresh] Rebuild after an API key change failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /** React to a host configuration change, given its `affects(section)` predicate. */
  handleConfigurationChange(affects: (section: string) => boolean): void {
    if (affects(`${SECTION}.${LEGACY_KEY_SETTING}`)) {
      void this.refreshKey().catch(() => undefined);
    }
    if (MODEL_SETTINGS.some((key) => affects(key))) {
      void this.manager.refreshModelSelections().catch((error: unknown) => {
        this.log.appendLine(`[AIResourceRefresh] Model hot-swap failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }

  dispose(): void {
    this.subscription.dispose();
  }

  private async fingerprintOfStoredKey(): Promise<string> {
    const key = (await this.keys.getApiKey()) || this.settings.get<string>(SECTION, LEGACY_KEY_SETTING) || '';
    return createHash('sha256').update(key).digest('hex');
  }
}
