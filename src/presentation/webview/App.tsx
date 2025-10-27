/**
 * Main App component - Presentation layer
 * Refactored to use domain hooks pattern
 */

import * as React from 'react';
import { TabBar } from './components/TabBar';
import { AnalysisTab } from './components/AnalysisTab';
import { MetricsTab } from './components/MetricsTab';
import { SuggestionsTab } from './components/SuggestionsTab';
import { UtilitiesTab } from './components/UtilitiesTab';
import { SearchTab } from './components/SearchTab';
import { ModelSelector } from './components/ModelSelector';
import { SettingsOverlay } from './components/SettingsOverlay';
import { TabId, MessageType, ModelScope } from '../../shared/types';

// Infrastructure hooks
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { usePersistence } from './hooks/usePersistence';
import { useMessageRouter } from './hooks/useMessageRouter';

// Domain hooks
import { useAnalysis } from './hooks/domain/useAnalysis';
import { useMetrics } from './hooks/domain/useMetrics';
import { useDictionary } from './hooks/domain/useDictionary';
import { useContext } from './hooks/domain/useContext';
import { useSearch } from './hooks/domain/useSearch';
import { useSettings } from './hooks/domain/useSettings';
import { useSelection } from './hooks/domain/useSelection';
import { usePublishing } from './hooks/domain/usePublishing';

export const App: React.FC = () => {
  const vscode = useVSCodeApi();

  // Domain hooks
  const analysis = useAnalysis();
  const metrics = useMetrics();
  const dictionary = useDictionary();
  const context = useContext();
  const search = useSearch();
  const settings = useSettings();
  const selection = useSelection();
  const publishing = usePublishing();

  // UI-only state
  const [activeTab, setActiveTab] = React.useState<TabId>(TabId.ANALYSIS);
  const [error, setError] = React.useState('');

  // Message routing using Strategy pattern
  useMessageRouter({
    [MessageType.SELECTION_UPDATED]: (msg) => selection.handleSelectionUpdated(msg, setActiveTab),
    [MessageType.SELECTION_DATA]: (msg) => selection.handleSelectionData(msg, setActiveTab, context.setContextText),
    [MessageType.ANALYSIS_RESULT]: analysis.handleAnalysisResult,
    [MessageType.METRICS_RESULT]: metrics.handleMetricsResult,
    [MessageType.SEARCH_RESULT]: search.handleSearchResult,
    [MessageType.DICTIONARY_RESULT]: dictionary.handleDictionaryResult,
    [MessageType.CONTEXT_RESULT]: context.handleContextResult,
    [MessageType.ACTIVE_FILE]: metrics.handleActiveFile,
    [MessageType.MANUSCRIPT_GLOBS]: metrics.handleManuscriptGlobs,
    [MessageType.CHAPTER_GLOBS]: metrics.handleChapterGlobs,
    [MessageType.STATUS_MESSAGE]: (msg) => analysis.handleStatusMessage(msg, context.loadingRef),
    [MessageType.SETTINGS_DATA]: settings.handleSettingsData,
    [MessageType.API_KEY_STATUS]: settings.handleApiKeyStatus,
    [MessageType.MODEL_OPTIONS_DATA]: settings.handleModelOptionsData,
    [MessageType.PUBLISHING_STANDARDS_DATA]: publishing.handlePublishingStandardsData,
    [MessageType.OPEN_SETTINGS]: settings.open,
    [MessageType.OPEN_SETTINGS_TOGGLE]: settings.toggle,
    [MessageType.SAVE_RESULT_SUCCESS]: (msg) => console.log('Result saved to', msg.filePath),
    [MessageType.ERROR]: (msg) => {
      setError(msg.message);
      analysis.setLoading(false);
      metrics.setLoading(false);
      dictionary.setLoading(false);
      context.setLoading(false);
    },
  });

  // Persistence - combine all domain state
  usePersistence({
    activeTab,
    ...selection.persistedState,
    ...analysis.persistedState,
    ...metrics.persistedState,
    ...dictionary.persistedState,
    ...context.persistedState,
    ...search.persistedState,
    ...settings.persistedState,
    ...publishing.persistedState,
  });

  // Tab change handler
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    if (error) {
      setError('');
    }
  };

  // Model selector rendering
  const renderModelSelector = () => {
    if (settings.modelOptions.length === 0) {
      return null;
    }

    // Only show model selector on tabs that use AI
    if (activeTab === TabId.ANALYSIS || activeTab === TabId.SUGGESTIONS) {
      return (
        <div className="model-selector-section">
          <ModelSelector
            scope="assistant"
            options={settings.modelOptions}
            value={settings.modelSelections.assistant}
            onChange={settings.setModelSelection}
            label="Assistant Model"
          />
        </div>
      );
    } else if (activeTab === TabId.UTILITIES) {
      return (
        <div className="model-selector-section">
          <ModelSelector
            scope="dictionary"
            options={settings.modelOptions}
            value={settings.modelSelections.dictionary}
            onChange={settings.setModelSelection}
            label="Dictionary Model"
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSettingsClick={settings.toggle}
        />

        <svg className="settings-icon" width="20" height="20" viewBox="0 0 20 20" onClick={settings.toggle}>
          <g fill="currentColor">
            <path d="M15.95 10.78c.03-.25.05-.51.05-.78s-.02-.53-.06-.78l1.69-1.32c.15-.12.19-.34.1-.51l-1.6-2.77c-.1-.18-.31-.24-.49-.18l-1.99.8c-.42-.32-.86-.58-1.35-.78L12 2.34c-.03-.2-.2-.34-.4-.34H8.4c-.2 0-.36.14-.39.34l-.3 2.12c-.49.2-.94.47-1.35.78l-1.99-.8c-.18-.07-.39 0-.49.18l-1.6 2.77c-.1.18-.06.39.1.51l1.69 1.32c-.04.25-.07.52-.07.78s.02.53.06.78L2.37 12.1c-.15.12-.19.34-.1.51l1.6 2.77c.1.18.31.24.49.18l1.99-.8c.42.32.86.58 1.35.78l.3 2.12c.04.2.2.34.4.34h3.2c.2 0 .37-.14.39-.34l.3-2.12c.49-.2.94-.47 1.35-.78l1.99.8c.18.07.39 0 .49-.18l1.6-2.77c.1-.18.06-.39-.1-.51l-1.67-1.32zM10 13c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" />
          </g>
        </svg>

        {settings.showTokenWidget && (
          <div className="token-widget" title="Session token usage (resets on reload)">
            <span>
              {(settings.tokenTotals?.totalTokens ?? 0).toLocaleString()} tokens
              {typeof settings.tokenTotals?.costUsd === 'number'
                ? ` | $${settings.tokenTotals.costUsd.toFixed(3)}`
                : ''}
            </span>
          </div>
        )}
      </header>

      <main className="app-main" style={{ position: 'relative' }}>
        <SettingsOverlay
          visible={settings.showSettings}
          onClose={settings.close}
          vscode={vscode}
          settings={settings.settingsData}
          onUpdate={settings.updateSetting}
          onResetTokens={settings.resetTokens}
          modelOptions={settings.modelOptions}
          modelSelections={settings.modelSelections}
          onModelChange={settings.setModelSelection}
          publishing={{
            preset: publishing.publishingPreset,
            trimKey: publishing.publishingTrimKey,
            genres: publishing.publishingGenres,
            onPresetChange: publishing.setPublishingPreset,
            onTrimChange: publishing.setPublishingTrim,
          }}
          apiKey={{
            input: settings.apiKeyInput,
            hasSavedKey: settings.hasSavedKey,
            onInputChange: settings.setApiKeyInput,
            onSave: settings.saveApiKey,
            onClear: settings.clearApiKey,
          }}
        />

        {renderModelSelector()}

        {error && (
          <div className="error-banner" style={{ padding: '10px', backgroundColor: '#f44336', color: 'white' }}>
            {error}
          </div>
        )}

        {activeTab === TabId.ANALYSIS && (
          <AnalysisTab
            selectedText={selection.selectedText}
            vscode={vscode}
            result={analysis.result}
            isLoading={analysis.loading}
            onLoadingChange={analysis.setLoading}
            statusMessage={analysis.statusMessage}
            guideNames={analysis.guideNames}
            usedGuides={analysis.usedGuides}
            contextText={context.contextText}
            onContextChange={context.setContextText}
            onContextRequest={context.requestContext}
            contextLoading={context.loading}
            contextStatusMessage={context.statusMessage}
            contextRequestedResources={context.requestedResources}
            selectedRelativePath={selection.selectedRelativePath}
            selectedSourceUri={selection.selectedSourceUri}
            analysisToolName={analysis.toolName}
            onRequestSelection={selection.requestSelection}
          />
        )}

        {activeTab === TabId.SUGGESTIONS && (
          <SuggestionsTab selectedText={selection.selectedText} vscode={vscode} />
        )}

        {activeTab === TabId.METRICS && (
          <MetricsTab
            vscode={vscode}
            metricsByTool={metrics.metricsByTool}
            isLoading={metrics.loading}
            onLoadingChange={metrics.setLoading}
            activeTool={metrics.activeTool}
            onActiveToolChange={metrics.setActiveTool}
            sourceMode={metrics.sourceMode}
            pathText={metrics.pathText}
            onSourceModeChange={metrics.setSourceMode}
          />
        )}

        {activeTab === TabId.SEARCH && (
          <SearchTab
            vscode={vscode}
            result={search.searchResult}
            isLoading={metrics.loading}
            onLoadingChange={metrics.setLoading}
            wordSearchTargets={search.wordSearchTargets}
            onWordSearchTargetsChange={search.setWordSearchTargets}
            sourceMode={metrics.sourceMode}
            pathText={metrics.pathText}
            onSourceModeChange={metrics.setSourceMode}
          />
        )}

        {activeTab === TabId.UTILITIES && (
          <UtilitiesTab
            selectedText={selection.selectedText}
            vscode={vscode}
            result={dictionary.result}
            isLoading={dictionary.loading}
            onLoadingChange={dictionary.setLoading}
            statusMessage={analysis.statusMessage}
            toolName={dictionary.toolName}
            dictionaryInjection={selection.dictionaryInjection}
            onDictionaryInjectionHandled={selection.handleDictionaryInjectionHandled}
            onRequestSelection={selection.requestSelection}
            word={dictionary.word}
            context={dictionary.context}
            onWordChange={(val) => {
              dictionary.setWord(val);
              dictionary.setWordEdited(true);
            }}
            onContextChange={dictionary.setContext}
            hasWordBeenEdited={dictionary.wordEdited}
            setHasWordBeenEdited={dictionary.setWordEdited}
            sourceUri={dictionary.sourceUri}
            relativePath={dictionary.relativePath}
            onSourceChange={dictionary.setSource}
          />
        )}
      </main>
    </div>
  );
};
