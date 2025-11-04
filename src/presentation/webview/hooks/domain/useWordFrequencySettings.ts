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
  handleMessage: (message: any) => void;
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

  const handleMessage = React.useCallback((message: any) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const payload = message.payload || message.data;
      const settingsData = payload?.settings || payload;

      // Extract wordFrequency.* settings from flat or nested structure
      const wordFrequencySettings: Partial<WordFrequencySettings> = {};

      if (settingsData['wordFrequency.topN'] !== undefined) {
        wordFrequencySettings.topN = settingsData['wordFrequency.topN'];
      }
      if (settingsData['wordFrequency.includeHapaxList'] !== undefined) {
        wordFrequencySettings.includeHapaxList = settingsData['wordFrequency.includeHapaxList'];
      }
      if (settingsData['wordFrequency.hapaxDisplayMax'] !== undefined) {
        wordFrequencySettings.hapaxDisplayMax = settingsData['wordFrequency.hapaxDisplayMax'];
      }
      if (settingsData['wordFrequency.includeStopwordsTable'] !== undefined) {
        wordFrequencySettings.includeStopwordsTable = settingsData['wordFrequency.includeStopwordsTable'];
      }
      if (settingsData['wordFrequency.contentWordsOnly'] !== undefined) {
        wordFrequencySettings.contentWordsOnly = settingsData['wordFrequency.contentWordsOnly'];
      }
      if (settingsData['wordFrequency.posEnabled'] !== undefined) {
        wordFrequencySettings.posEnabled = settingsData['wordFrequency.posEnabled'];
      }
      if (settingsData['wordFrequency.includeBigrams'] !== undefined) {
        wordFrequencySettings.includeBigrams = settingsData['wordFrequency.includeBigrams'];
      }
      if (settingsData['wordFrequency.includeTrigrams'] !== undefined) {
        wordFrequencySettings.includeTrigrams = settingsData['wordFrequency.includeTrigrams'];
      }
      if (settingsData['wordFrequency.enableLemmas'] !== undefined) {
        wordFrequencySettings.enableLemmas = settingsData['wordFrequency.enableLemmas'];
      }
      if (settingsData['wordFrequency.lengthHistogramMaxChars'] !== undefined) {
        wordFrequencySettings.lengthHistogramMaxChars = settingsData['wordFrequency.lengthHistogramMaxChars'];
      }
      if (settingsData['wordFrequency.minCharacterLength'] !== undefined) {
        wordFrequencySettings.minCharacterLength = settingsData['wordFrequency.minCharacterLength'];
      }

      if (Object.keys(wordFrequencySettings).length > 0) {
        setSettings(prev => ({ ...prev, ...wordFrequencySettings }));
      }
    }
  }, []);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      handleMessage(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleMessage]);

  const updateSetting = React.useCallback((key: keyof WordFrequencySettings, value: any) => {
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
    handleMessage,
    persistedState: { wordFrequency: settings }
  };
};
