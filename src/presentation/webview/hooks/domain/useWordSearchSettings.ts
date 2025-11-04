/**
 * useWordSearchSettings - Domain hook for word search settings management
 *
 * Manages word search configuration (context words, cluster window, min cluster size, case sensitivity).
 * Integrates with the unified settings architecture via SETTINGS_DATA messages.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType } from '../../../../shared/types';
import { SettingsDataMessage } from '../../../../shared/types/messages';

export interface WordSearchSettings {
  contextWords: number;
  clusterWindow: number;
  minClusterSize: number;
  caseSensitive: boolean;
}

export interface WordSearchSettingsState {
  settings: WordSearchSettings;
}

export interface WordSearchSettingsActions {
  handleSettingsData: (message: SettingsDataMessage) => void;
  updateSetting: (key: keyof WordSearchSettings, value: any) => void;
}

export interface WordSearchSettingsPersistence {
  wordSearchSettings: WordSearchSettings;
}

export type UseWordSearchSettingsReturn = WordSearchSettingsState &
  WordSearchSettingsActions &
  { persistedState: WordSearchSettingsPersistence };

/**
 * Custom hook for managing word search settings
 *
 * @example
 * ```tsx
 * const wordSearchSettings = useWordSearchSettings();
 *
 * // Handle settings messages
 * useMessageRouter({
 *   [MessageType.SETTINGS_DATA]: wordSearchSettings.handleSettingsData,
 * });
 *
 * // Use in SearchTab
 * <SearchTab
 *   wordSearchSettings={{
 *     settings: wordSearchSettings.settings,
 *     updateSetting: wordSearchSettings.updateSetting,
 *   }}
 * />
 * ```
 */
export const useWordSearchSettings = (): UseWordSearchSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ wordSearchSettings?: WordSearchSettings }>();

  const [settings, setSettings] = React.useState<WordSearchSettings>(
    persisted?.wordSearchSettings ?? {
      contextWords: 3,
      clusterWindow: 50,
      minClusterSize: 2,  // ✅ Correct default (not 3)
      caseSensitive: false
    }
  );

  // Handle SETTINGS_DATA messages and extract word search settings
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    const { settings: allSettings } = message.payload;

    // Extract word search settings from the flat settings object
    const wordSearch: Partial<WordSearchSettings> = {
      contextWords: allSettings['wordSearch.contextWords'] as number | undefined,
      clusterWindow: allSettings['wordSearch.clusterWindow'] as number | undefined,
      minClusterSize: allSettings['wordSearch.minClusterSize'] as number | undefined,
      caseSensitive: allSettings['wordSearch.caseSensitive'] as boolean | undefined,
    };

    // Only update if we got valid data
    if (wordSearch.contextWords !== undefined) {
      setSettings((prev) => ({
        ...prev,
        contextWords: wordSearch.contextWords ?? prev.contextWords,
        clusterWindow: wordSearch.clusterWindow ?? prev.clusterWindow,
        minClusterSize: wordSearch.minClusterSize ?? prev.minClusterSize,
        caseSensitive: wordSearch.caseSensitive ?? prev.caseSensitive,
      }));
    }
  }, []);

  // Update a specific setting (send to backend)
  const updateSetting = React.useCallback(
    (key: keyof WordSearchSettings, value: any) => {
      // Optimistically update local state
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));

      // Send to backend
      vscode.postMessage({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.search.settings',
        payload: {
          key: `wordSearch.${key}`,
          value
        },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  return {
    // State
    settings,

    // Actions
    handleSettingsData,
    updateSetting,

    // Persistence
    persistedState: {
      wordSearchSettings: settings,
    },
  };
};
