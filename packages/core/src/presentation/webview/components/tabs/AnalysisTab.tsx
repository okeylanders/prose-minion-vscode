/**
 * AnalysisTab component - Presentation layer
 * Handles dialogue and prose analysis ( Prose Excerpt Assistant )
 */

import * as React from 'react';
import { SelectionTarget, MessageType, DialogueFocus, WritingToolsFocus } from '@shared/types';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { WordCounter } from '../shared/WordCounter';
import { StreamingContent } from '../shared/StreamingContent';
import { Icon } from '../shared/Icon';
import { AllToolsModal } from './AllToolsModal';
import { formatAnalysisAsMarkdown } from '../../utils/formatters';
import { VSCodeAPI } from '../../types/vscode';
import { UseAnalysisReturn } from '../../hooks/domain/useAnalysis';
import { UseContextReturn } from '../../hooks/domain/useContext';
import { UseSelectionReturn } from '../../hooks/domain/useSelection';
import { UseModelsSettingsReturn } from '../../hooks/domain/useModelsSettings';
import { UseSettingsReturn } from '../../hooks/domain/useSettings';

interface AnalysisTabProps {
  vscode: VSCodeAPI;
  analysis: UseAnalysisReturn;
  context: UseContextReturn;
  selection: UseSelectionReturn;
  modelsSettings: UseModelsSettingsReturn;
  settings: UseSettingsReturn;
}

export const AnalysisTab = React.memo<AnalysisTabProps>(({
  vscode,
  analysis,
  context,
  selection,
  modelsSettings,
  settings
}) => {
  const [text, setText] = React.useState(selection.selectedText);
  const [showContextPreview, setShowContextPreview] = React.useState(false);
  const [contextFlash, setContextFlash] = React.useState(false);
  const [showAllTools, setShowAllTools] = React.useState(false);
  const wasStreamingRef = React.useRef(false);

  // Flash context box when streaming completes
  React.useEffect(() => {
    if (wasStreamingRef.current && !context.isStreaming && !context.loading) {
      setContextFlash(true);
      const timeout = setTimeout(() => setContextFlash(false), 600);
      return () => clearTimeout(timeout);
    }
    wasStreamingRef.current = context.isStreaming;
  }, [context.isStreaming, context.loading]);

  // Sync local text state from selection
  const syncTextFromSelection = React.useCallback(() => {
    setText(selection.selectedText);
  }, [selection.selectedText]);

  React.useEffect(() => {
    syncTextFromSelection();
  }, [syncTextFromSelection]);

  const sourceReference = React.useMemo(() => {
    if (selection.selectedRelativePath && selection.selectedRelativePath.trim().length > 0) {
      return selection.selectedRelativePath;
    }

    if (selection.selectedSourceUri && selection.selectedSourceUri.trim().length > 0) {
      return selection.selectedSourceUri;
    }

    return undefined;
  }, [selection.selectedRelativePath, selection.selectedSourceUri]);

  const lastSubmissionRef = React.useRef<{
    toolName: string;
    excerpt: string;
    context: string;
    sourceUri?: string;
    relativePath?: string;
  } | null>(null);

  const canCopyAnalysis = Boolean(analysis.result && analysis.result.trim().length > 0);
  const canSaveAnalysis = Boolean(
    analysis.result && analysis.result.trim().length > 0 && (analysis.toolName || lastSubmissionRef.current?.toolName)
  );

  const handleAnalyzeDialogue = (focus: DialogueFocus = 'both') => {
    if (!text.trim()) {
      return;
    }

    analysis.setLoading(true);

    lastSubmissionRef.current = {
      toolName: 'dialogue_analysis',
      excerpt: text,
      context: context.contextText,
      sourceUri: selection.selectedSourceUri,
      relativePath: selection.selectedRelativePath
    };

    vscode.postMessage({
      type: MessageType.ANALYZE_DIALOGUE,
      source: 'webview.analysis.tab',
      payload: {
        text,
        contextText: context.contextText && context.contextText.trim().length > 0 ? context.contextText : undefined,
        sourceFileUri: sourceReference,
        focus
      },
      timestamp: Date.now()
    });
  };

  const handleAnalyzeWritingTools = (focus: WritingToolsFocus) => {
    if (!text.trim()) {
      return;
    }

    analysis.setLoading(true);

    lastSubmissionRef.current = {
      toolName: `writing_tools_${focus}`,
      excerpt: text,
      context: context.contextText,
      sourceUri: selection.selectedSourceUri,
      relativePath: selection.selectedRelativePath
    };

    vscode.postMessage({
      type: MessageType.ANALYZE_WRITING_TOOLS,
      source: 'webview.analysis.tab',
      payload: {
        text,
        contextText: context.contextText && context.contextText.trim().length > 0 ? context.contextText : undefined,
        sourceFileUri: sourceReference,
        focus
      },
      timestamp: Date.now()
    });
  };

  const handleAnalyzeProse = () => {
    if (!text.trim()) {
      return;
    }

    analysis.setLoading(true);

    lastSubmissionRef.current = {
      toolName: 'prose_analysis',
      excerpt: text,
      context: context.contextText,
      sourceUri: selection.selectedSourceUri,
      relativePath: selection.selectedRelativePath
    };

    vscode.postMessage({
      type: MessageType.ANALYZE_PROSE,
      source: 'webview.analysis.tab',
      payload: {
        text,
        contextText: context.contextText && context.contextText.trim().length > 0 ? context.contextText : undefined,
        sourceFileUri: sourceReference
      },
      timestamp: Date.now()
    });
  };

  const handleGenerateContext = () => {
    if (!text.trim() || context.loading) {
      return;
    }

    context.requestContext({
      excerpt: text,
      existingContext: context.contextText,
      sourceFileUri: sourceReference
    });
  };

  const handlePasteExcerpt = React.useCallback(() => {
    selection.requestSelection('assistant_excerpt');
  }, [selection]);

  const handlePasteContext = React.useCallback(() => {
    selection.requestSelection('assistant_context');
  }, [selection]);

  /**
   * Handle native Ctrl/Cmd+V paste in excerpt textarea.
   * Requests the current editor selection and compares with pasted text.
   * If they match, applies source metadata; otherwise clears it.
   */
  const handleExcerptNativePaste = React.useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');

    // Validate and sanitize clipboard content
    const MAX_EXCERPT_LENGTH = 100000; // 100KB reasonable limit
    if (!pastedText?.trim()) return;

    const sanitizedText = pastedText.trim().slice(0, MAX_EXCERPT_LENGTH);
    if (pastedText.length > MAX_EXCERPT_LENGTH) {
      console.warn(`[AnalysisTab] Pasted text truncated from ${pastedText.length} to ${MAX_EXCERPT_LENGTH} chars`);
    }

    // Request current editor selection for verification
    // The response handler will compare and apply source if match
    selection.requestSelectionVerify(sanitizedText);
  }, [selection]);

  const handleCancelAnalysisStreaming = React.useCallback(() => {
    if (analysis.currentRequestId) {
      vscode.postMessage({
        type: MessageType.CANCEL_ANALYSIS_REQUEST,
        source: 'webview.analysis.tab',
        payload: {
          requestId: analysis.currentRequestId,
          domain: 'analysis'
        },
        timestamp: Date.now()
      });
    }
    analysis.cancelStreaming();
  }, [analysis, vscode]);

  const handleCancelContextStreaming = React.useCallback(() => {
    if (context.currentRequestId) {
      vscode.postMessage({
        type: MessageType.CANCEL_CONTEXT_REQUEST,
        source: 'webview.analysis.tab',
        payload: {
          requestId: context.currentRequestId,
          domain: 'context'
        },
        timestamp: Date.now()
      });
    }
    context.cancelStreaming();
  }, [context, vscode]);

  const handleCopyAnalysisResult = () => {
    if (!analysis.result) {
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
      (submission?.context ?? context.contextText) || '(No context provided.)',
      '',
      '---',
      '',
      analysis.result
    ].join('\n');

    vscode.postMessage({
      type: MessageType.COPY_RESULT,
      source: 'webview.analysis.tab',
      payload: {
        toolName: analysis.toolName ?? (submission?.toolName ?? 'analysis_result'),
        content: clipboardPayload
      },
      timestamp: Date.now()
    });
  };

  const handleSaveAnalysisResult = () => {
    if (!analysis.result) {
      return;
    }

    const submission = lastSubmissionRef.current;

    vscode.postMessage({
      type: MessageType.SAVE_RESULT,
      source: 'webview.analysis.tab',
      payload: {
        toolName: analysis.toolName ?? submission?.toolName ?? 'analysis_result',
        content: analysis.result,
        metadata: {
          excerpt: submission?.excerpt ?? text,
          context: submission?.context ?? context.contextText,
          sourceFileUri: submission?.sourceUri ?? selection.selectedSourceUri,
          relativePath: submission?.relativePath ?? selection.selectedRelativePath,
          timestamp: Date.now()
        }
      },
      timestamp: Date.now()
    });
  };

  const markdownContent = React.useMemo(() => {
    if (!analysis.result) return '';
    return formatAnalysisAsMarkdown(analysis.result);
  }, [analysis.result]);

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Excerpt Assistant</h2>

      <div className="input-container">
        <div className="input-header">
          <label className="text-sm font-medium">
            Excerpt For Assistance &amp; Analysis
          </label>
          <button
            className="icon-button"
            onClick={handlePasteExcerpt}
            title="Paste excerpt from selection"
            aria-label="Paste excerpt"
          >
            <Icon name="clipboard" size={16} />
          </button>
        </div>
        {selection.selectedRelativePath && (
          <div className="excerpt-meta">Source: {selection.selectedRelativePath}</div>
        )}
        <textarea
          className="w-full h-32 resize-none"
          value={text}
          onChange={(e) => {
            const val = e.target.value;
            setText(val);
            if (!val.trim()) {
              selection.setSelectedSourceUri('');
              selection.setSelectedRelativePath('');
            }
          }}
          onPaste={handleExcerptNativePaste}
          placeholder="Select text in your editor or paste text here..."
        />
        <WordCounter
          text={text}
          maxWords={2000}
          warningMessage="Large excerpt"
        />
      </div>

      <div className="input-container">
        <div className="input-header context-assist-header">
          <label className="text-sm font-medium">
            Context Brief (optional)
          </label>
          <div className="input-header-actions">
            <button
              className="context-assist-button"
              onClick={handleGenerateContext}
              disabled={context.loading || context.isStreaming || !text.trim()}
              title="Let the context assistant build a briefing"
              aria-label="Generate context with assistant"
            >
              {context.loading || context.isStreaming ? (
                <div className="spinner spinner-small"></div>
              ) : (
                <Icon name="bot" size={16} />
              )}
            </button>
            <button
              className="icon-button"
              onClick={handlePasteContext}
              title="Paste context from selection"
              aria-label="Paste context"
            >
              <Icon name="clipboard" size={16} />
            </button>
          </div>
        </div>
        <textarea
          className={`w-full h-28 resize-none${contextFlash ? ' context-flash' : ''}`}
          value={context.contextText}
          onChange={(e) => context.setContextText(e.target.value)}
          placeholder="Summaries, goals, tone targets, or notes that help the AI stay grounded..."
        />
        {showContextPreview && context.contextText.trim() && (
          <div className="context-preview">
            <MarkdownRenderer content={context.contextText} />
          </div>
        )}
        <div className="context-meta-row">
          <WordCounter
            text={context.contextText}
            maxWords={5000}
            warningWords={1000}
            warningMessage="Large Context"
            showMax={false}
          />
          {context.contextText.trim() && (
            <button
              type="button"
              className="context-preview-toggle"
              onClick={() => setShowContextPreview(prev => !prev)}
              title={showContextPreview ? 'Hide formatted preview' : 'Show formatted preview'}
              aria-label="Toggle context preview"
            >
              <span className="preview-toggle-chevron">{showContextPreview ? '▼' : '▲'}</span>
              <span className="preview-toggle-text">{showContextPreview ? 'hide' : 'show'} formatted</span>
            </button>
          )}
          {modelsSettings.modelSelections.context && (
            <span className="model-indicator">
              <span className="model-label">Context Model:</span>
              <span className="model-name">{modelsSettings.modelSelections.context}</span>
              <span
                className="model-settings-link"
                onClick={settings.open}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    settings.open();
                  }
                }}
                title="Change context model in Settings"
              >
                ⚙️
              </span>
            </span>
          )}
        </div>
        {context.isStreaming && (
          <StreamingContent
            content={context.streamingContent}
            isStreaming={context.isStreaming}
            isBuffering={context.isBuffering}
            chunkCount={context.streamingChunkCount}
            elapsedMs={context.streamingElapsedMs}
            initialLatencyMs={context.streamingInitialLatencyMs}
            chunksPerSecond={context.streamingChunksPerSecond}
            onCancel={context.currentRequestId ? handleCancelContextStreaming : undefined}
            cancelDisabled={!context.currentRequestId}
            className="context-streaming"
          />
        )}
        {(context.statusMessage && context.loading && !context.isStreaming) && (
          <div className="context-status">{context.statusMessage}</div>
        )}
        {context.requestedResources && context.requestedResources.length > 0 && (
          <div className="context-resource-summary">
            <div className="context-resource-title">Resources referenced:</div>
            <div className="context-resource-list">
              {context.requestedResources.map((path: string, index: number) => {
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

      <div className="analysis-buttons-section">
        <div className="analysis-buttons-head">
          <h4 className="analysis-section-header">Analyze &amp; Suggest Improvements</h4>
          <button
            className="btn ghost all-tools-button"
            onClick={() => setShowAllTools(true)}
            disabled={!text.trim() || analysis.loading || analysis.isStreaming}
            title="Browse every writing tool"
          >
            <Icon name="grid" size={14} /> All tools
          </button>
        </div>
        <div className="primary-buttons">
          <button
            className="action-button primary"
            onClick={() => handleAnalyzeDialogue('both')}
            disabled={!text.trim() || analysis.loading || analysis.isStreaming}
          >
            <Icon name="dialogue" size={15} /> Dialogue &amp; Beats
          </button>
          <button
            className="action-button primary"
            onClick={handleAnalyzeProse}
            disabled={!text.trim() || analysis.loading || analysis.isStreaming}
          >
            <Icon name="pen" size={15} /> Prose
          </button>
          <button
            className="action-button primary"
            onClick={() => handleAnalyzeWritingTools('gestures')}
            disabled={!text.trim() || analysis.loading || analysis.isStreaming}
          >
            <Icon name="hand" size={15} /> Gestures
          </button>
        </div>
      </div>

      <AllToolsModal
        open={showAllTools}
        disabled={!text.trim() || analysis.loading || analysis.isStreaming}
        onClose={() => setShowAllTools(false)}
        onDialogue={handleAnalyzeDialogue}
        onProse={handleAnalyzeProse}
        onWritingTool={handleAnalyzeWritingTools}
      />

      {analysis.isStreaming && (
        <StreamingContent
          content={analysis.streamingContent}
          isStreaming={analysis.isStreaming}
          isBuffering={analysis.isBuffering}
          chunkCount={analysis.streamingChunkCount}
          elapsedMs={analysis.streamingElapsedMs}
          initialLatencyMs={analysis.streamingInitialLatencyMs}
          chunksPerSecond={analysis.streamingChunksPerSecond}
          onCancel={analysis.currentRequestId ? handleCancelAnalysisStreaming : undefined}
          cancelDisabled={!analysis.currentRequestId}
        />
      )}

      {analysis.loading && !analysis.isStreaming && (
        <LoadingIndicator
          isLoading={analysis.loading}
          statusMessage={analysis.statusMessage}
          defaultMessage="Analyzing..."
          tickerMessage={analysis.tickerMessage}
        />
      )}

      {analysis.result && !analysis.isStreaming && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyAnalysisResult}
              disabled={!canCopyAnalysis}
              title="Copy analysis to clipboard"
              aria-label="Copy analysis"
            >
              <Icon name="copy" size={14} />
            </button>
            <button
              className="icon-button"
              onClick={handleSaveAnalysisResult}
              disabled={!canSaveAnalysis}
              title="Save analysis to workspace"
              aria-label="Save analysis"
            >
              <Icon name="save" size={14} />
            </button>
          </div>
          <ErrorBoundary
            fallback={<pre className="markdown-fallback">{markdownContent}</pre>}
            onError={(error) => {
              vscode.postMessage({
                type: MessageType.WEBVIEW_ERROR,
                source: 'webview.markdown_renderer',
                payload: { message: error.message },
                timestamp: Date.now()
              });
            }}
          >
            <MarkdownRenderer content={markdownContent} />
          </ErrorBoundary>
          {analysis.usedGuides && analysis.usedGuides.length > 0 && (
            <div className="guides-footer">
              <div className="guides-footer-title">📚 Guides Used:</div>
              <div className="guides-footer-list">
                {analysis.usedGuides.map((guide: string, index: number) => {
                  const displayName = guide
                    .split('/')
                    .pop()
                    ?.replace(/\.md$/i, '')
                    .split('-')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
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
});

AnalysisTab.displayName = 'AnalysisTab';
