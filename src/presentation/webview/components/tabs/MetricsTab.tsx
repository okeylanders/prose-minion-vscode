/**
 * MetricsTab component - Thin orchestrator
 * Routes to focused panel components (ProseStats, StyleFlags, WordFrequency)
 * Refactored from god component to follow Single Responsibility Principle
 */

import * as React from 'react';
import { MessageType } from '@shared/types';
import { ScopeBox } from '../shared';
import { TabBar, Tab } from '../shared/TabBar';
import { ProseStatsPanel } from '../metrics/ProseStatsPanel';
import { StyleFlagsPanel } from '../metrics/StyleFlagsPanel';
import { WordFrequencyPanel } from '../metrics/WordFrequencyPanel';
import { PublishingSelector } from '../metrics/PublishingSelector';
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

export const MetricsTab = React.memo<MetricsTabProps>(({
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
        className="mb-4"
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
      {metrics.activeTool === 'prose_stats' && (
        <PublishingSelector publishingSettings={publishingSettings} disabled={metrics.loading} />
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
});

MetricsTab.displayName = 'MetricsTab';
