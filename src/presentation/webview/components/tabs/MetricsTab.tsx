/**
 * MetricsTab component - Thin orchestrator
 * Routes to focused panel components (ProseStats, StyleFlags, WordFrequency)
 * Refactored from god component to follow Single Responsibility Principle
 */

import * as React from 'react';
import { MessageType } from '@shared/types';
import { ScopeBox, LoadingIndicator } from '../shared';
import { TabBar, Tab } from '../shared/TabBar';
import { ProseStatsPanel } from '../metrics/ProseStatsPanel';
import { StyleFlagsPanel } from '../metrics/StyleFlagsPanel';
import { WordFrequencyPanel } from '../metrics/WordFrequencyPanel';
import { VSCodeAPI } from '../../types/vscode';
import { UseMetricsReturn, MetricsTool } from '../../hooks/domain/useMetrics';
import { UsePublishingSettingsReturn } from '../../hooks/domain/usePublishingSettings';
import { UseWordFrequencySettingsReturn } from '../../hooks/domain/useWordFrequencySettings';

interface MetricsTabProps {
  vscode: VSCodeAPI;
  metrics: UseMetricsReturn;
  publishingSettings: UsePublishingSettingsReturn;
  wordFrequencySettings: UseWordFrequencySettingsReturn;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  vscode,
  metrics,
  publishingSettings,
  wordFrequencySettings
}) => {
  const tools: Tab<MetricsTool>[] = [
    { id: 'prose_stats', label: 'Prose Statistics' },
    { id: 'style_flags', label: 'Style Flags' },
    { id: 'word_frequency', label: 'Word Frequency' }
  ];

  const handlePresetChange = (value: string) => {
    publishingSettings.setPublishingPreset(value);
  };

  const handleTrimChange = (value: string) => {
    publishingSettings.setPublishingTrim(value);
  };

  const handleCopyMetricsResult = (content: string) => {
    vscode.postMessage({
      type: MessageType.COPY_RESULT,
      source: 'webview.metrics.tab',
      payload: {
        toolName: metrics.activeTool,
        content
      },
      timestamp: Date.now()
    });
  };

  const handleSaveMetricsResult = (content: string) => {
    vscode.postMessage({
      type: MessageType.SAVE_RESULT,
      source: 'webview.metrics.tab',
      payload: {
        toolName: metrics.activeTool,
        content,
        metadata: { timestamp: Date.now() }
      },
      timestamp: Date.now()
    });
  };

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Metrics</h2>
      {/* Sub‑tab bar (moved above Scope) */}
      <TabBar
        tabs={tools}
        activeTab={metrics.activeTool}
        onTabChange={metrics.setActiveTool}
        ariaLabel="Metrics tools"
        disabled={metrics.loading}
      />

      <ScopeBox
        mode={metrics.sourceMode}
        pathText={metrics.pathText}
        onModeChange={(mode) => {
          metrics.setSourceMode(mode);
          if (mode === 'selection') {
            metrics.setPathText('[selected text]');
          }
        }}
        onPathTextChange={(text) => metrics.setPathText(text)}
        vscode={vscode}
        source="webview.metrics.tab"
        disabled={metrics.loading}
        pathInputId="pm-path-input"
        pathPlaceholder={metrics.sourceMode === 'selection' ? '[selected text]' : 'workspace-relative path or globs'}
      />

      {/* Publishing Standards: only for Prose Statistics view (moved below Scope for consistency) */}
      <div className="input-container">
        {metrics.activeTool === 'prose_stats' && (
          <>
            <label className="block text-sm font-medium mb-2 mt-3" htmlFor="pm-preset-select">Publishing Standards</label>
            <div className="flex gap-2 mb-2">
              <select
                id="pm-preset-select"
                className="w-1/2"
                value={publishingSettings.publishingPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                title="Select a genre preset or manuscript format to compare metrics against publishing ranges"
                disabled={metrics.loading}
              >
                <option value="none">None</option>
                <option value="manuscript">Manuscript Format</option>
                <optgroup label="Genres">
                  {publishingSettings.publishingGenres.map((g: any) => (
                    <option key={g.key} value={`genre:${g.key}`}>{g.name} ({g.abbreviation})</option>
                  ))}
                </optgroup>
              </select>
              <label className="block text-sm font-medium mb-2" htmlFor="pm-trim-select" style={{position:'absolute',left:'-10000px',width:1,height:1,overflow:'hidden'}}>Trim Size</label>
              <select
                id="pm-trim-select"
                className="w-1/2"
                value={publishingSettings.publishingTrimKey}
                onChange={(e) => handleTrimChange(e.target.value)}
                title="Choose a trim size to estimate page count and words-per-page"
                disabled={metrics.loading || !publishingSettings.publishingPreset.startsWith('genre:')}
              >
                <option value="">Auto (common size)</option>
                {(publishingSettings.publishingPreset.startsWith('genre:')
                  ? (publishingSettings.publishingGenres.find((g: any) => `genre:${g.key}` === publishingSettings.publishingPreset)?.pageSizes || [])
                  : []
                ).map((ps: any) => (
                  <option key={ps.key} value={ps.key}>{ps.label} ({ps.width}x{ps.height} in)</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Loading indicator */}
      {metrics.loading && (
        <LoadingIndicator
          isLoading={metrics.loading}
          defaultMessage="Calculating metrics..."
        />
      )}

      {/* Route to active panel */}
      {metrics.activeTool === 'prose_stats' && (
        <ProseStatsPanel
          vscode={vscode}
          metrics={metrics}
          onCopy={handleCopyMetricsResult}
          onSave={handleSaveMetricsResult}
        />
      )}

      {metrics.activeTool === 'style_flags' && (
        <StyleFlagsPanel
          vscode={vscode}
          metrics={metrics}
          onCopy={handleCopyMetricsResult}
          onSave={handleSaveMetricsResult}
        />
      )}

      {metrics.activeTool === 'word_frequency' && (
        <WordFrequencyPanel
          vscode={vscode}
          metrics={metrics}
          wordFrequencySettings={wordFrequencySettings}
          onCopy={handleCopyMetricsResult}
          onSave={handleSaveMetricsResult}
        />
      )}
    </div>
  );
};
