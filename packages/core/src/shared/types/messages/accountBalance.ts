/**
 * OpenRouter account-balance message payloads.
 *
 * PM is OpenRouter-only, so this is a single-provider adaptation of Frame
 * Minion's ADR-010 balance slice. All shapes here are SANITIZED — they carry
 * only numbers, strings, and status enums. API keys and raw upstream response
 * bodies never appear in these payloads (they never leave the extension host).
 */

import { MessageEnvelope, MessageType } from './base';

/**
 * Availability of OpenRouter balance data.
 * - `ok`          — data fetched successfully.
 * - `no_key`      — no key configured in SecretStorage.
 * - `unavailable` — network/scope/other error; `reason` carries a short message
 *                   (a non-management key's `/credits` 403 lands here too).
 */
export type ProviderStatus = 'ok' | 'no_key' | 'unavailable';

/** OpenRouter `/api/v1/key` key-limit info. */
export interface OpenRouterKeyLimit {
  /** Enforced spend limit, or `null` when the key has no limit. */
  limit: number | null;
  /** Remaining headroom against `limit`, or `null` when unlimited. */
  limitRemaining: number | null;
  /** Reset window derived from `limit_reset`. */
  resetWindow: 'daily' | 'weekly' | 'monthly' | 'unknown';
}

/** OpenRouter `/api/v1/credits` account balance. */
export interface OpenRouterCredits {
  totalCredits: number;
  totalUsage: number;
  /** Computed host-side: `totalCredits - totalUsage`. */
  remaining: number;
}

export interface OpenRouterBalance {
  /** Overall status — `ok` if either the key-limit or credits call succeeded. */
  status: ProviderStatus;
  /** Present iff the `/key` call succeeded. */
  keyLimit?: OpenRouterKeyLimit;
  /** Present iff the `/credits` call succeeded. */
  credits?: OpenRouterCredits;
  /**
   * Independent status for the account-balance (`/credits`) call, so the card
   * can show the key limit while marking account balance unavailable (e.g. a
   * non-management key gets the limit but a 403 on credits).
   */
  creditsStatus: ProviderStatus;
  /** Short sanitized message when `status`/`creditsStatus` is `unavailable`. */
  reason?: string;
}

export interface AccountBalancePayload {
  openrouter: OpenRouterBalance;
  /** Epoch ms when these balances were fetched (for "as of" / staleness). */
  fetchedAt: number;
}

export interface RequestAccountBalancePayload {
  /** Bypass the host-side TTL cache (manual refresh, post-AI-request refresh). */
  forceRefresh?: boolean;
}

export interface RequestAccountBalanceMessage
  extends MessageEnvelope<RequestAccountBalancePayload> {
  type: MessageType.REQUEST_ACCOUNT_BALANCE;
}

export interface AccountBalanceDataMessage extends MessageEnvelope<AccountBalancePayload> {
  type: MessageType.ACCOUNT_BALANCE_DATA;
}
