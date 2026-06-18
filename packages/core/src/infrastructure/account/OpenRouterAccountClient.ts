/**
 * OpenRouterAccountClient - reads OpenRouter account health (NOT generation).
 *
 * Two independent calls:
 * - GET /api/v1/key     → key-limit info (limit / limit_remaining / limit_reset)
 * - GET /api/v1/credits → account balance (total_credits / total_usage)
 *
 * They are independent because a non-management key can read its own limit
 * (`/key`) while `/credits` returns 403. Each method returns a discriminated
 * result so the service can keep one call's data when the other fails.
 *
 * No raw response bodies or keys ever escape this layer — `reason` is a short
 * sanitized message. Every fetch carries an `AbortSignal.timeout` so a hung
 * billing endpoint cannot pin the shared service's in-flight promise.
 *
 * Mirrors Frame Minion's account client (ADR-010), trimmed to PM's
 * OpenRouter-only surface and PM's `LogSink` (PM has no `LoggingService` yet).
 */

import { OpenRouterKeyLimit, OpenRouterCredits } from '@messages';
import { LogSink } from '@/platform';
import { AccountCallResult } from './accountTypes';

const FETCH_TIMEOUT_MS = 8_000;
const BASE_URL = 'https://openrouter.ai/api/v1';

/** OpenRouter branding headers — same idiom as OpenRouterClient. */
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://github.com/okeylanders/prose-minion-vscode',
  'X-Title': 'Prose Minion VS Code Extension'
};

/** Minimal secret accessor — structurally satisfied by SecretStorageService. */
export interface ApiKeyProvider {
  getApiKey(): Promise<string | undefined>;
}

export class OpenRouterAccountClient {
  constructor(
    private readonly secrets: ApiKeyProvider,
    private readonly log?: LogSink
  ) {}

  async fetchKeyLimit(): Promise<AccountCallResult<OpenRouterKeyLimit>> {
    const apiKey = await this.secrets.getApiKey();
    if (!apiKey) {
      return { ok: false, status: 'no_key', reason: 'OpenRouter API key not configured.' };
    }

    try {
      const response = await fetch(`${BASE_URL}/key`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, ...OPENROUTER_HEADERS },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (!response.ok) {
        this.logHttpFailure('OpenRouter /key', response.status);
        return { ok: false, status: 'unavailable', reason: `Key info unavailable (${response.status}).` };
      }

      const body = (await response.json()) as { data?: Record<string, unknown> };
      const data = body?.data ?? {};
      return {
        ok: true,
        data: {
          limit: toNumberOrNull(data.limit),
          limitRemaining: toNumberOrNull(data.limit_remaining),
          resetWindow: toResetWindow(data.limit_reset)
        }
      };
    } catch (error) {
      this.log?.appendLine(`[OpenRouterAccountClient] /key fetch failed: ${errMessage(error)}`);
      return { ok: false, status: 'unavailable', reason: 'Key info request failed.' };
    }
  }

  async fetchCredits(): Promise<AccountCallResult<OpenRouterCredits>> {
    const apiKey = await this.secrets.getApiKey();
    if (!apiKey) {
      return { ok: false, status: 'no_key', reason: 'OpenRouter API key not configured.' };
    }

    try {
      const response = await fetch(`${BASE_URL}/credits`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, ...OPENROUTER_HEADERS },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (!response.ok) {
        this.logHttpFailure('OpenRouter /credits', response.status);
        return { ok: false, status: 'unavailable', reason: `Account balance unavailable (${response.status}).` };
      }

      const body = (await response.json()) as { data?: Record<string, unknown> };
      const data = body?.data ?? {};

      // total_credits is the source of truth; if it's missing/malformed the
      // response is unusable — silent-zero would render as a misleading negative.
      if (!isFiniteNumber(data.total_credits)) {
        this.log?.appendLine('[OpenRouterAccountClient] /credits response missing total_credits');
        return { ok: false, status: 'unavailable', reason: 'Malformed credits response.' };
      }
      const totalCredits = data.total_credits as number;
      const totalUsage = isFiniteNumber(data.total_usage) ? (data.total_usage as number) : 0;
      return {
        ok: true,
        data: { totalCredits, totalUsage, remaining: totalCredits - totalUsage }
      };
    } catch (error) {
      this.log?.appendLine(`[OpenRouterAccountClient] /credits fetch failed: ${errMessage(error)}`);
      return { ok: false, status: 'unavailable', reason: 'Account balance request failed.' };
    }
  }

  /**
   * 4xx (auth / scope mismatches like /credits 403) is the normal case for some
   * key types. 5xx means the provider is down. Both are logged at the same level
   * here (PM's LogSink has no levels yet) but tagged so they're distinguishable.
   */
  private logHttpFailure(label: string, status: number): void {
    const severity = status >= 500 ? 'WARN' : 'DEBUG';
    this.log?.appendLine(`[OpenRouterAccountClient] ${severity} ${label} returned ${status}`);
  }
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNumberOrNull(value: unknown): number | null {
  return isFiniteNumber(value) ? (value as number) : null;
}

function toResetWindow(value: unknown): OpenRouterKeyLimit['resetWindow'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw.includes('day')) return 'daily';
  if (raw.includes('week')) return 'weekly';
  if (raw.includes('month')) return 'monthly';
  return 'unknown';
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
