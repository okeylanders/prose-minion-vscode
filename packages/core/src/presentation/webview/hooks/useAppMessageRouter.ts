/**
 * useAppMessageRouter — the App's extension→webview message switchboard.
 *
 * Lifted verbatim out of App.tsx, where it was a ~140-line inline
 * `useMessageRouter({ ... })` literal — the single biggest block in the file.
 *
 * `buildAppMessageRoutes` is a PURE function of the App's domain hooks + the two
 * UI setters, so the routing table is unit-testable without rendering App (see
 * useAppMessageRouter.test.ts). Behavior is unchanged: App now calls
 * `useAppMessageRouter(deps)` instead of inlining the same object literal, and
 * the underlying `useMessageRouter` still keeps the listener stable via a ref.
 */

import * as React from 'react';
import { MessageType, TabId } from '@shared/types';
import { useMessageRouter, MessageHandlerMap } from './useMessageRouter';

import { UseAnalysisReturn } from './domain/useAnalysis';
import { UseMetricsReturn } from './domain/useMetrics';
import { UseDictionaryReturn } from './domain/useDictionary';
import { UseContextReturn } from './domain/useContext';
import { UseSearchReturn } from './domain/useSearch';
import { UseSettingsReturn } from './domain/useSettings';
import { UseSelectionReturn } from './domain/useSelection';
import { UsePublishingSettingsReturn } from './domain/usePublishingSettings';
import { UseWordSearchSettingsReturn } from './domain/useWordSearchSettings';
import { UseWordFrequencySettingsReturn } from './domain/useWordFrequencySettings';
import { UseTokensSettingsReturn } from './domain/useTokensSettings';
import { UseThemeSettingsReturn } from './domain/useThemeSettings';
import { UseTokenTrackingReturn } from './domain/useTokenTracking';
import { UseContextPathsSettingsReturn } from './domain/useContextPathsSettings';
import { UseModelsSettingsReturn } from './domain/useModelsSettings';
import { UseAccountBalanceReturn } from './domain/useAccountBalance';

/** Everything the route map closes over: the domain hooks + the two UI setters. */
export interface AppMessageRouterDeps {
  analysis: UseAnalysisReturn;
  metrics: UseMetricsReturn;
  dictionary: UseDictionaryReturn;
  context: UseContextReturn;
  search: UseSearchReturn;
  settings: UseSettingsReturn;
  selection: UseSelectionReturn;
  publishingSettings: UsePublishingSettingsReturn;
  wordSearchSettings: UseWordSearchSettingsReturn;
  wordFrequencySettings: UseWordFrequencySettingsReturn;
  tokensSettings: UseTokensSettingsReturn;
  themeSettings: UseThemeSettingsReturn;
  tokenTracking: UseTokenTrackingReturn;
  contextPathsSettings: UseContextPathsSettingsReturn;
  modelsSettings: UseModelsSettingsReturn;
  accountBalance: UseAccountBalanceReturn;
  setActiveTab: React.Dispatch<React.SetStateAction<TabId>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Build the MessageType → handler map. Pure: same deps in, same routes out.
 * Kept as a standalone function (not inlined in the hook) so tests can assert
 * the full route set + delegation without a React render.
 */
export const buildAppMessageRoutes = (deps: AppMessageRouterDeps): MessageHandlerMap => {
  const {
    analysis, metrics, dictionary, context, search, settings, selection,
    publishingSettings, wordSearchSettings, wordFrequencySettings, tokensSettings,
    themeSettings, tokenTracking, contextPathsSettings, modelsSettings, accountBalance,
    setActiveTab, setError,
  } = deps;

  return {
    [MessageType.SELECTION_UPDATED]: (msg) => selection.handleSelectionUpdated(msg, setActiveTab),
    [MessageType.SELECTION_DATA]: (msg) => selection.handleSelectionData(msg, setActiveTab, context.setContextText),
    [MessageType.ANALYSIS_RESULT]: (msg) => {
      analysis.handleAnalysisResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.METRICS_RESULT]: (msg) => {
      metrics.handleMetricsResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.SEARCH_RESULT]: (msg) => {
      search.handleSearchResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.CATEGORY_SEARCH_RESULT]: (msg) => {
      search.handleCategorySearchResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.DICTIONARY_RESULT]: (msg) => {
      dictionary.handleDictionaryResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.FAST_GENERATE_DICTIONARY_RESULT]: (msg) => {
      dictionary.handleFastGenerateResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.STREAM_STARTED]: (msg) => {
      const domain = msg.payload.domain;
      if (domain === 'dictionary') {
        dictionary.handleStreamStarted(msg);
      } else if (domain === 'analysis') {
        analysis.handleStreamStarted(msg);
      } else if (domain === 'context') {
        context.handleStreamStarted(msg);
      }
    },
    [MessageType.STREAM_CHUNK]: (msg) => {
      // Route streaming chunks based on domain
      const domain = msg.payload.domain;
      if (domain === 'dictionary') {
        dictionary.handleStreamChunk(msg);
      } else if (domain === 'analysis') {
        analysis.handleStreamChunk(msg);
      } else if (domain === 'context') {
        context.handleStreamChunk(msg);
      }
    },
    [MessageType.STREAM_COMPLETE]: (msg) => {
      // Route stream complete based on domain
      const domain = msg.payload.domain;
      if (domain === 'dictionary') {
        dictionary.handleStreamComplete(msg);
        setError(''); // Clear error on success
      } else if (domain === 'analysis') {
        analysis.handleStreamComplete(msg);
        setError(''); // Clear error on success
      } else if (domain === 'context') {
        context.handleStreamComplete(msg);
        setError(''); // Clear error on success
      }
    },
    [MessageType.CONTEXT_RESULT]: (msg) => {
      context.handleContextResult(msg);
      setError(''); // Clear error on success
    },
    [MessageType.ACTIVE_FILE]: metrics.handleActiveFile,
    [MessageType.MANUSCRIPT_GLOBS]: metrics.handleManuscriptGlobs,
    [MessageType.CHAPTER_GLOBS]: metrics.handleChapterGlobs,
    [MessageType.STATUS]: (msg) => {
      // Route status messages based on source
      if (msg.source === 'extension.dictionary') {
        dictionary.handleStatusMessage(msg);
      } else if (msg.source === 'extension.analysis') {
        analysis.handleStatusMessage(msg, context.loadingRef);
      } else if (msg.source === 'extension.search') {
        search.handleStatusMessage(msg);
      } else {
        // Default to analysis for backward compatibility
        analysis.handleStatusMessage(msg, context.loadingRef);
      }
    },
    [MessageType.SETTINGS_DATA]: (msg) => {
      settings.handleSettingsData(msg);
      wordSearchSettings.handleSettingsData(msg);
      wordFrequencySettings.handleSettingsData(msg);
      tokensSettings.handleSettingsData(msg);
      contextPathsSettings.handleSettingsData(msg);
      modelsSettings.handleSettingsData(msg);
      themeSettings.handleSettingsData(msg);
    },
    [MessageType.API_KEY_STATUS]: settings.handleApiKeyStatus,
    [MessageType.MODEL_DATA]: (msg) => {
      tokensSettings.handleModelData(msg);
      modelsSettings.handleModelData(msg);
    },
    [MessageType.PUBLISHING_STANDARDS_DATA]: publishingSettings.handlePublishingStandardsData,
    [MessageType.OPEN_SETTINGS]: settings.open,
    [MessageType.OPEN_SETTINGS_TOGGLE]: settings.toggle,
    [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,
    [MessageType.ACCOUNT_BALANCE_DATA]: accountBalance.handleAccountBalanceData,
    [MessageType.SAVE_RESULT_SUCCESS]: (msg) => console.log('Result saved to', msg.payload.filePath),
    [MessageType.ERROR]: (msg) => {
      const { source, message: errorMessage } = msg.payload;
      setError(errorMessage);

      // Clear loading state only for the domain that errored
      // This prevents cross-tab error interference (e.g., analysis still running when search errors)
      const errorSource = source || 'unknown';

      if (errorSource.startsWith('metrics.')) {
        // Any metrics subtool error clears metrics loading
        (['prose_stats', 'style_flags', 'word_frequency'] as const).forEach(tool => metrics.setLoadingForTool(tool, false));
      } else if (errorSource === 'search' || errorSource.startsWith('extension.search')) {
        search.setLoading(false);
        search.setCategorySearchLoading(false);
      } else if (errorSource === 'analysis') {
        analysis.setLoading(false);
      } else if (errorSource === 'dictionary') {
        dictionary.setLoading(false);
        dictionary.setFastGenerating(false);
      } else if (errorSource === 'context') {
        context.setLoading(false);
      } else if (errorSource.startsWith('settings.') || errorSource.startsWith('file_ops.') || errorSource.startsWith('ui.') || errorSource === 'publishing') {
        // Settings, file ops, UI, publishing errors don't have loading states to clear
        // Error message display is sufficient
      } else {
        // Unknown source - clear all as fallback for safety
        analysis.setLoading(false);
        (['prose_stats', 'style_flags', 'word_frequency'] as const).forEach(tool => metrics.setLoadingForTool(tool, false));
        dictionary.setLoading(false);
        dictionary.setFastGenerating(false);
        context.setLoading(false);
        search.setLoadingForSubtool('word', false);
        search.setCategorySearchLoading(false);
      }
    },
  };
};

/**
 * Hook form: wires the built route map into the stable window-message listener.
 * Identical render semantics to the old inline literal (a fresh map per render,
 * stored in a ref by useMessageRouter).
 */
export const useAppMessageRouter = (deps: AppMessageRouterDeps): void => {
  useMessageRouter(buildAppMessageRoutes(deps));
};
