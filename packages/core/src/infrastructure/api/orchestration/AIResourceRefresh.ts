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
 * Every surface that hears a key change asks through `refreshKey`: this
 * owner, each open webview's handler, and the Settings overlay's Save and
 * Clear. The requests are ordered when they are made, before anything is
 * awaited, and only the newest one's reading of the key counts:
 * - An older request whose read comes back later is obsolete. It joins the
 *   newest request and builds nothing, so it can neither retire a run that
 *   started on a newer key nor leave a stale identity behind (the re-review).
 * - The newest compares its reading with the key the manager actually
 *   adopted (`adoptedKeyFingerprint`). It rebuilds only when they differ, and
 *   then hands the manager exactly the key it read, so the adopted identity
 *   is the one it compared. One key change is one rebuild.
 * - A request still reading when the owner is disposed builds nothing.
 *
 * Keys are compared by fingerprint, never kept.
 */

import type { LogSink, PlatformDisposable, SettingsStore } from '@/platform';
import type { AIResourceManager } from './AIResourceManager';
import { apiKeyFingerprint } from './apiKeyFingerprint';
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
  /** Requests made so far; the newest is the only one whose reading of the key counts. */
  private requests = 0;
  /** The newest request, which an obsolete one joins. */
  private newest: Promise<void> = Promise.resolve();
  private disposed = false;
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

  /** Bring the manager to the key stored now; resolves once it is built with it, or already was. */
  refreshKey(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    // Ordered here, before the first await, so a read that answers late cannot pass a newer one.
    const request = ++this.requests;
    const run = this.observe(request);
    this.newest = run;
    return run;
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
    this.disposed = true;
    this.subscription.dispose();
  }

  private async observe(request: number): Promise<void> {
    const apiKey = await this.storedKey();
    if (this.disposed) {
      return;
    }
    if (request !== this.requests) {
      // A newer request was made while this one read: its reading decides.
      return this.newest;
    }
    if (apiKeyFingerprint(apiKey) === this.manager.adoptedKeyFingerprint()) {
      return;
    }
    try {
      await this.manager.refreshConfiguration({ apiKey });
      this.log.appendLine('[AIResourceRefresh] API key changed; AI resources rebuilt');
    } catch (error) {
      this.log.appendLine(`[AIResourceRefresh] Rebuild after an API key change failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /** The key the manager would read: secret storage, then the legacy setting. */
  private async storedKey(): Promise<string | undefined> {
    return (await this.keys.getApiKey()) || this.settings.get<string>(SECTION, LEGACY_KEY_SETTING) || undefined;
  }
}
