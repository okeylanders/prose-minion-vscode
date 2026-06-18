/**
 * Characterization test for the App message-router map.
 *
 * Pins the full set of routes (so a dropped/renamed route fails loudly) plus a
 * few representative delegations — the domain/source-routed ones (STREAM_CHUNK,
 * STATUS, ERROR) are where a refactor is most likely to go wrong. Pure function,
 * no React render needed.
 */

import { buildAppMessageRoutes, AppMessageRouterDeps } from '@hooks/useAppMessageRouter';
import { MessageType } from '@shared/types';

// The exact routes App wires. Update this list ONLY when intentionally adding
// or removing a route — an accidental drop should fail the first test.
const EXPECTED_ROUTES: MessageType[] = [
  MessageType.SELECTION_UPDATED,
  MessageType.SELECTION_DATA,
  MessageType.ANALYSIS_RESULT,
  MessageType.METRICS_RESULT,
  MessageType.SEARCH_RESULT,
  MessageType.CATEGORY_SEARCH_RESULT,
  MessageType.DICTIONARY_RESULT,
  MessageType.FAST_GENERATE_DICTIONARY_RESULT,
  MessageType.STREAM_STARTED,
  MessageType.STREAM_CHUNK,
  MessageType.STREAM_COMPLETE,
  MessageType.CONTEXT_RESULT,
  MessageType.ACTIVE_FILE,
  MessageType.MANUSCRIPT_GLOBS,
  MessageType.CHAPTER_GLOBS,
  MessageType.STATUS,
  MessageType.SETTINGS_DATA,
  MessageType.API_KEY_STATUS,
  MessageType.MODEL_DATA,
  MessageType.PUBLISHING_STANDARDS_DATA,
  MessageType.OPEN_SETTINGS,
  MessageType.OPEN_SETTINGS_TOGGLE,
  MessageType.TOKEN_USAGE_UPDATE,
  MessageType.ACCOUNT_BALANCE_DATA,
  MessageType.SAVE_RESULT_SUCCESS,
  MessageType.ERROR,
];

const makeDeps = () => {
  const deps = {
    analysis: {
      handleAnalysisResult: jest.fn(), handleStreamStarted: jest.fn(), handleStreamChunk: jest.fn(),
      handleStreamComplete: jest.fn(), handleStatusMessage: jest.fn(), setLoading: jest.fn(),
    },
    metrics: {
      handleMetricsResult: jest.fn(), handleActiveFile: jest.fn(), handleManuscriptGlobs: jest.fn(),
      handleChapterGlobs: jest.fn(), setLoadingForTool: jest.fn(),
    },
    dictionary: {
      handleDictionaryResult: jest.fn(), handleFastGenerateResult: jest.fn(), handleStreamStarted: jest.fn(),
      handleStreamChunk: jest.fn(), handleStreamComplete: jest.fn(), handleStatusMessage: jest.fn(),
      setLoading: jest.fn(), setFastGenerating: jest.fn(),
    },
    context: {
      handleStreamStarted: jest.fn(), handleStreamChunk: jest.fn(), handleStreamComplete: jest.fn(),
      handleContextResult: jest.fn(), setContextText: jest.fn(), setLoading: jest.fn(), loadingRef: { current: false },
    },
    search: {
      handleSearchResult: jest.fn(), handleCategorySearchResult: jest.fn(), handleStatusMessage: jest.fn(),
      setLoading: jest.fn(), setCategorySearchLoading: jest.fn(), setLoadingForSubtool: jest.fn(),
    },
    settings: { handleSettingsData: jest.fn(), handleApiKeyStatus: jest.fn(), open: jest.fn(), toggle: jest.fn() },
    selection: { handleSelectionUpdated: jest.fn(), handleSelectionData: jest.fn() },
    publishingSettings: { handlePublishingStandardsData: jest.fn() },
    wordSearchSettings: { handleSettingsData: jest.fn() },
    wordFrequencySettings: { handleSettingsData: jest.fn() },
    tokensSettings: { handleSettingsData: jest.fn(), handleModelData: jest.fn() },
    themeSettings: { handleSettingsData: jest.fn() },
    tokenTracking: { handleTokenUsageUpdate: jest.fn() },
    contextPathsSettings: { handleSettingsData: jest.fn() },
    modelsSettings: { handleSettingsData: jest.fn(), handleModelData: jest.fn() },
    accountBalance: { handleAccountBalanceData: jest.fn() },
    setActiveTab: jest.fn(),
    setError: jest.fn(),
  } as unknown as AppMessageRouterDeps;
  return deps;
};

describe('buildAppMessageRoutes', () => {
  it('wires exactly the expected route set', () => {
    const routes = buildAppMessageRoutes(makeDeps());
    expect(Object.keys(routes).sort()).toEqual([...EXPECTED_ROUTES].sort());
  });

  it('ANALYSIS_RESULT delegates to analysis and clears the error', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.ANALYSIS_RESULT]!({ type: MessageType.ANALYSIS_RESULT, payload: {} } as never);
    expect(deps.analysis.handleAnalysisResult).toHaveBeenCalled();
    expect(deps.setError).toHaveBeenCalledWith('');
  });

  it('SETTINGS_DATA fans out to all seven settings consumers', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.SETTINGS_DATA]!({ type: MessageType.SETTINGS_DATA, payload: { settings: {} } } as never);
    expect(deps.settings.handleSettingsData).toHaveBeenCalled();
    expect(deps.wordSearchSettings.handleSettingsData).toHaveBeenCalled();
    expect(deps.wordFrequencySettings.handleSettingsData).toHaveBeenCalled();
    expect(deps.tokensSettings.handleSettingsData).toHaveBeenCalled();
    expect(deps.contextPathsSettings.handleSettingsData).toHaveBeenCalled();
    expect(deps.modelsSettings.handleSettingsData).toHaveBeenCalled();
    expect(deps.themeSettings.handleSettingsData).toHaveBeenCalled();
  });

  it('STREAM_CHUNK routes to the named domain only', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.STREAM_CHUNK]!({ payload: { domain: 'context' } } as never);
    expect(deps.context.handleStreamChunk).toHaveBeenCalled();
    expect(deps.analysis.handleStreamChunk).not.toHaveBeenCalled();
    expect(deps.dictionary.handleStreamChunk).not.toHaveBeenCalled();
  });

  // STATUS is source-routed (the docblock above names it a top refactor-risk spot):
  // it dispatches to a different domain handler per `message.source`, with an
  // analysis fallback for backward compatibility. Pin the dispatch, not just the route.
  it('STATUS routes to the dictionary domain for source extension.dictionary', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.STATUS]!(
      { type: MessageType.STATUS, source: 'extension.dictionary', payload: {} } as never
    );
    expect(deps.dictionary.handleStatusMessage).toHaveBeenCalled();
    expect(deps.analysis.handleStatusMessage).not.toHaveBeenCalled();
    expect(deps.search.handleStatusMessage).not.toHaveBeenCalled();
  });

  it('STATUS routes to the search domain for source extension.search', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.STATUS]!(
      { type: MessageType.STATUS, source: 'extension.search', payload: {} } as never
    );
    expect(deps.search.handleStatusMessage).toHaveBeenCalled();
    expect(deps.dictionary.handleStatusMessage).not.toHaveBeenCalled();
    expect(deps.analysis.handleStatusMessage).not.toHaveBeenCalled();
  });

  it('STATUS falls back to the analysis domain for an unrecognized source', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.STATUS]!(
      { type: MessageType.STATUS, source: 'extension.somethingElse', payload: {} } as never
    );
    expect(deps.analysis.handleStatusMessage).toHaveBeenCalled();
    expect(deps.dictionary.handleStatusMessage).not.toHaveBeenCalled();
    expect(deps.search.handleStatusMessage).not.toHaveBeenCalled();
  });

  it('ERROR sets the message and clears only the erroring domain', () => {
    const deps = makeDeps();
    buildAppMessageRoutes(deps)[MessageType.ERROR]!({ payload: { source: 'dictionary', message: 'boom' } } as never);
    expect(deps.setError).toHaveBeenCalledWith('boom');
    expect(deps.dictionary.setLoading).toHaveBeenCalledWith(false);
    expect(deps.dictionary.setFastGenerating).toHaveBeenCalledWith(false);
    expect(deps.analysis.setLoading).not.toHaveBeenCalled();
  });
});
