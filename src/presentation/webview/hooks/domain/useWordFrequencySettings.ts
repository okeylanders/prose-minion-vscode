import React from 'react';
import { MessageType } from '../../../../shared/types/messages';
import { useVSCodeApi } from '../useVSCodeApi';

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
  handleSettingsData: (message: any) => void;
}

export interface WordFrequencySettingsPersistence {
  wordFrequency: WordFrequencySettings;
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
 * @returns Settings state, actions, and persisted state
 */
export const useWordFrequencySettings = (): UseWordFrequencySettingsReturn => {
  const vscode = useVSCodeApi();
  const [settings, setSettings] = React.useState<WordFrequencySettings>({
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
    minCharacterLength: 1
  });

  // Handle SETTINGS_DATA messages and extract word frequency settings
  const handleSettingsData = React.useCallback((message: any) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const payload = message.payload || message.data;
      const settingsData = payload?.settings || payload;

      // Extract wordFrequency.* settings from flat or nested structure
      const wordFrequencySettings: Partial<WordFrequencySettings> = {
        topN: settingsData['wordFrequency.topN'],
        includeHapaxList: settingsData['wordFrequency.includeHapaxList'],
        hapaxDisplayMax: settingsData['wordFrequency.hapaxDisplayMax'],
        includeStopwordsTable: settingsData['wordFrequency.includeStopwordsTable'],
        contentWordsOnly: settingsData['wordFrequency.contentWordsOnly'],
        posEnabled: settingsData['wordFrequency.posEnabled'],
        includeBigrams: settingsData['wordFrequency.includeBigrams'],
        includeTrigrams: settingsData['wordFrequency.includeTrigrams'],
        enableLemmas: settingsData['wordFrequency.enableLemmas'],
        lengthHistogramMaxChars: settingsData['wordFrequency.lengthHistogramMaxChars'],
        minCharacterLength: settingsData['wordFrequency.minCharacterLength'],
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
    persistedState: { wordFrequency: settings }
  };
};
