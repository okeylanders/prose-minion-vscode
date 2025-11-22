/**
 * ProseStatsPanel - Focused panel for Prose Statistics tool
 * Extracted from MetricsTab to follow Single Responsibility Principle
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { formatProseStatsAsMarkdown } from '@formatters';
import { VSCodeAPI } from '../../types/vscode';

interface ProseStatsPanelProps {
  vscode: VSCodeAPI;
  isLoading: boolean;
  displayMetrics: any;
  sourceSpec: () => { mode: 'selection' | 'activeFile' | 'manuscript' | 'chapters'; pathText: string };
  onMeasure: () => void;
  onCopy: (content: string) => void;
  onSave: (content: string) => void;
}

export const ProseStatsPanel: React.FC<ProseStatsPanelProps> = ({
  vscode,
  isLoading,
  displayMetrics,
  sourceSpec,
  onMeasure,
  onCopy,
  onSave
}) => {
  const markdownContent = React.useMemo(() => {
    if (!displayMetrics) return '';
    return formatProseStatsAsMarkdown(displayMetrics);
  }, [displayMetrics]);

  const buildExportContent = React.useCallback(() => {
    let content = markdownContent;

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

  const handleCopy = () => {
    const content = buildExportContent();
    onCopy(content);
  };

  const handleSave = () => {
    const content = buildExportContent();
    onSave(content);
  };

  return (
    <>
      {/* Generate button */}
      <div className="button-group">
        <button className="btn btn-primary" onClick={onMeasure} disabled={isLoading}>
          ⚙️ Generate Prose Statistics
        </button>
      </div>

      {/* Results */}
      {markdownContent && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopy}
              disabled={isLoading}
              title="Copy metrics to clipboard"
              aria-label="Copy metrics"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSave}
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
    </>
  );
};
