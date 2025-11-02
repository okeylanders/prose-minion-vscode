/**
 * AnalysisTab component - Presentation layer
 * Handles dialogue and prose analysis ( Prose Excerpt Assistant )
 */

import * as React from 'react';
import { SelectionTarget, MessageType } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingWidget } from './LoadingWidget';
import { formatAnalysisAsMarkdown } from '../utils/resultFormatter';

interface AnalysisTabProps {
  selectedText: string;
  vscode: any;
  result: string;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  statusMessage?: string;
  guideNames?: string;
  usedGuides?: string[];
  contextText: string;
  onContextChange: (value: string) => void;
  onContextRequest: (payload: { excerpt: string; existingContext: string; sourceFileUri?: string }) => void;
  contextLoading: boolean;
  contextStatusMessage?: string;
  contextRequestedResources: string[];
  selectedRelativePath?: string;
  selectedSourceUri?: string;
  analysisToolName?: string;
  onRequestSelection: (target: SelectionTarget) => void;
  onClearSourceMeta: () => void;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  selectedText,
  vscode,
  result,
  isLoading,
  onLoadingChange,
  statusMessage,
  guideNames,
  usedGuides,
  contextText,
  onContextChange,
  onContextRequest,
  contextLoading,
  contextStatusMessage,
  contextRequestedResources,
  selectedRelativePath,
  selectedSourceUri,
  analysisToolName,
  onRequestSelection,
  onClearSourceMeta
}) => {
  const [text, setText] = React.useState(selectedText);

  // Word counter for excerpt
  const excerptWordCount = React.useMemo(() => {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, [text]);

  const excerptWordCountColor = React.useMemo(() => {
    if (excerptWordCount >= 500) {
      return 'word-counter-red';
    }
    if (excerptWordCount >= 400) {
      return 'word-counter-yellow';
    }
    return 'word-counter-green';
  }, [excerptWordCount]);

  // Word counter for context brief
  const contextWordCount = React.useMemo(() => {
    if (!contextText || contextText.trim().length === 0) {
      return 0;
    }
    return contextText.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, [contextText]);

  const contextWordCountColor = React.useMemo(() => {
    if (contextWordCount >= 5000) {
      return 'word-counter-red';
    }
    if (contextWordCount >= 1000) {
      return 'word-counter-yellow';
    }
    return 'word-counter-green';
  }, [contextWordCount]);

  React.useEffect(() => {
    setText(selectedText);
  }, [selectedText]);

  const sourceReference = React.useMemo(() => {
    if (selectedRelativePath && selectedRelativePath.trim().length > 0) {
      return selectedRelativePath;
    }

    if (selectedSourceUri && selectedSourceUri.trim().length > 0) {
      return selectedSourceUri;
    }

    return undefined;
  }, [selectedRelativePath, selectedSourceUri]);

  const lastSubmissionRef = React.useRef<{
    toolName: string;
    excerpt: string;
    context: string;
    sourceUri?: string;
    relativePath?: string;
  } | null>(null);

  const canCopyAnalysis = Boolean(result && result.trim().length > 0);
  const canSaveAnalysis = Boolean(
    result && result.trim().length > 0 && (analysisToolName || lastSubmissionRef.current?.toolName)
  );

  const handleAnalyzeDialogue = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    lastSubmissionRef.current = {
      toolName: 'dialogue_analysis',
      excerpt: text,
      context: contextText,
      sourceUri: selectedSourceUri,
      relativePath: selectedRelativePath
    };

    vscode.postMessage({
      type: MessageType.ANALYZE_DIALOGUE,
      source: 'webview.analysis.tab',
      payload: {
        text,
        contextText: contextText && contextText.trim().length > 0 ? contextText : undefined,
        sourceFileUri: sourceReference
      },
      timestamp: Date.now()
    });
  };

  const handleAnalyzeProse = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    lastSubmissionRef.current = {
      toolName: 'prose_analysis',
      excerpt: text,
      context: contextText,
      sourceUri: selectedSourceUri,
      relativePath: selectedRelativePath
    };

    vscode.postMessage({
      type: MessageType.ANALYZE_PROSE,
      source: 'webview.analysis.tab',
      payload: {
        text,
        contextText: contextText && contextText.trim().length > 0 ? contextText : undefined,
        sourceFileUri: sourceReference
      },
      timestamp: Date.now()
    });
  };

  const handleGenerateContext = () => {
    if (!text.trim() || contextLoading) {
      return;
    }

    onContextRequest({
      excerpt: text,
      existingContext: contextText,
      sourceFileUri: sourceReference
    });
  };

  const handlePasteExcerpt = React.useCallback(() => {
    onRequestSelection('assistant_excerpt');
  }, [onRequestSelection]);

  const handlePasteContext = React.useCallback(() => {
    onRequestSelection('assistant_context');
  }, [onRequestSelection]);

  const handleCopyAnalysisResult = () => {
    if (!result) {
      return;
    }

    const submission = lastSubmissionRef.current;
    const clipboardPayload = [
      '# Excerpt',
      '',
      (submission?.excerpt ?? text) || '(No excerpt captured.)',
      '',
      '# Context',
      '',
      (submission?.context ?? contextText) || '(No context provided.)',
      '',
      '---',
      '',
      result
    ].join('\n');

    vscode.postMessage({
      type: MessageType.COPY_RESULT,
      source: 'webview.analysis.tab',
      payload: {
        toolName: analysisToolName ?? (submission?.toolName ?? 'analysis_result'),
        content: clipboardPayload
      },
      timestamp: Date.now()
    });
  };

  const handleSaveAnalysisResult = () => {
    if (!result) {
      return;
    }

    const submission = lastSubmissionRef.current;

    vscode.postMessage({
      type: MessageType.SAVE_RESULT,
      source: 'webview.analysis.tab',
      payload: {
        toolName: analysisToolName ?? submission?.toolName ?? 'analysis_result',
        content: result,
        metadata: {
          excerpt: submission?.excerpt ?? text,
          context: submission?.context ?? contextText,
          sourceFileUri: submission?.sourceUri ?? selectedSourceUri,
          relativePath: submission?.relativePath ?? selectedRelativePath,
          timestamp: Date.now()
        }
      },
      timestamp: Date.now()
    });
  };

  const markdownContent = React.useMemo(() => {
    if (!result) return '';
    return formatAnalysisAsMarkdown(result);
  }, [result]);

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Excerpt Assistant</h2>

      <div className="input-container">
        <div className="input-header">
          <label className="text-sm font-medium">
            Excerpt For Assistance &amp; Analysis
          </label>
          <button
            className="icon-button analysis-paste-button"
            onClick={handlePasteExcerpt}
            title="Paste excerpt from selection"
            aria-label="Paste excerpt"
          >
            📥
          </button>
        </div>
        {selectedRelativePath && (
          <div className="excerpt-meta">Source: {selectedRelativePath}</div>
        )}
        <textarea
          className="w-full h-32 resize-none"
          value={text}
          onChange={(e) => {
            const val = e.target.value;
            setText(val);
            if (!val.trim()) {
              onClearSourceMeta();
            }
          }}
          placeholder="Select text in your editor or paste text here..."
        />
        <div className={`word-counter ${excerptWordCountColor}`}>
          {excerptWordCount} / 500 words
          {excerptWordCount > 500 && ' ⚠️ Large excerpt'}
        </div>
      </div>

      <div className="input-container">
        <div className="input-header context-assist-header">
          <label className="text-sm font-medium">
            Context Brief (optional)
          </label>
          <button
            className="icon-button analysis-paste-button"
            onClick={handlePasteContext}
            title="Paste context from selection"
            aria-label="Paste context"
          >
            📥
          </button>
        </div>
        <div className="context-assist-row">
          <textarea
            className="w-full h-28 resize-none"
            value={contextText}
            onChange={(e) => onContextChange(e.target.value)}
            placeholder="Summaries, goals, tone targets, or notes that help the AI stay grounded..."
          />
          <button
            className="context-assist-button"
            onClick={handleGenerateContext}
            disabled={contextLoading || !text.trim()}
            title="Let the context assistant build a briefing"
            aria-label="Generate context with assistant"
          >
            {contextLoading ? (
              <div className="spinner spinner-small"></div>
            ) : (
              '🤖'
            )}
          </button>
        </div>
        <div className={`word-counter ${contextWordCountColor}`}>
          {contextWordCount} words
          {contextWordCount > 5000 && ' ⚠️ Large Context'}
        </div>
        {(contextStatusMessage && contextLoading) && (
          <div className="context-status">{contextStatusMessage}</div>
        )}
        {contextRequestedResources && contextRequestedResources.length > 0 && (
          <div className="context-resource-summary">
            <div className="context-resource-title">Resources referenced:</div>
            <div className="context-resource-list">
              {contextRequestedResources.map((path, index) => {
                const handleResourceClick = () => {
                  vscode.postMessage({
                    type: MessageType.OPEN_RESOURCE,
                    source: 'webview.analysis.tab',
                    payload: { path },
                    timestamp: Date.now()
                  });
                };

                return (
                  <button
                    key={`${path}-${index}`}
                    className="context-resource-chip clickable"
                    onClick={handleResourceClick}
                    title={`Click to open ${path}`}
                  >
                    {path}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleAnalyzeDialogue}
          disabled={!text.trim() || isLoading}
        >
          Tune Dialog Beat
        </button>
        <button
          className="btn btn-primary"
          onClick={handleAnalyzeProse}
          disabled={!text.trim() || isLoading}
        >
          Tune Prose
        </button>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-header">
            <div className="spinner"></div>
            <div className="loading-text">
              <div>{statusMessage || 'Analyzing...'}</div>
              {guideNames && (
                <div className="guide-ticker-container">
                  <div className="guide-ticker">{guideNames}</div>
                </div>
              )}
            </div>
          </div>
          {/* Shared loading widget with randomized animation */}
          <LoadingWidget />
        </div>
      )}

      {result && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyAnalysisResult}
              disabled={!canCopyAnalysis}
              title="Copy analysis to clipboard"
              aria-label="Copy analysis"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveAnalysisResult}
              disabled={!canSaveAnalysis}
              title="Save analysis to workspace"
              aria-label="Save analysis"
            >
              💾
            </button>
          </div>
          <MarkdownRenderer content={markdownContent} />
          {usedGuides && usedGuides.length > 0 && (
            <div className="guides-footer">
              <div className="guides-footer-title">📚 Guides Used:</div>
              <div className="guides-footer-list">
                {usedGuides.map((guide, index) => {
                  const displayName = guide
                    .split('/')
                    .pop()
                    ?.replace(/\.md$/i, '')
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                  const handleGuideClick = () => {
                    vscode.postMessage({
                      type: MessageType.OPEN_GUIDE_FILE,
                      source: 'webview.analysis.tab',
                      payload: {
                        guidePath: guide
                      },
                      timestamp: Date.now()
                    });
                  };

                  return (
                    <button
                      key={index}
                      className="guide-tag"
                      onClick={handleGuideClick}
                      title={`Click to open ${guide}`}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
