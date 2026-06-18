/**
 * AccountBalanceService - orchestrates the OpenRouter account-balance fetch AND
 * owns the post-AI-request refresh debounce + broadcast fan-out.
 *
 * Adapted from Frame Minion's ADR-010 service, trimmed to PM's single provider
 * (OpenRouter) and single webview. Responsibilities:
 * - Fan `/key` and `/credits` out independently so a `/credits` 403 still
 *   yields key-limit data (`Promise.all` over per-call results, each isolated).
 * - Cache the SANITIZED payload with a short TTL to avoid hammering billing
 *   endpoints on every render / refresh.
 * - Coalesce concurrent fetches through a single shared pending promise; a
 *   forced request arriving on top of a non-forced in-flight fetch waits for it
 *   then starts a new forced fetch so the caller never gets pre-spend data.
 * - Rate-limit forced refreshes (`MIN_FORCED_INTERVAL_MS`) so a chatty webview
 *   can't fan out to billing endpoints.
 * - Own a SINGLE debounce timer + listener set: every completed AI request
 *   calls `scheduleRefresh()`; one fetch fires, one notification fans out.
 */

import {
  AccountBalancePayload,
  OpenRouterBalance,
  ProviderStatus
} from '@messages';
import { LogSink } from '@/platform';
import { OpenRouterAccountClient } from './OpenRouterAccountClient';
import { AccountCallResult } from './accountTypes';

const CACHE_TTL_MS = 120_000;
/** Floor between back-to-back forced refreshes. */
const MIN_FORCED_INTERVAL_MS = 1_000;
/**
 * Trailing debounce after a terminal AI response before the auto-refresh fetch
 * fires. OpenRouter's billing backend is eventually consistent — empirically
 * ~5-10s of lag between a successful generation and the spend being reflected.
 * A short debounce produced "balance didn't update after generation" reports
 * because the fetch raced OR's billing settle, returned pre-spend data, and
 * cached it for the full TTL. The widget is passive background info, so latency
 * here is cheaper than a stale number.
 */
const REFRESH_DEBOUNCE_MS = 10_000;

export type AccountBalanceRefreshListener = (payload: AccountBalancePayload) => void;

export class AccountBalanceService {
  private cache?: AccountBalancePayload;
  private pending?: Promise<AccountBalancePayload>;
  private pendingForced = false;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private readonly listeners = new Set<AccountBalanceRefreshListener>();

  constructor(
    private readonly openRouter: OpenRouterAccountClient,
    private readonly log?: LogSink
  ) {}

  /**
   * Resolve current balances. Cached values are served when fresh and not
   * forced. Forced refreshes within `MIN_FORCED_INTERVAL_MS` of the cache also
   * return the cache. Concurrent fetches share one in-flight promise; a forced
   * request arriving on top of a non-forced in-flight fetch waits for it then
   * starts a new forced fetch.
   */
  async getBalances(forceRefresh = false): Promise<AccountBalancePayload> {
    if (this.cache) {
      const age = Date.now() - this.cache.fetchedAt;
      if (!forceRefresh && age < CACHE_TTL_MS) {
        return this.cache;
      }
      if (forceRefresh && age < MIN_FORCED_INTERVAL_MS) {
        return this.cache;
      }
    }
    if (this.pending) {
      if (forceRefresh && !this.pendingForced) {
        await this.pending.catch(() => undefined);
        return this.startFetch(true);
      }
      return this.pending;
    }
    return this.startFetch(forceRefresh);
  }

  private startFetch(forced: boolean): Promise<AccountBalancePayload> {
    this.pendingForced = forced;
    this.pending = this.fetchAll()
      .then((payload) => {
        this.cache = payload;
        return payload;
      })
      .finally(() => {
        this.pending = undefined;
        this.pendingForced = false;
      });
    return this.pending;
  }

  /**
   * Arm the trailing debounce. When it fires, run a forced refresh and notify
   * every registered listener with the fresh payload. Multiple calls within the
   * debounce window coalesce to one fetch + one notification.
   */
  scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.runRefresh();
    }, REFRESH_DEBOUNCE_MS);
  }

  /**
   * Subscribe to debounced post-AI-request refreshes. Returns a dispose
   * function. A thrown listener is logged but does not block other listeners.
   */
  addRefreshListener(listener: AccountBalanceRefreshListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Cancel any armed refresh + drop listeners (call from handler dispose). */
  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.listeners.clear();
  }

  private async runRefresh(): Promise<void> {
    let payload: AccountBalancePayload;
    try {
      payload = await this.getBalances(true);
    } catch (error) {
      this.log?.appendLine(`[AccountBalanceService] Scheduled refresh failed: ${errMessage(error)}`);
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (error) {
        this.log?.appendLine(`[AccountBalanceService] Refresh listener threw: ${errMessage(error)}`);
      }
    }
  }

  private async fetchAll(): Promise<AccountBalancePayload> {
    const openrouter = await this.resolveOpenRouter();
    return { openrouter, fetchedAt: Date.now() };
  }

  private async resolveOpenRouter(): Promise<OpenRouterBalance> {
    const [keyResult, creditsResult] = await Promise.all([
      this.settle(() => this.openRouter.fetchKeyLimit()),
      this.settle(() => this.openRouter.fetchCredits())
    ]);

    const creditsStatus: ProviderStatus = creditsResult.ok ? 'ok' : creditsResult.status;

    // Both calls report no_key only when the key is genuinely absent.
    if (
      !keyResult.ok && keyResult.status === 'no_key' &&
      !creditsResult.ok && creditsResult.status === 'no_key'
    ) {
      return { status: 'no_key', creditsStatus: 'no_key' };
    }

    const overall: ProviderStatus = keyResult.ok || creditsResult.ok ? 'ok' : 'unavailable';
    return {
      status: overall,
      keyLimit: keyResult.ok ? keyResult.data : undefined,
      credits: creditsResult.ok ? creditsResult.data : undefined,
      creditsStatus,
      reason: overall === 'unavailable'
        ? (!keyResult.ok ? keyResult.reason : undefined)
        : undefined
    };
  }

  /**
   * Run a client call, converting an unexpected throw (clients already catch,
   * but defense-in-depth) into an `unavailable` result so per-call isolation
   * holds even if a client regresses.
   */
  private async settle<T, S extends string>(
    call: () => Promise<AccountCallResult<T, S>>
  ): Promise<AccountCallResult<T, S | 'unavailable'>> {
    try {
      return await call();
    } catch (error) {
      this.log?.appendLine(`[AccountBalanceService] Account call threw: ${errMessage(error)}`);
      return { ok: false, status: 'unavailable' as const, reason: 'Request failed.' };
    }
  }
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
