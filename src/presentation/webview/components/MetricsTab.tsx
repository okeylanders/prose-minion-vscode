/**
 * MetricsTab component - Presentation layer
 * Handles prose metrics and statistics
 */

import * as React from 'react';
import { MessageType, TextSourceMode } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatMetricsAsMarkdown } from '../utils/metricsFormatter';
// MessageType is already imported from shared/types re-export

interface MetricsTabProps {
  selectedText: string;
  vscode: any;
  metrics: any;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  sourceMode: TextSourceMode;
  pathText: string;
  onSourceModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  selectedText,
  vscode,
  metrics,
  isLoading,
  onLoadingChange,
  sourceMode,
  pathText,
  onSourceModeChange,
  onPathTextChange
}) => {
  // Keep a local mirror only for selection preview if needed in future.

  // Publishing standards UI state
  const [genres, setGenres] = React.useState<Array<{ key: string; name: string; abbreviation: string; pageSizes: Array<{ key: string; label: string; width: number; height: number; common: boolean }> }>>([]);
  const [preset, setPreset] = React.useState<string>('none');
  const [pageSizeKey, setPageSizeKey] = React.useState<string>('');

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'publishing_standards_data') {
        setGenres(msg.genres || []);
        setPreset(msg.preset || 'none');
        setPageSizeKey(msg.pageSizeKey || '');
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA });
    return () => window.removeEventListener('message', handler);
  }, [vscode]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    vscode.postMessage({ type: MessageType.SET_PUBLISHING_PRESET, preset: value });
  };

  const handleTrimChange = (value: string) => {
    setPageSizeKey(value);
    vscode.postMessage({ type: MessageType.SET_PUBLISHING_TRIM_SIZE, pageSizeKey: value });
  };

  const handleMeasureProseStats = () => {
    onLoadingChange(true);
    vscode.postMessage({
      type: MessageType.MEASURE_PROSE_STATS,
      source: { mode: sourceMode, pathText }
    });
  };

  const handleMeasureStyleFlags = () => {
    onLoadingChange(true);
    vscode.postMessage({
      type: MessageType.MEASURE_STYLE_FLAGS,
      source: { mode: sourceMode, pathText }
    });
  };

  const handleMeasureWordFrequency = () => {
    onLoadingChange(true);
    vscode.postMessage({
      type: MessageType.MEASURE_WORD_FREQUENCY,
      source: { mode: sourceMode, pathText }
    });
  };

  const markdownContent = React.useMemo(() => {
    if (!metrics) return '';
    return formatMetricsAsMarkdown(metrics);
  }, [metrics]);

  const buildExportContent = React.useCallback(() => {
    let content = markdownContent;

    // Append legend explaining metrics (export only)
    const legend = [
      '### Legend',
      '',
      '- Word Count: Total tokens split by whitespace.',
      '- Sentence Count: Heuristic split on . ! ?',
      '- Paragraph Count: Blocks split by blank lines.',
      '- Avg Words per Sentence: Average words per sentence.',
      '- Avg Sentences per Paragraph: Average sentences per paragraph.',
      '- Dialogue Percentage: % of tokens inside quotes.',
      '- Lexical Density: % of content words (non-stopwords).',
      '- Stopword Ratio: % tokens in a common English stopword list.',
      '- Hapax %: % tokens occurring exactly once; Hapax Count is absolute count.',
      '- Type-Token Ratio: Unique/total tokens × 100.',
      '- Readability Score: Simplified Flesch Reading Ease (0–100, higher is easier).',
      '- Readability Grade (FKGL): Flesch–Kincaid Grade Level (approximate grade).',
      ''
    ].join('\n');

    content += `\n\n${legend}\n`;

    // Append Chapter Details section (per-chapter pivoted tables) if available
    try {
      if (metrics && Array.isArray(metrics.perChapterStats) && metrics.perChapterStats.length > 0) {
        let groups = ['---', '', '## Chapter Details', ''].join('\n') + '\n';
        metrics.perChapterStats.forEach((entry: any) => {
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
  }, [markdownContent, metrics]);

  const handleCopyMetricsResult = () => {
    const content = buildExportContent();
    vscode.postMessage({
      type: MessageType.COPY_RESULT,
      toolName: 'prose_stats',
      content
    });
  };

  const handleSaveMetricsResult = () => {
    const content = buildExportContent();
    vscode.postMessage({
      type: MessageType.SAVE_RESULT,
      toolName: 'prose_stats',
      content,
      metadata: { timestamp: Date.now() }
    });
  };

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Metrics</h2>

      <div className="input-container">
        <label className="block text-sm font-medium mb-2">Publishing Standards</label>
        <div className="flex gap-2 mb-2">
          <select
            className="w-1/2"
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            title="Select a genre preset or manuscript format to compare metrics against publishing ranges"
            disabled={isLoading}
          >
            <option value="none">None</option>
            <option value="manuscript">Manuscript Format</option>
            <optgroup label="Genres">
              {genres.map(g => (
                <option key={g.key} value={`genre:${g.key}`}>{g.name} ({g.abbreviation})</option>
              ))}
            </optgroup>
          </select>
          <select
            className="w-1/2"
            value={pageSizeKey}
            onChange={(e) => handleTrimChange(e.target.value)}
            title="Choose a trim size to estimate page count and words-per-page"
            disabled={isLoading || !preset.startsWith('genre:')}
          >
            <option value="">Auto (common size)</option>
            {(preset.startsWith('genre:')
              ? (genres.find(g => `genre:${g.key}` === preset)?.pageSizes || [])
              : []
            ).map(ps => (
              <option key={ps.key} value={ps.key}>{ps.label} ({ps.width}x{ps.height} in)</option>
            ))}
          </select>
        </div>

        <label className="block text-sm font-medium mb-2">Measure:</label>
        <div className="tab-bar" style={{ marginBottom: '8px' }}>
          <button
            className={`tab-button ${sourceMode === 'activeFile' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('activeFile');
              vscode.postMessage({ type: MessageType.REQUEST_ACTIVE_FILE });
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Active File</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'manuscript' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('manuscript');
              vscode.postMessage({ type: MessageType.REQUEST_MANUSCRIPT_GLOBS });
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Manuscripts</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'chapters' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('chapters');
              vscode.postMessage({ type: MessageType.REQUEST_CHAPTER_GLOBS });
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Chapters</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'selection' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('selection');
              onPathTextChange('[selected text]');
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Selection</span>
          </button>
        </div>

        <label className="block text-sm font-medium mb-2">Path / Pattern</label>
        <input
          className="w-full"
          type="text"
          value={pathText}
          onChange={(e) => onPathTextChange(e.target.value)}
          placeholder={sourceMode === 'selection' ? '[selected text]' : 'workspace-relative path or globs'}
        />
      </div>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleMeasureProseStats}
          disabled={isLoading}
        >
          Prose Statistics
        </button>
        <button
          className="btn btn-primary"
          onClick={handleMeasureStyleFlags}
          disabled={isLoading}
        >
          Style Flags
        </button>
        <button
          className="btn btn-primary"
          onClick={handleMeasureWordFrequency}
          disabled={isLoading}
        >
          Word Frequency
        </button>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Calculating metrics...</span>
        </div>
      )}

      {metrics && (
        <div className="result-box">
          <div className="result-action-bar">
            {/* include chapters preference handled via extension modal prompts */}
            <button
              className="icon-button"
              onClick={handleCopyMetricsResult}
              disabled={isLoading}
              title="Copy metrics to clipboard"
              aria-label="Copy metrics"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveMetricsResult}
              disabled={isLoading}
              title="Save metrics to workspace"
              aria-label="Save metrics"
            >
              💾
            </button>
          </div>
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
    </div>
  );
};
