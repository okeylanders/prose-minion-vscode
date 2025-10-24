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
  metricsToolName?: string;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  activeTool: 'prose_stats' | 'style_flags' | 'word_frequency' | 'word_search';
  onActiveToolChange: (tool: 'prose_stats' | 'style_flags' | 'word_frequency' | 'word_search') => void;
  wordSearchTargets: string;
  onWordSearchTargetsChange: (value: string) => void;
  sourceMode: TextSourceMode;
  pathText: string;
  onSourceModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  selectedText,
  vscode,
  metrics,
  metricsToolName,
  isLoading,
  onLoadingChange,
  activeTool,
  onActiveToolChange,
  wordSearchTargets,
  onWordSearchTargetsChange,
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
  // Sub-tool state (local only)
  // activeTool and wordSearchTargets persisted in App; defaults handled upstream
  const [wordSearchContextWords, setWordSearchContextWords] = React.useState<number>(7);
  const [wordSearchClusterWindow, setWordSearchClusterWindow] = React.useState<number>(150);
  const [wordSearchMinCluster, setWordSearchMinCluster] = React.useState<number>(3);
  const [wordSearchCaseSensitive, setWordSearchCaseSensitive] = React.useState<boolean>(false);
  const [expandInfo, setExpandInfo] = React.useState<string>('');

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

  // Only show results that match the active sub-tool
  const displayMetrics = React.useMemo(() => {
    if (!metrics || !metricsToolName) return null;
    // toolName strings match our sub-tool ids
    return metricsToolName === activeTool ? metrics : null;
  }, [metrics, metricsToolName, activeTool]);

  const markdownContent = React.useMemo(() => {
    if (!displayMetrics) return '';
    return formatMetricsAsMarkdown(displayMetrics);
  }, [displayMetrics]);

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

      <div>
        <div className="tab-bar" style={{ marginBottom: '8px' }}>
          <button className={`tab-button ${activeTool === 'prose_stats' ? 'active' : ''}`} disabled={isLoading}
            onClick={() => { onActiveToolChange('prose_stats'); handleMeasureProseStats(); }}>
            <span className="tab-label">Prose Statistics</span>
          </button>
          <button className={`tab-button ${activeTool === 'style_flags' ? 'active' : ''}`} disabled={isLoading}
            onClick={() => { onActiveToolChange('style_flags'); handleMeasureStyleFlags(); }}>
            <span className="tab-label">Style Flags</span>
          </button>
          <button className={`tab-button ${activeTool === 'word_frequency' ? 'active' : ''}`} disabled={isLoading}
            onClick={() => { onActiveToolChange('word_frequency'); handleMeasureWordFrequency(); }}>
            <span className="tab-label">Word Frequency</span>
          </button>
          <button className={`tab-button ${activeTool === 'word_search' ? 'active' : ''}`} disabled={isLoading}
            onClick={() => { onActiveToolChange('word_search'); }}>
            <span className="tab-label">Word Search</span>
          </button>
        </div>

        {activeTool === 'word_search' && (
          <div className="input-container">
            <div className="input-header">
              <label className="block text-sm font-medium">Targets (comma or newline separated; phrases allowed)</label>
              <button
                className="icon-button"
                title="Expand word list"
                aria-label="Expand word list"
                onClick={() => setExpandInfo('Auto expand search coming soon')}
              >
                🤖⚡
              </button>
            </div>
            <textarea
              rows={3}
              value={wordSearchTargets}
              onChange={(e) => onWordSearchTargetsChange(e.target.value)}
              placeholder=""
            />
            {expandInfo && (
              <div className="context-status">{expandInfo}</div>
            )}

            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <label className="block text-sm mb-1">Context words</label>
                <input type="number" value={wordSearchContextWords} onChange={(e) => setWordSearchContextWords(parseInt(e.target.value || '7', 10))} />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1">Cluster window</label>
                <input type="number" value={wordSearchClusterWindow} onChange={(e) => setWordSearchClusterWindow(parseInt(e.target.value || '150', 10))} />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1">Min cluster size</label>
                <input type="number" value={wordSearchMinCluster} onChange={(e) => setWordSearchMinCluster(parseInt(e.target.value || '3', 10))} />
              </div>
            </div>
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={wordSearchCaseSensitive} onChange={(e) => setWordSearchCaseSensitive(e.target.checked)} />
                <span className="ml-2">Case sensitive</span>
              </label>
            </div>

            <div className="mt-3">
              <button className="btn btn-primary" disabled={isLoading} onClick={() => {
                onLoadingChange(true);
                const wordsOrPhrases = parseTargets(wordSearchTargets);
                vscode.postMessage({
                  type: MessageType.MEASURE_WORD_SEARCH,
                  source: { mode: sourceMode, pathText },
                  options: {
                    wordsOrPhrases,
                    contextWords: wordSearchContextWords,
                    clusterWindow: wordSearchClusterWindow,
                    minClusterSize: wordSearchMinCluster,
                    caseSensitive: wordSearchCaseSensitive
                  }
                });
              }}>Run Search</button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Calculating metrics...</span>
        </div>
      )}

      {markdownContent && (
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
      {!markdownContent && activeTool === 'word_search' && (
        <div className="placeholder-content text-gray-500">No Word Search results yet. Enter targets and click Run Search.</div>
      )}
    </div>
  );
};

function parseTargets(input: string): string[] {
  if (!input) return [];
  // Split on newlines and commas; trim; drop empty
  const parts = input.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  return parts;
}
