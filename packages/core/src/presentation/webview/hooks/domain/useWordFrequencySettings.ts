import React from 'react';
import { MessageType } from '@shared/types';
import { SettingsDataMessage } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';

/**
 * Word Frequency Settings
 * All 11 settings for word frequency analysis configuration
 * Syncs with package.json proseMinion.wordFrequency.* settings
 */
export interface WordFrequencySettings {
  topN: number;                       // Top N words to display (default: 100)
  includeHapaxList: boolean;          // Include hapax (frequency=1) list (default: true)
  hapaxDisplayMax: number;            // Max hapax words to display (default: 300)
  includeStopwordsTable: boolean;     // Include stopwords table (default: true)
  contentWordsOnly: boolean;          // Filter to content words only (default: true)
  posEnabled: boolean;                // Enable POS tagging sections (default: true)
  includeBigrams: boolean;            // Include bigrams analysis (default: true)
  includeTrigrams: boolean;           // Include trigrams analysis (default: true)
  enableLemmas: boolean;              // Enable lemmatization view (default: false)
  lengthHistogramMaxChars: number;    // Max word length in histogram (default: 10)
  minCharacterLength: number;         // Minimum word length filter (default: 1)
}

export interface WordFrequencySettingsState {
  settings: WordFrequencySettings;
}

export interface WordFrequencySettingsActions {
  updateSetting: (key: keyof WordFrequencySettings, value: any) => void;
  handleSettingsData: (message: SettingsDataMessage) => void;
}

export interface WordFrequencySettingsPersistence {
  wordFrequencySettings: WordFrequencySettings;
}

export type UseWordFrequencySettingsReturn =
  WordFrequencySettingsState &
  WordFrequencySettingsActions &
  { persistedState: WordFrequencySettingsPersistence };

/**
 * Word Frequency Settings Hook
 *
 * Manages all 11 word frequency settings using the Domain Hooks pattern.
 * Provides bidirectional sync with VSCode settings and webview persistence.
 *
 * Backend support: ConfigurationHandler.getAllSettings() (Sprint 02)
 * Config watcher: WORD_FREQUENCY_KEYS in MessageHandler (Sprint 02)
 *
 * @example
 * ```tsx
 * const wordFrequencySettings = useWordFrequencySettings();
 *
 * // Handle settings messages
 * useMessageRouter({
 *   [MessageType.SETTINGS_DATA]: wordFrequencySettings.handleSettingsData,
 * });
 *
 * // Use in MetricsTab to configure word frequency analysis
 * <MetricsTab
 *   wordFrequencySettings={{
 *     settings: wordFrequencySettings.settings,
 *     updateSetting: wordFrequencySettings.updateSetting,
 *   }}
 * />
 *
 * // Access individual settings
 * const topNWords = wordFrequencySettings.settings.topN;
 * const includeHapax = wordFrequencySettings.settings.includeHapaxList;
 * const minLength = wordFrequencySettings.settings.minCharacterLength;
 * ```
 *
 * @returns Settings state (with 11 configurable options), actions (updateSetting, handleSettingsData), and persisted state
 */
export const useWordFrequencySettings = (): UseWordFrequencySettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    // Support both legacy and standardized persisted keys
    wordFrequency?: WordFrequencySettings;
    wordFrequencySettings?: WordFrequencySettings;
  }>();

  const defaults: WordFrequencySettings = {
    topN: 100,
    includeHapaxList: true,
    hapaxDisplayMax: 300,
    includeStopwordsTable: true,
    contentWordsOnly: true,
    posEnabled: true,
    includeBigrams: true,
    includeTrigrams: true,
    enableLemmas: false,
    lengthHistogramMaxChars: 10,
    minCharacterLength: 1,
  };

  const persistedSeed = (persisted?.wordFrequencySettings ?? persisted?.wordFrequency) as
    | WordFrequencySettings
    | undefined;

  const [settings, setSettings] = React.useState<WordFrequencySettings>({
    ...defaults,
    ...(persistedSeed ?? {}),
  });

  // Handle SETTINGS_DATA messages and extract word frequency settings
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const { settings: settingsData } = message.payload;

      // Extract wordFrequency.* settings from flat or nested structure
      const wordFrequencySettings: Partial<WordFrequencySettings> = {
        topN: settingsData['wordFrequency.topN'] as number | undefined,
        includeHapaxList: settingsData['wordFrequency.includeHapaxList'] as boolean | undefined,
        hapaxDisplayMax: settingsData['wordFrequency.hapaxDisplayMax'] as number | undefined,
        includeStopwordsTable: settingsData['wordFrequency.includeStopwordsTable'] as boolean | undefined,
        contentWordsOnly: settingsData['wordFrequency.contentWordsOnly'] as boolean | undefined,
        posEnabled: settingsData['wordFrequency.posEnabled'] as boolean | undefined,
        includeBigrams: settingsData['wordFrequency.includeBigrams'] as boolean | undefined,
        includeTrigrams: settingsData['wordFrequency.includeTrigrams'] as boolean | undefined,
        enableLemmas: settingsData['wordFrequency.enableLemmas'] as boolean | undefined,
        lengthHistogramMaxChars: settingsData['wordFrequency.lengthHistogramMaxChars'] as number | undefined,
        minCharacterLength: settingsData['wordFrequency.minCharacterLength'] as number | undefined,
      };

      // Only update if we got valid data (check at least one setting is defined)
      if (wordFrequencySettings.topN !== undefined) {
        setSettings(prev => ({
          ...prev,
          topN: wordFrequencySettings.topN ?? prev.topN,
          includeHapaxList: wordFrequencySettings.includeHapaxList ?? prev.includeHapaxList,
          hapaxDisplayMax: wordFrequencySettings.hapaxDisplayMax ?? prev.hapaxDisplayMax,
          includeStopwordsTable: wordFrequencySettings.includeStopwordsTable ?? prev.includeStopwordsTable,
          contentWordsOnly: wordFrequencySettings.contentWordsOnly ?? prev.contentWordsOnly,
          posEnabled: wordFrequencySettings.posEnabled ?? prev.posEnabled,
          includeBigrams: wordFrequencySettings.includeBigrams ?? prev.includeBigrams,
          includeTrigrams: wordFrequencySettings.includeTrigrams ?? prev.includeTrigrams,
          enableLemmas: wordFrequencySettings.enableLemmas ?? prev.enableLemmas,
          lengthHistogramMaxChars: wordFrequencySettings.lengthHistogramMaxChars ?? prev.lengthHistogramMaxChars,
          minCharacterLength: wordFrequencySettings.minCharacterLength ?? prev.minCharacterLength,
        }));
      }
    }
  }, []);

  // Update a specific setting (send to backend with optimistic update)
  const updateSetting = React.useCallback((key: keyof WordFrequencySettings, value: any) => {
    // Optimistically update local state immediately for responsive UI
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Send to backend
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useWordFrequencySettings',
      payload: {
        key: `wordFrequency.${key}`,
        value
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  return {
    settings,
    updateSetting,
    handleSettingsData,
    persistedState: { wordFrequencySettings: settings }
  };
};
