/**
 * MetricsTab component - Presentation layer
 * Handles prose metrics and statistics
 */

import * as React from 'react';
import { MessageType } from '@shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingWidget } from './LoadingWidget';
import {
  formatProseStatsAsMarkdown,
  formatStyleFlagsAsMarkdown,
  formatWordFrequencyAsMarkdown
} from '../utils/formatters';
import { WordLengthFilterTabs } from './WordLengthFilterTabs';
import { VSCodeAPI } from '../types/vscode';
import { UseMetricsReturn } from '../hooks/domain/useMetrics';
import { UsePublishingSettingsReturn } from '../hooks/domain/usePublishingSettings';
import { UseWordFrequencySettingsReturn } from '../hooks/domain/useWordFrequencySettings';

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
  // Keep a local mirror only for selection preview if needed in future.

  // Build a TextSourceSpec consistently for all metric requests
  const buildSourceSpec = React.useCallback(() => {
    return metrics.sourceMode === 'selection'
      ? { mode: 'selection' as const, pathText: '[selected text]' }
      : { mode: metrics.sourceMode, pathText: metrics.pathText };
  }, [metrics.sourceMode, metrics.pathText]);

  const handlePresetChange = (value: string) => {
    publishingSettings.setPublishingPreset(value);
  };

  const handleTrimChange = (value: string) => {
    publishingSettings.setPublishingTrim(value);
  };

  const handleFilterChange = (minLength: number) => {
    wordFrequencySettings.updateSetting('minCharacterLength', minLength);
  };

  const handleMeasureProseStats = () => {
    metrics.setLoading(true);
    metrics.clearSubtoolResult('prose_stats');
    vscode.postMessage({
      type: MessageType.MEASURE_PROSE_STATS,
      source: 'webview.metrics.tab',
      payload: {
        source: buildSourceSpec()
      },
      timestamp: Date.now()
    });
  };

  const handleMeasureStyleFlags = () => {
    metrics.setLoading(true);
    metrics.clearSubtoolResult('style_flags');
    vscode.postMessage({
      type: MessageType.MEASURE_STYLE_FLAGS,
      source: 'webview.metrics.tab',
      payload: {
        source: buildSourceSpec()
      },
      timestamp: Date.now()
    });
  };

  const handleMeasureWordFrequency = () => {
    metrics.setLoading(true);
    metrics.clearSubtoolResult('word_frequency');
    vscode.postMessage({
      type: MessageType.MEASURE_WORD_FREQUENCY,
      source: 'webview.metrics.tab',
      payload: {
        source: buildSourceSpec()
      },
      timestamp: Date.now()
    });
  };

  // Prefer per-subtool results from cache
  const displayMetrics = React.useMemo(() => {
    if (metrics.metricsByTool && metrics.metricsByTool[metrics.activeTool]) return metrics.metricsByTool[metrics.activeTool] as any;
    return null;
  }, [metrics.metricsByTool, metrics.activeTool]);

  const markdownContent = React.useMemo(() => {
    if (!displayMetrics) return '';

    // Call the appropriate formatter based on active tool
    switch (metrics.activeTool) {
      case 'prose_stats':
        return formatProseStatsAsMarkdown(displayMetrics);
      case 'style_flags':
        return formatStyleFlagsAsMarkdown(displayMetrics);
      case 'word_frequency':
        return formatWordFrequencyAsMarkdown(displayMetrics);
      default:
        return '';
    }
  }, [displayMetrics, metrics.activeTool]);

  const buildExportContent = React.useCallback(() => {
    let content = markdownContent;

    // Note: Legend is already appended by prose stats and word frequency formatters
    // (includes comprehensive Metrics Guide with Vocabulary Diversity and Lexical Density explainers)

    // Append Chapter Details section (per-chapter pivoted tables) if available
    try {
      const metricsSrc: any = displayMetrics;
      if (metricsSrc && Array.isArray(metricsSrc.perChapterStats) && metricsSrc.perChapterStats.length > 0) {
        let groups = ['---', '', '## Chapter Details', ''].join('\n') + '\n';
        metricsSrc.perChapterStats.forEach((entry: any) => {
          const s = entry.stats || {};
          const chapter = (entry.path || '').split(/\\|\//).pop() || entry.path;

          const rows: Array<{ label: string; value: any; fmt?: (v: any) => string }> = [
            { label: '📝 Word Count', value: s.wordCount, fmt: (v) => (v ?? '').toLocaleString?.() ?? v },
            { label: '📏 Sentence Count', value: s.sentenceCount, fmt: (v) => (v ?? '').toLocaleString?.() ?? v },
            { label: '📑 Paragraph Count', value: s.paragraphCount, fmt: (v) => (v ?? '').toLocaleString?.() ?? v },
            { label: '⚖️ Avg Words per Sentence', value: s.averageWordsPerSentence, fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v },
            { label: '📐 Avg Sentences per Paragraph', value: s.averageSentencesPerParagraph, fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v },
            { label: '⏱️ Reading Time', value: s.readingTime },
            { label: '🎯 Pacing', value: s.pacing },
            { label: '💬 Dialogue Percentage', value: s.dialoguePercentage, fmt: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
            { label: '🎨 Lexical Density', value: s.lexicalDensity, fmt: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
            { label: '🧹 Stopword Ratio', value: s.stopwordRatio, fmt: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
            { label: '🌱 Hapax %', value: s.hapaxPercent, fmt: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
            { label: '🌱 Hapax Count', value: s.hapaxCount, fmt: (v) => (v ?? '').toLocaleString?.() ?? v },
            { label: '🔀 Type-Token Ratio', value: s.typeTokenRatio, fmt: (v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
            { label: '📖 Readability Score', value: s.readabilityScore, fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v },
            { label: '🎓 Readability Grade (FKGL)', value: s.readabilityGrade, fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v },
            { label: '🔎 Unique Words', value: s.uniqueWordCount, fmt: (v) => (v ?? '').toLocaleString?.() ?? v },
            { label: '⏳ Reading Time (min)', value: s.readingTimeMinutes, fmt: (v) => typeof v === 'number' ? v.toFixed(1) : v }
          ];

          const lines: string[] = [`### ${chapter}`, '', '| Metric | Value |', '|:-------|------:|'];
          rows.forEach(({ label, value, fmt }) => {
            if (value === undefined || value === null || (typeof value === 'string' && value.length === 0)) return;
            const display = fmt ? fmt(value) : value;
            lines.push(`| ${label} | **${display}** |`);
          });
          lines.push('');
          groups += lines.join('\n') + '\n';
        });
        content += groups;
      }
    } catch {
      // ignore
    }

    return content;
  }, [markdownContent, displayMetrics]);

  const handleCopyMetricsResult = () => {
    const content = buildExportContent();
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

  const handleSaveMetricsResult = () => {
    const content = buildExportContent();
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
      <div className="tab-bar" style={{ marginBottom: '8px' }}>
        <button
          className={`tab-button ${metrics.activeTool === 'prose_stats' ? 'active' : ''}`}
          disabled={metrics.loading}
          onClick={() => metrics.setActiveTool('prose_stats')}
        >
          <span className="tab-label">Prose Statistics</span>
        </button>
        <button
          className={`tab-button ${metrics.activeTool === 'style_flags' ? 'active' : ''}`}
          disabled={metrics.loading}
          onClick={() => metrics.setActiveTool('style_flags')}
        >
          <span className="tab-label">Style Flags</span>
        </button>
        <button
          className={`tab-button ${metrics.activeTool === 'word_frequency' ? 'active' : ''}`}
          disabled={metrics.loading}
          onClick={() => metrics.setActiveTool('word_frequency')}
        >
          <span className="tab-label">Word Frequency</span>
        </button>
      </div>

      <div className="input-container">
        <label className="block text-sm font-medium mb-2">Scope:</label>
        <div className="tab-bar" style={{ marginBottom: '8px' }}>
          <button
            className={`tab-button ${metrics.sourceMode === 'activeFile' ? 'active' : ''}`}
          onClick={() => {
            metrics.setSourceMode('activeFile');
            vscode.postMessage({
              type: MessageType.REQUEST_ACTIVE_FILE,
              source: 'webview.metrics.tab',
              payload: {},
              timestamp: Date.now()
            });
          }}
            disabled={metrics.loading}
          >
            <span className="tab-label">Active File</span>
          </button>
          <button
            className={`tab-button ${metrics.sourceMode === 'manuscript' ? 'active' : ''}`}
          onClick={() => {
            metrics.setSourceMode('manuscript');
            vscode.postMessage({
              type: MessageType.REQUEST_MANUSCRIPT_GLOBS,
              source: 'webview.metrics.tab',
              payload: {},
              timestamp: Date.now()
            });
          }}
            disabled={metrics.loading}
          >
            <span className="tab-label">Manuscripts</span>
          </button>
          <button
            className={`tab-button ${metrics.sourceMode === 'chapters' ? 'active' : ''}`}
          onClick={() => {
            metrics.setSourceMode('chapters');
            vscode.postMessage({
              type: MessageType.REQUEST_CHAPTER_GLOBS,
              source: 'webview.metrics.tab',
              payload: {},
              timestamp: Date.now()
            });
          }}
            disabled={metrics.loading}
          >
            <span className="tab-label">Chapters</span>
          </button>
          <button
            className={`tab-button ${metrics.sourceMode === 'selection' ? 'active' : ''}`}
            onClick={() => {
              metrics.setSourceMode('selection');
              metrics.setPathText('[selected text]');
            }}
            disabled={metrics.loading}
          >
            <span className="tab-label">Selection</span>
          </button>
        </div>

        <label className="block text-sm font-medium mb-2" htmlFor="pm-path-input">Path / Pattern</label>
        <input
          id="pm-path-input"
          className="w-full"
          type="text"
          value={metrics.pathText}
          onChange={(e) => metrics.setPathText(e.target.value)}
          placeholder={metrics.sourceMode === 'selection' ? '[selected text]' : 'workspace-relative path or globs'}
        />

        {/* Publishing Standards: only for Prose Statistics view (moved below Scope for consistency) */}
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

      {/* Word Length Filter: only for Word Frequency view */}
      {metrics.activeTool === 'word_frequency' && (
        <WordLengthFilterTabs
          activeFilter={wordFrequencySettings.settings.minCharacterLength}
          onFilterChange={handleFilterChange}
          disabled={metrics.loading}
        />
      )}

      {/* Explicit Generate buttons per sub-tool */}
      <div className="button-group">
        {metrics.activeTool === 'prose_stats' && (
          <button className="btn btn-primary" onClick={handleMeasureProseStats} disabled={metrics.loading}>
            ⚙️ Generate Prose Statistics
          </button>
        )}
        {metrics.activeTool === 'style_flags' && (
          <button className="btn btn-primary" onClick={handleMeasureStyleFlags} disabled={metrics.loading}>
            🏁 Generate Style Flags
          </button>
        )}
        {metrics.activeTool === 'word_frequency' && (
          <button className="btn btn-primary" onClick={handleMeasureWordFrequency} disabled={metrics.loading}>
            📈 Generate Word Frequency
          </button>
        )}
      </div>

      {metrics.loading && (
        <div className="loading-indicator">
          <div className="loading-header">
            <div className="spinner"></div>
            <div className="loading-text">
              <div>{'Calculating metrics...'}</div>
            </div>
          </div>
          <LoadingWidget />
        </div>
      )}

      {markdownContent && (
        <div className="result-box">
          <div className="result-action-bar">
            {/* include chapters preference handled via extension modal prompts */}
            <button
              className="icon-button"
              onClick={handleCopyMetricsResult}
              disabled={metrics.loading}
              title="Copy metrics to clipboard"
              aria-label="Copy metrics"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveMetricsResult}
              disabled={metrics.loading}
              title="Save metrics to workspace"
              aria-label="Save metrics"
            >
              💾
            </button>
          </div>
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
      {/* No Word Search placeholder here; handled in Search tab */}
    </div>
  );
};

// parseTargets moved to SearchTab
