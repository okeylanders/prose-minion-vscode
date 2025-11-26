/**
 * UtilitiesTab component - Presentation layer
 * Handles dictionary lookups powered by AI
 */

import * as React from 'react';
import { MessageType } from '@shared/types';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
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

  const enforceWordLimit = React.useCallback((value: string): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    const tokens = normalized.split(' ').filter(Boolean);
    return tokens.slice(0, 3).join(' ');
  }, []);

  React.useEffect(() => {
    const injection = selection.dictionaryInjection;
    if (!injection) {
      return;
    }

    if (injection.word !== undefined) {
      const sanitized = enforceWordLimit(injection.word);
      dictionary.setWord(sanitized);
      dictionary.setWordEdited(false);
    }

    if (injection.context !== undefined) {
      dictionary.setContext(injection.context);
    }

    // If injection has source metadata, set it; otherwise clear
    if (injection.sourceUri || injection.relativePath) {
      dictionary.setSource(injection.sourceUri, injection.relativePath);
    } else {
      dictionary.setSource(undefined, undefined);
    }

    // Don't clear injection yet if autoRun is true - let the auto-run effect handle it
    if (!injection.autoRun) {
      selection.handleDictionaryInjectionHandled();
    }
  }, [selection.dictionaryInjection, enforceWordLimit, dictionary, selection]);

  // Auto-run fast dictionary lookup when autoRun flag is set
  // Reads directly from injection to avoid race condition with dictionary state
  React.useEffect(() => {
    const injection = selection.dictionaryInjection;
    if (!injection?.autoRun) {
      return;
    }

    const sanitizedWord = enforceWordLimit(injection.word || '');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.dictionaryInjection]);

  React.useEffect(() => {
    const trimmed = selection.selectedText.trim();
    if (!trimmed || dictionary.wordEdited || (dictionary.word && dictionary.word.trim().length > 0)) {
      return;
    }

    const tokens = trimmed.split(/\s+/);
    const sanitizedTokens = tokens
      .map((token: string) => token.replace(/^[^A-Za-z'-]+|[^A-Za-z'-]+$/g, ''))
      .filter(Boolean);

    if (sanitizedTokens.length === 0) {
      return;
    }

    const candidate = enforceWordLimit(sanitizedTokens.join(' '));
    if (candidate) {
      dictionary.setWord(candidate);
    }
  }, [selection.selectedText, dictionary.wordEdited, dictionary.word, enforceWordLimit, dictionary]);

  const handleLookup = () => {
    const sanitizedWord = enforceWordLimit(dictionary.word);
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
    const sanitizedWord = enforceWordLimit(dictionary.word);
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
      word: enforceWordLimit(dictionary.word),
      context: dictionary.context.trim()
    };

    const header = `# ${metadata.word || enforceWordLimit(dictionary.word) || 'Entry'}`;

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
      word: enforceWordLimit(dictionary.word),
      context: dictionary.context.trim()
    };

    const header = `# ${metadata.word || enforceWordLimit(dictionary.word) || 'Entry'}`;

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
            Target Word
          </label>
          <button
            className="icon-button"
            onClick={handlePasteWord}
            title="Paste word from selection"
            aria-label="Paste word"
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
          placeholder="Enter the word you want to explore..."
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
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
    </div>
  );
};
