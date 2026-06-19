/**
 * useAccountBalance - sidebar OpenRouter account-balance state.
 *
 * Single-provider adaptation of Frame Minion's `useProviderBalances` (ADR-010).
 * Balances are fetched by the extension host (keys never reach the webview);
 * this hook only requests them and holds the sanitized response. It refreshes:
 * - on mount,
 * - when the API key transitions to configured (so a freshly-saved key shows a
 *   balance without a manual refresh),
 * - on demand via `refresh()` (the widget's refresh button).
 *
 * The host also pushes fresh balances after every AI request completes (debounced
 * for OpenRouter's eventually-consistent billing); those arrive through the same
 * `handleAccountBalanceData` handler.
 */
import * as React from 'react';
import {
  MessageType,
  OpenRouterBalance,
  AccountBalanceDataMessage,
  AccountBalancePayload
} from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

export interface AccountBalanceState {
  openrouter: OpenRouterBalance | null;
  fetchedAt: number | null;
  isLoading: boolean;
}

export interface AccountBalanceActions {
  /** Force a fresh fetch (bypasses the host TTL cache). */
  refresh: () => void;
  handleAccountBalanceData: (message: AccountBalanceDataMessage) => void;
}

/**
 * Intentionally empty: balances are ephemeral — re-fetched on mount and pushed
 * by the host after each request — so persisting a credit number across reloads
 * would only show a stale value. The empty `persistedState` keeps the tripartite
 * hook shape (State & Actions & { persistedState }) every sibling hook honors,
 * so App's usePersistence spread stays uniform and the next hook author has a
 * compliant reference.
 */
export type AccountBalancePersistence = Record<string, never>;

export type UseAccountBalanceReturn = AccountBalanceState & AccountBalanceActions & {
  persistedState: AccountBalancePersistence;
};

export interface UseAccountBalanceArgs {
  apiKeyConfigured: boolean;
}

export function useAccountBalance({ apiKeyConfigured }: UseAccountBalanceArgs): UseAccountBalanceReturn {
  const vscode = useVSCodeApi();

  const [openrouter, setOpenrouter] = React.useState<OpenRouterBalance | null>(null);
  const [fetchedAt, setFetchedAt] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const request = React.useCallback((forceRefresh: boolean) => {
    setIsLoading(true);
    vscode.postMessage({
      type: MessageType.REQUEST_ACCOUNT_BALANCE,
      source: 'webview.account',
      payload: { forceRefresh },
      timestamp: Date.now()
    });
  }, [vscode]);

  const refresh = React.useCallback(() => request(true), [request]);

  const handleAccountBalanceData = React.useCallback((message: AccountBalanceDataMessage) => {
    const payload = message.payload as AccountBalancePayload;
    setOpenrouter(payload.openrouter);
    setFetchedAt(payload.fetchedAt);
    setIsLoading(false);
  }, []);

  // Initial fetch (cache-friendly: the host may serve a cached value).
  React.useEffect(() => {
    request(false);
  }, [request]);

  // Re-fetch (forced) when the key transitions to configured. The `prev` ref
  // avoids firing on the initial false→false render and on unrelated re-renders.
  const prevApiKey = React.useRef(apiKeyConfigured);
  React.useEffect(() => {
    const becameConfigured = !prevApiKey.current && apiKeyConfigured;
    prevApiKey.current = apiKeyConfigured;
    if (becameConfigured) {
      request(true);
    }
  }, [apiKeyConfigured, request]);

  return {
    openrouter,
    fetchedAt,
    isLoading,
    refresh,
    handleAccountBalanceData,
    persistedState: {}
  };
}
