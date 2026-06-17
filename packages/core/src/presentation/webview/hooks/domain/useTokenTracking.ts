import React from 'react';
import { MessageType, TokenUsage } from '@shared/types';
import { TokenUsageUpdateMessage } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';

/**
 * Token Tracking State Hook
 *
 * Manages ephemeral token usage tracking state (not a settings hook).
 * Tracks prompt/completion/total tokens and provides reset functionality.
 * Persists across sessions for continuity but does NOT sync with VSCode config.
 */

export interface TokenTrackingState {
  usage: TokenUsage;
}

export interface TokenTrackingActions {
  handleTokenUsageUpdate: (message: TokenUsageUpdateMessage) => void;
  resetTokens: () => void;
}

export interface TokenTrackingPersistence {
  tokenTracking: TokenUsage;
}

export type UseTokenTrackingReturn =
  TokenTrackingState &
  TokenTrackingActions &
  { persistedState: TokenTrackingPersistence };

/**
 * Token Tracking Hook
 *
 * Manages token usage tracking state using the Domain Hooks pattern.
 * This is a STATE hook (not a settings hook) - manages ephemeral runtime state
 * that persists across sessions but does NOT sync with VSCode configuration.
 *
 * @example
 * ```tsx
 * // In App.tsx: Initialize the hook
 * const tokenTracking = useTokenTracking();
 *
 * // Wire up message handler for token usage updates
 * useMessageRouter({
 *   [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,
 * });
 *
 * // Compose into persistence
 * usePersistence({
 *   activeTab,
 *   ...tokenTracking.persistedState,
 *   // ... other persisted state
 * });
 *
 * // In components: Display and manage token usage
 * <div className="token-widget">
 *   <span>Prompt: {tokenTracking.usage.promptTokens}</span>
 *   <span>Completion: {tokenTracking.usage.completionTokens}</span>
 *   <span>Total: {tokenTracking.usage.totalTokens}</span>
 *   <button onClick={tokenTracking.resetTokens}>Reset Tokens</button>
 * </div>
 * ```
 *
 * @returns Token usage state, actions, and persisted state
 */
export const useTokenTracking = (): UseTokenTrackingReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    // Support both legacy and standardized persisted keys
    tokenTotals?: TokenUsage;      // Legacy key (from useSettings)
    tokenTracking?: TokenUsage;    // Standardized key
  }>();

  const defaults: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // Seed from persisted state (prefer standardized key, fallback to legacy)
  const persistedSeed = persisted?.tokenTracking ?? persisted?.tokenTotals;

  const [usage, setUsage] = React.useState<TokenUsage>({
    ...defaults,
    ...(persistedSeed ?? {}),
  });

  // Handle TOKEN_USAGE_UPDATE messages
  const handleTokenUsageUpdate = React.useCallback((message: TokenUsageUpdateMessage) => {
    if (message.type === MessageType.TOKEN_USAGE_UPDATE) {
      const { totals } = message.payload;
      setUsage(totals);
    }
  }, []);

  // Reset token usage to zero
  const resetTokens = React.useCallback(() => {
    setUsage(defaults);
    vscode.postMessage({
      type: MessageType.RESET_TOKEN_USAGE,
      source: 'webview.hooks.useTokenTracking',
      payload: {},
      timestamp: Date.now(),
    });
  }, [vscode]);

  return {
    usage,
    handleTokenUsageUpdate,
    resetTokens,
    persistedState: { tokenTracking: usage }
  };
};
