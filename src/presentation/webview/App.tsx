/**
 * Main App component - Presentation layer
 * Manages application state and message handling
 */

import * as React from 'react';
import { TabBar } from './components/TabBar';
import { AnalysisTab } from './components/AnalysisTab';
import { MetricsTab } from './components/MetricsTab';
import { SuggestionsTab } from './components/SuggestionsTab';
import { UtilitiesTab } from './components/UtilitiesTab';
import { ModelSelector } from './components/ModelSelector';
import {
  TabId,
  MessageType,
  ExtensionToWebviewMessage,
  ModelScope,
  ModelOption
} from '../../shared/types';

// Get VS Code API
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabId>(TabId.ANALYSIS);
  const [selectedText, setSelectedText] = React.useState('');
  const [analysisResult, setAnalysisResult] = React.useState('');
  const [analysisLoading, setAnalysisLoading] = React.useState(false);
  const [metricsResult, setMetricsResult] = React.useState<any>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [utilitiesResult, setUtilitiesResult] = React.useState('');
  const [utilitiesLoading, setUtilitiesLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [guideNames, setGuideNames] = React.useState<string>('');
  const [usedGuides, setUsedGuides] = React.useState<string[]>([]);
  const [modelOptions, setModelOptions] = React.useState<ModelOption[]>([]);
  const [modelSelections, setModelSelections] = React.useState<Partial<Record<ModelScope, string>>>({});

  // Handle messages from extension
  React.useEffect(() => {
    const messageHandler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;

      switch (message.type) {
        case MessageType.SELECTION_UPDATED:
          setSelectedText(message.text);
          break;

        case MessageType.ANALYSIS_RESULT:
          setAnalysisResult(message.result);
          setUsedGuides(message.usedGuides || []);
          setAnalysisLoading(false);
          setStatusMessage(''); // Clear status message
          setGuideNames(''); // Clear guide names
          setError('');
          break;

        case MessageType.METRICS_RESULT:
          setMetricsResult(message.result);
          setMetricsLoading(false);
          setError('');
          break;

        case MessageType.DICTIONARY_RESULT:
          setUtilitiesResult(message.result);
          setUtilitiesLoading(false);
          setStatusMessage('');
          setGuideNames('');
          setError('');
          break;

        case MessageType.ERROR:
          setError(message.message);
          setAnalysisLoading(false);
          setMetricsLoading(false);
          setUtilitiesLoading(false);
          setAnalysisResult('');
          setMetricsResult(null);
          setUtilitiesResult('');
          break;

        case MessageType.STATUS:
          setStatusMessage(message.message);
          setGuideNames(message.guideNames || '');
          console.log('Status:', message.message, message.guideNames ? `(${message.guideNames})` : '');
          break;

        case MessageType.MODEL_DATA:
          setModelOptions(message.options);
          setModelSelections(message.selections ?? {});
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  React.useEffect(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_MODEL_DATA
    });
  }, []);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setError('');

    // Notify extension of tab change
    vscode.postMessage({
      type: MessageType.TAB_CHANGED,
      tabId
    });
  };

  const handleModelChange = React.useCallback((scope: ModelScope, modelId: string) => {
    setModelSelections(prev => ({
      ...prev,
      [scope]: modelId
    }));

    vscode.postMessage({
      type: MessageType.SET_MODEL_SELECTION,
      scope,
      modelId
    });
  }, []);

  const renderModelSelector = () => {
    if (modelOptions.length === 0) {
      return null;
    }

    if (activeTab === TabId.ANALYSIS) {
      return (
        <div className="model-selector-container">
          <ModelSelector
            scope="assistant"
            options={modelOptions}
            value={modelSelections.assistant}
            onChange={handleModelChange}
            label="Assistant Model"
            helperText="Applies to dialogue and prose assistants."
          />
        </div>
      );
    }

    if (activeTab === TabId.UTILITIES) {
      return (
        <div className="model-selector-container">
          <ModelSelector
            scope="dictionary"
            options={modelOptions}
            value={modelSelections.dictionary}
            onChange={handleModelChange}
            label="Dictionary Model"
            helperText="Used for AI-powered dictionary entries."
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="text-xl font-bold">Prose Minion</h1>
        <p className="text-sm text-gray-500">AI-powered writing assistance</p>
      </header>

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
      {renderModelSelector()}

      <main className="app-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {activeTab === TabId.ANALYSIS && (
          <AnalysisTab
            selectedText={selectedText}
            vscode={vscode}
            result={analysisResult}
            isLoading={analysisLoading}
            onLoadingChange={setAnalysisLoading}
            statusMessage={statusMessage}
            guideNames={guideNames}
            usedGuides={usedGuides}
          />
        )}

        {activeTab === TabId.SUGGESTIONS && (
          <SuggestionsTab
            selectedText={selectedText}
            vscode={vscode}
          />
        )}

        {activeTab === TabId.METRICS && (
          <MetricsTab
            selectedText={selectedText}
            vscode={vscode}
            metrics={metricsResult}
            isLoading={metricsLoading}
            onLoadingChange={setMetricsLoading}
          />
        )}

        {activeTab === TabId.UTILITIES && (
          <UtilitiesTab
            selectedText={selectedText}
            vscode={vscode}
            result={utilitiesResult}
            isLoading={utilitiesLoading}
            onLoadingChange={setUtilitiesLoading}
            statusMessage={statusMessage}
          />
        )}
      </main>
    </div>
  );
};
