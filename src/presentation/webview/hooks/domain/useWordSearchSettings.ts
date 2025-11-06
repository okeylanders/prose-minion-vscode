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
  defaultTargets: string;           // Default search targets (e.g., 'just')
  contextWords: number;              // Context words around hits
  clusterWindow: number;             // Cluster detection window
  minClusterSize: number;            // Minimum cluster size
  caseSensitive: boolean;            // Case-sensitive matching
  enableAssistantExpansion: boolean; // AI-based synonym expansion
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

  const defaults: WordSearchSettings = {
    defaultTargets: 'just',          // Default search targets
    contextWords: 7,                 // Context words around hits (changed from 3 to match ADR)
    clusterWindow: 150,              // Cluster detection window (changed from 50 to match ADR)
    minClusterSize: 2,               // ✅ Correct default (not 3)
    caseSensitive: false,            // Case-sensitive matching
    enableAssistantExpansion: false, // AI-based synonym expansion
  };

  const [settings, setSettings] = React.useState<WordSearchSettings>({
    ...defaults,
    ...(persisted?.wordSearchSettings ?? {}),
  });

  // Handle SETTINGS_DATA messages and extract word search settings
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    const { settings: allSettings } = message.payload;

    // Extract word search settings from the flat settings object
    const wordSearch: Partial<WordSearchSettings> = {
      defaultTargets: allSettings['wordSearch.defaultTargets'] as string | undefined,
      contextWords: allSettings['wordSearch.contextWords'] as number | undefined,
      clusterWindow: allSettings['wordSearch.clusterWindow'] as number | undefined,
      minClusterSize: allSettings['wordSearch.minClusterSize'] as number | undefined,
      caseSensitive: allSettings['wordSearch.caseSensitive'] as boolean | undefined,
      enableAssistantExpansion: allSettings['wordSearch.enableAssistantExpansion'] as boolean | undefined,
    };

    // Only update if we got valid data
    if (wordSearch.contextWords !== undefined || wordSearch.defaultTargets !== undefined) {
      setSettings((prev) => ({
        ...prev,
        defaultTargets: wordSearch.defaultTargets ?? prev.defaultTargets,
        contextWords: wordSearch.contextWords ?? prev.contextWords,
        clusterWindow: wordSearch.clusterWindow ?? prev.clusterWindow,
        minClusterSize: wordSearch.minClusterSize ?? prev.minClusterSize,
        caseSensitive: wordSearch.caseSensitive ?? prev.caseSensitive,
        enableAssistantExpansion: wordSearch.enableAssistantExpansion ?? prev.enableAssistantExpansion,
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
