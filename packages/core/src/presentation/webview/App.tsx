/**
 * Main App component - Presentation layer
 * Refactored to use domain hooks pattern
 */

import * as React from 'react';
import { TabBar, Tab } from './components/shared/TabBar';
import { ThemeToggle } from './components/shared/ThemeToggle';
import { PmLogo } from './components/shared/PmLogo';
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { MetricsTab } from './components/tabs/MetricsTab';
import { SuggestionsTab } from './components/tabs/SuggestionsTab';
import { UtilitiesTab } from './components/tabs/UtilitiesTab';
import { SearchTab } from './components/tabs/SearchTab';
import { ModelSelector } from './components/shared/ModelSelector';
import { SettingsOverlay } from './components/SettingsOverlay';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { TabErrorFallback } from './components/shared/TabErrorFallback';
import { TabId, MessageType, ModelScope } from '@shared/types';

// Infrastructure hooks
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { usePersistence } from './hooks/usePersistence';
import { useAppMessageRouter } from './hooks/useAppMessageRouter';

// Domain hooks
import { useAnalysis } from './hooks/domain/useAnalysis';
import { useMetrics } from './hooks/domain/useMetrics';
import { useDictionary } from './hooks/domain/useDictionary';
import { useContext } from './hooks/domain/useContext';
import { useSearch } from './hooks/domain/useSearch';
import { useSettings } from './hooks/domain/useSettings';
import { useSelection } from './hooks/domain/useSelection';
import { usePublishingSettings } from './hooks/domain/usePublishingSettings';
import { useWordSearchSettings } from './hooks/domain/useWordSearchSettings';
import { useWordFrequencySettings } from './hooks/domain/useWordFrequencySettings';
import { useTokensSettings } from './hooks/domain/useTokensSettings';
import { useThemeSettings } from './hooks/domain/useThemeSettings';
import { useTokenTracking } from './hooks/domain/useTokenTracking';
import { useAccountBalance } from './hooks/domain/useAccountBalance';
import { useContextPathsSettings } from './hooks/domain/useContextPathsSettings';
import { useModelsSettings } from './hooks/domain/useModelsSettings';
import { AccountBalancePill, AccountBalanceStrip } from './components/balances';
import { Icon } from './components/shared/Icon';
import { VSCodeAPI } from './types/vscode';

export const App: React.FC = () => {
  const vscode: VSCodeAPI = useVSCodeApi();

  // Domain hooks
  const analysis = useAnalysis();
  const metrics = useMetrics();
  const dictionary = useDictionary();
  const context = useContext();
  const search = useSearch();
  const settings = useSettings();
  const selection = useSelection();
  const publishingSettings = usePublishingSettings();
  const wordSearchSettings = useWordSearchSettings();
  const wordFrequencySettings = useWordFrequencySettings();
  const tokensSettings = useTokensSettings();
  const tokenTracking = useTokenTracking();
  const contextPathsSettings = useContextPathsSettings();
  const modelsSettings = useModelsSettings();
  const themeSettings = useThemeSettings();
  const accountBalance = useAccountBalance({ apiKeyConfigured: settings.hasSavedKey });

  // UI-only state
  const [activeTab, setActiveTab] = React.useState<TabId>(TabId.ANALYSIS);
  const [error, setError] = React.useState('');
  // Balance disclosure: collapsed pill in the header → full in-flow strip below.
  const [balancesExpanded, setBalancesExpanded] = React.useState(false);

  // Error boundary handler - sends errors to extension for logging
  const handleBoundaryError = React.useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    vscode.postMessage({
      type: MessageType.WEBVIEW_ERROR,
      source: 'webview.error_boundary',
      payload: {
        message: error.message,
        details: errorInfo.componentStack || undefined
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  // Refs for error boundary reset
  const analysisErrorRef = React.useRef<ErrorBoundary>(null);
  const suggestionsErrorRef = React.useRef<ErrorBoundary>(null);
  const metricsErrorRef = React.useRef<ErrorBoundary>(null);
  const searchErrorRef = React.useRef<ErrorBoundary>(null);
  const utilitiesErrorRef = React.useRef<ErrorBoundary>(null);

  // Message routing using Strategy pattern (the route map lives in useAppMessageRouter)
  useAppMessageRouter({
    analysis,
    metrics,
    dictionary,
    context,
    search,
    settings,
    selection,
    publishingSettings,
    wordSearchSettings,
    wordFrequencySettings,
    tokensSettings,
    themeSettings,
    tokenTracking,
    contextPathsSettings,
    modelsSettings,
    accountBalance,
    setActiveTab,
    setError,
  });

  // Persistence - combine all domain state
  usePersistence({
    activeTab,
    ...themeSettings.persistedState,
    ...selection.persistedState,
    ...analysis.persistedState,
    ...metrics.persistedState,
    ...dictionary.persistedState,
    ...context.persistedState,
    ...search.persistedState,
    ...settings.persistedState,
    ...publishingSettings.persistedState,
    ...wordSearchSettings.persistedState,
    ...wordFrequencySettings.persistedState,
    ...tokensSettings.persistedState,
    ...tokenTracking.persistedState,
    ...contextPathsSettings.persistedState,
    ...modelsSettings.persistedState,
  });

  // Request initial model data on app mount
  const requestModelData = React.useCallback(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_MODEL_DATA,
      source: 'webview.app',
      payload: {},
      timestamp: Date.now()
    });
  }, [vscode]);

  React.useEffect(() => {
    requestModelData();
  }, [requestModelData]);

  // Tab change handler
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    if (error) {
      setError('');
    }
  };

  // Define tabs array for TabBar
  const tabs: Tab<TabId>[] = [
    { id: TabId.ANALYSIS, label: 'Assistant', icon: <Icon name="bot" size={21} /> },
    { id: TabId.SEARCH, label: 'Search', icon: <Icon name="search" size={21} /> },
    { id: TabId.METRICS, label: 'Metrics', icon: <Icon name="bars" size={21} /> },
    { id: TabId.UTILITIES, label: 'Dictionary', icon: <Icon name="book" size={21} /> }
  ];

  // Model selector rendering
  const renderModelSelector = () => {
    if (modelsSettings.modelOptions.length === 0) {
      return null;
    }

    // Only show model selector on tabs that use AI
    if (activeTab === TabId.ANALYSIS || activeTab === TabId.SUGGESTIONS) {
      return (
        <div className="model-selector-section">
          <ModelSelector
            scope="assistant"
            options={modelsSettings.modelOptions}
            value={modelsSettings.modelSelections.assistant}
            onChange={modelsSettings.setModelSelection}
            label="Assistant Model"
          />
        </div>
      );
    } else if (activeTab === TabId.UTILITIES) {
      return (
        <div className="model-selector-section">
          <ModelSelector
            scope="dictionary"
            options={modelsSettings.modelOptions}
            value={modelsSettings.modelSelections.dictionary}
            onChange={modelsSettings.setModelSelection}
            label="Dictionary Model"
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="app-container"
      data-pm-theme={themeSettings.settings.sidebarTheme === 'follow-vscode' ? 'follow' : 'warm-dark'}
    >
      <header className="app-header pm-header">
        <div className="pm-brand">
          <div className="pm-logo">
        <PmLogo />
          </div>
          <div className="app-title">
            <h1 className="pm-title">Prose Minion</h1>
            <p className="pm-subtitle">AI-powered writing assistance</p>
          </div>
        </div>
        <AccountBalancePill
          balance={accountBalance}
          lastRequestCostUsd={tokenTracking.lastRequestCostUsd}
          expanded={balancesExpanded}
          onToggle={() => setBalancesExpanded((v) => !v)}
        />
      </header>
      {balancesExpanded && <AccountBalanceStrip balance={accountBalance} />}

      <ThemeToggle
        following={themeSettings.settings.sidebarTheme === 'follow-vscode'}
        onChange={(following) =>
          themeSettings.updateSetting('sidebarTheme', following ? 'follow-vscode' : 'warm-dark')
        }
      />

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        ariaLabel="Main navigation"
        variant="cards"
      />

      <main className="app-main" style={{ position: 'relative' }}>
        <SettingsOverlay
          visible={settings.showSettings}
          onClose={settings.close}
          vscode={vscode}
          modelsSettings={modelsSettings}
          tokensSettings={tokensSettings}
          tokenTracking={tokenTracking}
          contextPathsSettings={contextPathsSettings}
          wordFrequencySettings={wordFrequencySettings}
          wordSearchSettings={wordSearchSettings}
          modelOptions={modelsSettings.modelOptions}
          modelSelections={modelsSettings.modelSelections}
          onModelChange={modelsSettings.setModelSelection}
          publishing={{
            preset: publishingSettings.publishingPreset,
            trimKey: publishingSettings.publishingTrimKey,
            genres: publishingSettings.publishingGenres,
            onPresetChange: publishingSettings.setPublishingPreset,
            onTrimChange: publishingSettings.setPublishingTrim,
          }}
          apiKey={{
            input: settings.apiKeyInput,
            hasSavedKey: settings.hasSavedKey,
            onInputChange: settings.setApiKeyInput,
            onSave: settings.saveApiKey,
            onDelete: settings.clearApiKey,
          }}
        />

        {renderModelSelector()}

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {activeTab === TabId.ANALYSIS && (
          <ErrorBoundary
            ref={analysisErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Assistant"
                onRetry={() => analysisErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <AnalysisTab
              vscode={vscode}
              analysis={analysis}
              context={context}
              selection={selection}
              modelsSettings={modelsSettings}
              settings={settings}
            />
          </ErrorBoundary>
        )}

        {activeTab === TabId.SUGGESTIONS && (
          <ErrorBoundary
            ref={suggestionsErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Suggestions"
                onRetry={() => suggestionsErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <SuggestionsTab selectedText={selection.selectedText} vscode={vscode} />
          </ErrorBoundary>
        )}

        {activeTab === TabId.METRICS && (
          <ErrorBoundary
            ref={metricsErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Metrics"
                onRetry={() => metricsErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <MetricsTab
              vscode={vscode}
              metrics={metrics}
              publishingSettings={publishingSettings}
              wordFrequencySettings={wordFrequencySettings}
            />
          </ErrorBoundary>
        )}

        {activeTab === TabId.SEARCH && (
          <ErrorBoundary
            ref={searchErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Search"
                onRetry={() => searchErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <SearchTab
              vscode={vscode}
              search={search}
              metrics={metrics}
              wordSearchSettings={wordSearchSettings}
              modelsSettings={modelsSettings}
            />
          </ErrorBoundary>
        )}

        {activeTab === TabId.UTILITIES && (
          <ErrorBoundary
            ref={utilitiesErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Dictionary"
                onRetry={() => utilitiesErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <UtilitiesTab
              vscode={vscode}
              dictionary={dictionary}
              selection={selection}
              settings={settings}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
};
