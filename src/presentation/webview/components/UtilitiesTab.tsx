/**
 * UtilitiesTab component - Presentation layer
 * Handles dictionary lookups powered by AI
 */

import * as React from 'react';
import { SelectionTarget, MessageType } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingWidget } from './LoadingWidget';
import { formatAnalysisAsMarkdown } from '../utils/resultFormatter';

interface UtilitiesTabProps {
  selectedText: string;
  vscode: any;
  result: string;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  statusMessage?: string;
  toolName?: string;
  dictionaryInjection?: { word?: string; context?: string; sourceUri?: string; relativePath?: string; timestamp: number } | null;
  onDictionaryInjectionHandled: () => void;
  onRequestSelection: (target: SelectionTarget) => void;
  word: string;
  context: string;
  onWordChange: (value: string) => void;
  onContextChange: (value: string) => void;
  hasWordBeenEdited: boolean;
  setHasWordBeenEdited: (edited: boolean) => void;
  sourceUri?: string;
  relativePath?: string;
  onSourceChange: (uri?: string, relativePath?: string) => void;
}

export const UtilitiesTab: React.FC<UtilitiesTabProps> = ({
  selectedText,
  vscode,
  result,
  isLoading,
  onLoadingChange,
  statusMessage,
  toolName,
  dictionaryInjection,
  onDictionaryInjectionHandled,
  onRequestSelection,
  word,
  context,
  onWordChange,
  onContextChange,
  hasWordBeenEdited,
  setHasWordBeenEdited,
  sourceUri,
  relativePath,
  onSourceChange
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
    if (!dictionaryInjection) {
      return;
    }

    if (dictionaryInjection.word !== undefined) {
      const sanitized = enforceWordLimit(dictionaryInjection.word);
      onWordChange(sanitized);
      setHasWordBeenEdited(false);
    }

    if (dictionaryInjection.context !== undefined) {
      onContextChange(dictionaryInjection.context);
    }

    // If injection has source metadata, set it; otherwise clear
    if (dictionaryInjection.sourceUri || dictionaryInjection.relativePath) {
      onSourceChange(dictionaryInjection.sourceUri, dictionaryInjection.relativePath);
    } else {
      onSourceChange(undefined, undefined);
    }

    onDictionaryInjectionHandled();
  }, [dictionaryInjection, enforceWordLimit, onDictionaryInjectionHandled]);

  React.useEffect(() => {
    const trimmed = selectedText.trim();
    if (!trimmed || hasWordBeenEdited || (word && word.trim().length > 0)) {
      return;
    }

    const tokens = trimmed.split(/\s+/);
    const sanitizedTokens = tokens
      .map(token => token.replace(/^[^A-Za-z'-]+|[^A-Za-z'-]+$/g, ''))
      .filter(Boolean);

    if (sanitizedTokens.length === 0) {
      return;
    }

    const candidate = enforceWordLimit(sanitizedTokens.join(' '));
    if (candidate) {
      onWordChange(candidate);
    }
  }, [selectedText, hasWordBeenEdited, word, enforceWordLimit, onWordChange]);

  const handleLookup = () => {
    const sanitizedWord = enforceWordLimit(word);
    if (!sanitizedWord) {
      return;
    }

    onLoadingChange(true);

    lastLookupRef.current = {
      word: sanitizedWord,
      context: context.trim()
    };

    vscode.postMessage({
      type: MessageType.LOOKUP_DICTIONARY,
      word: sanitizedWord,
      contextText: context.trim() || undefined
    });
  };

  const handleWordChange = (value: string) => {
    const sanitized = enforceWordLimit(value);
    onWordChange(sanitized);
    // Mark as user-edited even when cleared, to prevent auto-fill
    setHasWordBeenEdited(true);
  };

  const handlePasteWord = React.useCallback(() => {
    onRequestSelection('dictionary_word');
  }, [onRequestSelection]);

  const handlePasteContext = React.useCallback(() => {
    onRequestSelection('dictionary_context');
  }, [onRequestSelection]);

  const markdownContent = React.useMemo(() => {
    if (!result) return '';
    return formatAnalysisAsMarkdown(result);
  }, [result]);

  const handleCopyDictionaryResult = () => {
    if (!result) {
      return;
    }

    const metadata = lastLookupRef.current ?? {
      word: enforceWordLimit(word),
      context: context.trim()
    };

    const header = `# ${metadata.word || enforceWordLimit(word) || 'Entry'}`;

    vscode.postMessage({
      type: MessageType.COPY_RESULT,
      toolName: toolName ?? 'dictionary_lookup',
      content: [header, '', result].join('\n')
    });
  };

  const handleSaveDictionaryResult = () => {
    if (!result) {
      return;
    }

    const metadata = lastLookupRef.current ?? {
      word: enforceWordLimit(word),
      context: context.trim()
    };

    const header = `# ${metadata.word || enforceWordLimit(word) || 'Entry'}`;

    vscode.postMessage({
      type: MessageType.SAVE_RESULT,
      toolName: toolName ?? 'dictionary_lookup',
      content: [header, '', result].join('\n'),
      metadata: {
        word: metadata.word,
        context: metadata.context,
        timestamp: Date.now()
      }
    });
  };

  const canCopyDictionary = Boolean(result && result.trim().length > 0);
  const canSaveDictionary = Boolean(canCopyDictionary && (toolName ?? 'dictionary_lookup'));

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
        {relativePath && (
          <div className="excerpt-meta">Source: {relativePath}</div>
        )}
        <input
          className="w-full"
          type="text"
          value={word}
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
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="Paste a sentence, paragraph, or notes to guide the dictionary output..."
        />
      </div>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleLookup}
          disabled={!word.trim() || isLoading}
        >
          Generate Dictionary Entry
        </button>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-header">
            <div className="spinner"></div>
            <div className="loading-text">
              <div>{statusMessage || 'Generating dictionary entry...'}</div>
            </div>
          </div>
          <LoadingWidget />
        </div>
      )}

      {result && (
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
