import React from 'react';
import { MessageType } from '@shared/types';
import { SettingsDataMessage, ModelDataMessage } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';

/**
 * Tokens Settings
 * UI preference for showing/hiding the token usage widget
 * Syncs with package.json proseMinion.ui.showTokenWidget setting
 */
export interface TokensSettings {
  showTokenWidget: boolean;  // Show token usage widget (default: true)
}

export interface TokensSettingsState {
  settings: TokensSettings;
}

export interface TokensSettingsActions {
  updateSetting: (key: keyof TokensSettings, value: any) => void;
  handleSettingsData: (message: SettingsDataMessage) => void;
  handleModelData: (message: ModelDataMessage) => void;
}

export interface TokensSettingsPersistence {
  tokensSettings: TokensSettings;
}

export type UseTokensSettingsReturn =
  TokensSettingsState &
  TokensSettingsActions &
  { persistedState: TokensSettingsPersistence };

/**
 * Tokens Settings Hook
 *
 * Manages UI preferences for token tracking display using the Domain Hooks pattern.
 * Provides bidirectional sync with VSCode settings and webview persistence.
 *
 * Backend support: ConfigurationHandler.getAllSettings() (Sprint 02)
 * Config watcher: General settings watcher in MessageHandler
 *
 * Note: This manages the UI preference (show/hide widget). Token usage tracking
 * itself is managed by useTokenTracking hook (ephemeral state).
 *
 * @example
 * ```tsx
 * const tokensSettings = useTokensSettings();
 *
 * // Wire up message handlers (both are needed for full sync)
 * useMessageRouter({
 *   [MessageType.SETTINGS_DATA]: tokensSettings.handleSettingsData,
 *   [MessageType.MODEL_DATA]: tokensSettings.handleModelData,
 * });
 *
 * // Conditionally render token widget based on settings
 * {tokensSettings.settings.showTokenWidget && (
 *   <TokenUsageWidget />
 * )}
 *
 * // Toggle widget visibility (updates both local state and backend)
 * const handleToggle = () => {
 *   tokensSettings.updateSetting('showTokenWidget', !tokensSettings.settings.showTokenWidget);
 * };
 *
 * // Add to persistence (compose into App.tsx usePersistence)
 * usePersistence({
 *   // ... other domains
 *   ...tokensSettings.persistedState,
 * });
 * ```
 *
 * @returns Settings state, actions, and persisted state
 */
export const useTokensSettings = (): UseTokensSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    // Support both legacy and standardized persisted keys
    showTokenWidget?: boolean;          // Legacy key (from useSettings)
    tokensSettings?: TokensSettings;    // Standardized key
  }>();

  const defaults: TokensSettings = {
    showTokenWidget: true,  // Default: visible
  };

  // Seed from persisted state (prefer standardized key, fallback to legacy)
  const persistedSeed = persisted?.tokensSettings ??
    (typeof persisted?.showTokenWidget === 'boolean' ? { showTokenWidget: persisted.showTokenWidget } : undefined);

  const [settings, setSettings] = React.useState<TokensSettings>({
    ...defaults,
    ...(persistedSeed ?? {}),
  });

  // Handle SETTINGS_DATA messages
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const { settings: settingsData } = message.payload;

      // Extract ui.showTokenWidget setting
      const showTokenWidget = settingsData['ui.showTokenWidget'] as boolean | undefined;

      if (showTokenWidget !== undefined) {
        setSettings(prev => ({
          ...prev,
          showTokenWidget,
        }));
      }
    }
  }, []);

  // Handle MODEL_DATA messages (legacy path - showTokenWidget comes in ui.showTokenWidget)
  const handleModelData = React.useCallback((message: ModelDataMessage) => {
    if (message.type === MessageType.MODEL_DATA) {
      const { ui } = message.payload;

      if (ui && typeof ui.showTokenWidget === 'boolean') {
        const showTokenWidget = ui.showTokenWidget;  // Extract to preserve type narrowing
        setSettings(prev => ({
          ...prev,
          showTokenWidget,
        }));
      }
    }
  }, []);

  // Update a specific setting (send to backend with optimistic update)
  const updateSetting = React.useCallback((key: keyof TokensSettings, value: any) => {
    // Optimistically update local state immediately for responsive UI
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Send to backend
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useTokensSettings',
      payload: {
        key: `ui.${key}`,  // Prefix with 'ui.' for nested key
        value
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  return {
    settings,
    updateSetting,
    handleSettingsData,
    handleModelData,
    persistedState: { tokensSettings: settings }
  };
};
