/**
 * UtilitiesTab component - Presentation layer
 * Handles dictionary lookups powered by AI
 */

import * as React from 'react';
import { MessageType } from '@shared/types';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { WordCounter } from '../shared/WordCounter';
import { formatAnalysisAsMarkdown } from '../../utils/formatters';
import { VSCodeAPI } from '../../types/vscode';
import { UseDictionaryReturn } from '../../hooks/domain/useDictionary';
import { UseSelectionReturn } from '../../hooks/domain/useSelection';
import { UseSettingsReturn } from '../../hooks/domain/useSettings';

interface UtilitiesTabProps {
  vscode: VSCodeAPI;
  dictionary: UseDictionaryReturn;
  selection: UseSelectionReturn;
  settings: UseSettingsReturn;
}

export const UtilitiesTab: React.FC<UtilitiesTabProps> = ({
  vscode,
  dictionary,
  selection,
  settings
}) => {
  const lastLookupRef = React.useRef<{ word: string; context: string } | null>(null);

  // Normalize for submission (trim + limit words)
  const normalizePhrase = React.useCallback((value: string): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }
    const tokens = normalized.split(' ').filter(Boolean);
    return tokens.slice(0, 6).join(' ');
  }, []);

  // For typing: allow trailing space, just limit word count
  const enforceWordLimit = React.useCallback((value: string): string => {
    // Normalize multiple spaces to single, but preserve trailing space
    const hasTrailingSpace = value.endsWith(' ');
    const normalized = value.replace(/\s+/g, ' ');
    const tokens = normalized.trim().split(' ').filter(Boolean);

    if (tokens.length === 0) {
      return '';
    }

    const limited = tokens.slice(0, 6).join(' ');
    // Preserve trailing space if user is typing between words
    return hasTrailingSpace && tokens.length < 6 ? limited + ' ' : limited;
  }, []);

  /**
   * Populates dictionary form fields from incoming injection data.
   * - Sets word, context, and source metadata from the injection
   * - If autoRun is false, clears the injection immediately (we're done)
   * - If autoRun is true, leaves injection for the autoRunLookup effect to handle
   */
  const populateDictionaryFromInjection = React.useCallback(() => {
    const injection = selection.dictionaryInjection;
    if (!injection) {
      return;
    }

    if (injection.word !== undefined) {
      const sanitized = normalizePhrase(injection.word);
      dictionary.setWord(sanitized);
      dictionary.setWordEdited(false);
    }

    if (injection.context !== undefined) {
      dictionary.setContext(injection.context);
    }

    if (injection.sourceUri || injection.relativePath) {
      dictionary.setSource(injection.sourceUri, injection.relativePath);
    } else {
      dictionary.setSource(undefined, undefined);
    }

    // Don't clear injection yet if autoRun is true - let autoRunLookup effect handle it
    if (!injection.autoRun) {
      selection.handleDictionaryInjectionHandled();
    }
  }, [selection.dictionaryInjection, normalizePhrase, dictionary, selection]);

  /**
   * Effect: handleInjection
   *
   * Trigger: When dictionaryInjection changes (from paste button or right-click menu)
   *
   * Purpose: Populates the dictionary form fields from incoming injection data.
   * - Sets word, context, and source metadata from the injection
   * - If autoRun is false, clears the injection immediately (we're done)
   * - If autoRun is true, leaves injection for the autoRunLookup effect to handle
   */
  React.useEffect(() => {
    populateDictionaryFromInjection();
  }, [populateDictionaryFromInjection]);

  /**
   * Automatically triggers fast dictionary lookup from right-click menu.
   * - Reads word directly from injection (not dictionary state) to avoid race condition
   * - Posts FAST_GENERATE_DICTIONARY message to extension
   * - Clears injection after triggering
   *
   * Flow: Right-click "Look Up Word" → extension sends injection with autoRun:true
   *       → handleInjection populates form → this effect fires the API call
   */
  const autoRunLookupWhenInjected = React.useCallback(() => {
    const injection = selection.dictionaryInjection;
    if (!injection?.autoRun) {
      return;
    }

    const sanitizedWord = normalizePhrase(injection.word || '');
    if (!sanitizedWord) {
      // Clear injection even if no word to prevent stuck state
      selection.handleDictionaryInjectionHandled();
      return;
    }

    dictionary.setFastGenerating(true);

    const contextValue = (injection.context || dictionary.context || '').trim();
    lastLookupRef.current = {
      word: sanitizedWord,
      context: contextValue
    };

    vscode.postMessage({
      type: MessageType.FAST_GENERATE_DICTIONARY,
      source: 'webview.utilities.tab',
      payload: {
        word: sanitizedWord,
        context: contextValue || undefined
      },
      timestamp: Date.now()
    });

    // Clear injection after triggering lookup
    selection.handleDictionaryInjectionHandled();
  }, [selection.dictionaryInjection, normalizePhrase, dictionary, selection, vscode]);

  /**
   * Effect: autoRunLookup
   *
   * Trigger: When dictionaryInjection changes AND autoRun flag is true
   *
   * Purpose: Automatically triggers fast dictionary lookup from right-click menu.
   * - Reads word directly from injection (not dictionary state) to avoid race condition
   * - Posts FAST_GENERATE_DICTIONARY message to extension
   * - Clears injection after triggering
   *
   * Flow: Right-click "Look Up Word" → extension sends injection with autoRun:true
   *       → handleInjection populates form → this effect fires the API call
   */
  React.useEffect(() => {
    autoRunLookupWhenInjected();
  }, [autoRunLookupWhenInjected]);

  const handleLookup = () => {
    const sanitizedWord = normalizePhrase(dictionary.word);
    if (!sanitizedWord) {
      return;
    }

    dictionary.setLoading(true);

    lastLookupRef.current = {
      word: sanitizedWord,
      context: dictionary.context.trim()
    };

    vscode.postMessage({
      type: MessageType.LOOKUP_DICTIONARY,
      source: 'webview.utilities.tab',
      payload: {
        word: sanitizedWord,
        contextText: dictionary.context.trim() || undefined
      },
      timestamp: Date.now()
    });
  };

  const handleFastGenerate = () => {
    const sanitizedWord = normalizePhrase(dictionary.word);
    if (!sanitizedWord) {
      return;
    }

    dictionary.setFastGenerating(true);

    lastLookupRef.current = {
      word: sanitizedWord,
      context: dictionary.context.trim()
    };

    vscode.postMessage({
      type: MessageType.FAST_GENERATE_DICTIONARY,
      source: 'webview.utilities.tab',
      payload: {
        word: sanitizedWord,
        context: dictionary.context.trim() || undefined
      },
      timestamp: Date.now()
    });
  };

  const handleWordChange = (value: string) => {
    const sanitized = enforceWordLimit(value);
    dictionary.setWord(sanitized);
    // Mark as user-edited even when cleared, to prevent auto-fill
    dictionary.setWordEdited(true);
  };

  const handlePasteWord = React.useCallback(() => {
    selection.requestSelection('dictionary_word');
  }, [selection]);

  const handlePasteContext = React.useCallback(() => {
    selection.requestSelection('dictionary_context');
  }, [selection]);

  const markdownContent = React.useMemo(() => {
    if (!dictionary.result) return '';
    return formatAnalysisAsMarkdown(dictionary.result);
  }, [dictionary.result]);

  const handleCopyDictionaryResult = () => {
    if (!dictionary.result) {
      return;
    }

    const metadata = lastLookupRef.current ?? {
      word: normalizePhrase(dictionary.word),
      context: dictionary.context.trim()
    };

    const header = `# ${metadata.word || normalizePhrase(dictionary.word) || 'Entry'}`;

    vscode.postMessage({
      type: MessageType.COPY_RESULT,
      source: 'webview.utilities.tab',
      payload: {
        toolName: dictionary.toolName ?? 'dictionary_lookup',
        content: [header, '', dictionary.result].join('\n')
      },
      timestamp: Date.now()
    });
  };

  const handleSaveDictionaryResult = () => {
    if (!dictionary.result) {
      return;
    }

    const metadata = lastLookupRef.current ?? {
      word: normalizePhrase(dictionary.word),
      context: dictionary.context.trim()
    };

    const header = `# ${metadata.word || normalizePhrase(dictionary.word) || 'Entry'}`;

    vscode.postMessage({
      type: MessageType.SAVE_RESULT,
      source: 'webview.utilities.tab',
      payload: {
        toolName: dictionary.toolName ?? 'dictionary_lookup',
        content: [header, '', dictionary.result].join('\n'),
        metadata: {
          word: metadata.word,
          context: metadata.context,
          timestamp: Date.now()
        }
      },
      timestamp: Date.now()
    });
  };

  const canCopyDictionary = Boolean(dictionary.result && dictionary.result.trim().length > 0);
  const canSaveDictionary = Boolean(canCopyDictionary && (dictionary.toolName ?? 'dictionary_lookup'));

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Utilities · Dictionary</h2>

      <div className="input-container">
        <div className="input-header">
          <label className="text-sm font-medium">
            Target Word or Phrase (6 words max)
          </label>
          <button
            className="icon-button"
            onClick={handlePasteWord}
            title="Paste word or phrase from selection"
            aria-label="Paste word or phrase"
          >
            📥
          </button>
        </div>
        {dictionary.relativePath && (
          <div className="excerpt-meta">Source: {dictionary.relativePath}</div>
        )}
        <input
          className="w-full"
          type="text"
          value={dictionary.word}
          onChange={(e) => handleWordChange(e.target.value)}
          placeholder="Enter the word or phrase you want to explore (6 words max)..."
        />
      </div>

      <div className="input-container">
        <div className="input-header">
          <label className="text-sm font-medium">
            Optional Context (helps tailor examples and tone)
          </label>
          <button
            className="icon-button"
            onClick={handlePasteContext}
            title="Paste context from selection"
            aria-label="Paste word context"
          >
            📥
          </button>
        </div>
        <textarea
          className="w-full h-24 resize-none"
          value={dictionary.context}
          onChange={(e) => dictionary.setContext(e.target.value)}
          placeholder="Paste a sentence, paragraph, or notes to guide the dictionary output..."
        />
        <WordCounter
          text={dictionary.context}
          maxWords={500}
          warningMessage="Large excerpt"
        />
      </div>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleLookup}
          disabled={!dictionary.word.trim() || dictionary.loading || dictionary.isFastGenerating}
        >
          Run Dictionary Lookup
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleFastGenerate}
          disabled={!dictionary.word.trim() || dictionary.loading || dictionary.isFastGenerating}
          title="Experimental: Generate using parallel API calls (2-4× faster)"
        >
          ⚡ Experimental: Run Dictionary Lookup [Fast]
        </button>
      </div>

      {dictionary.loading && (
        <LoadingIndicator
          isLoading={dictionary.loading}
          statusMessage={dictionary.statusMessage}
          defaultMessage="Generating dictionary entry..."
        />
      )}

      {dictionary.isFastGenerating && (
        <LoadingIndicator
          isLoading={dictionary.isFastGenerating}
          statusMessage={dictionary.statusMessage}
          defaultMessage="⚡ Fast generating dictionary entry..."
          tickerMessage={dictionary.tickerMessage}
          progress={dictionary.progress ? {
            current: dictionary.progress.current,
            total: dictionary.progress.total,
            label: `Block ${dictionary.progress.current} of ${dictionary.progress.total}`
          } : undefined}
        />
      )}

      {dictionary.result && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyDictionaryResult}
              disabled={!canCopyDictionary}
              title="Copy dictionary entry"
              aria-label="Copy dictionary entry"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveDictionaryResult}
              disabled={!canSaveDictionary}
              title="Save dictionary entry"
              aria-label="Save dictionary entry"
            >
              💾
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
        </div>
      )}
    </div>
  );
};
