/**
 * UtilitiesTab component - Presentation layer
 * Handles dictionary lookups powered by AI
 */

import * as React from 'react';
import { Icon } from '../shared/Icon';
import { MessageType } from '@shared/types';
import { DictionaryLookupMode, DictionaryLookupRequest, FastGenerateDictionaryMessage, LookupDictionaryMessage } from '@messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { WordCounter } from '../shared/WordCounter';
import { StreamingContent } from '../shared/StreamingContent';
import { DictionaryOptionSwitch } from '@components/dictionary/DictionaryOptionSwitch';
import { DICTIONARY_FENCED_BLOCKS } from '@components/dictionary/ChromaticPaletteBlock';
import { DictionaryHistoryMeta, DictionaryHistoryNav } from '@components/dictionary/DictionaryHistoryNav';
import { DictionaryPriorLookupPrompt } from '@components/dictionary/DictionaryPriorLookupPrompt';
import { DICTIONARY_PHRASE_WORDS, normalizeDictionaryPhrase } from '@utils/dictionaryHistoryNavigation';
import { formatAnalysisAsMarkdown } from '../../utils/formatters';
import { VSCodeAPI } from '../../types/vscode';
import { UseDictionaryReturn } from '../../hooks/domain/useDictionary';
import { UseDictionaryHistoryReturn } from '../../hooks/domain/useDictionaryHistory';
import { useDictionaryPriorLookup } from '@hooks/domain/dictionary/controllers/useDictionaryPriorLookup';
import { UseSelectionReturn } from '../../hooks/domain/useSelection';
import { UseSettingsReturn } from '../../hooks/domain/useSettings';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';

interface UtilitiesTabProps {
  vscode: VSCodeAPI;
  dictionary: UseDictionaryReturn;
  dictionaryHistory: UseDictionaryHistoryReturn;
  selection: UseSelectionReturn;
  settings: UseSettingsReturn;
}

/** A lookup to submit; the entry options come from the form's switches. */
type LookupInput = Pick<DictionaryLookupRequest, 'mode' | 'word' | 'context' | 'sourceUri' | 'relativePath'>;

/** The host message for a lookup; the standard route names its context `contextText`. */
const lookupMessageFor = (request: DictionaryLookupRequest): LookupDictionaryMessage | FastGenerateDictionaryMessage => {
  const { word, context, includeEncyclopedia, includePalettes, sourceUri, relativePath } = request;
  const shared = { word, includeEncyclopedia, includePalettes, sourceUri, relativePath };
  const envelope = { source: 'webview.utilities.tab' as const, timestamp: Date.now() };
  return request.mode === 'fast'
    ? { ...envelope, type: MessageType.FAST_GENERATE_DICTIONARY, payload: { ...shared, context: context || undefined } }
    : { ...envelope, type: MessageType.LOOKUP_DICTIONARY, payload: { ...shared, contextText: context || undefined } };
};

export const UtilitiesTab = React.memo<UtilitiesTabProps>(({
  vscode,
  dictionary,
  dictionaryHistory,
  selection,
  settings
}) => {
  /**
   * Every submit path (Run, ⚡ Fast, right-click auto-run): the request becomes
   * the subject Copy and Save name, and the new lookup goes live in history.
   */
  const submitLookup = React.useCallback((
    { mode, word, context, sourceUri, relativePath }: LookupInput
  ) => {
    const request: DictionaryLookupRequest = {
      word,
      context,
      includeEncyclopedia: dictionary.includeEncyclopedia,
      includePalettes: dictionary.includePalettes,
      mode,
      ...(sourceUri ? { sourceUri } : {}),
      ...(relativePath ? { relativePath } : {})
    };
    dictionary.setLookupSubject(request);
    dictionaryHistory.beginNewLookup();
    if (mode === 'fast') {
      dictionary.setFastGenerating(true);
    } else {
      dictionary.setLoading(true);
    }
    vscode.postMessage(lookupMessageFor(request));
  }, [dictionary, dictionaryHistory, vscode]);

  const submitFormLookup = React.useCallback((mode: DictionaryLookupMode) => {
    const sanitizedWord = normalizeDictionaryPhrase(dictionary.word);
    if (!sanitizedWord) {
      return;
    }
    submitLookup({
      mode,
      word: sanitizedWord,
      context: dictionary.context.trim(),
      sourceUri: dictionary.sourceUri,
      relativePath: dictionary.relativePath
    });
  }, [dictionary, submitLookup]);

  // A phrase already in the history is offered back before it is rerun (ADR D9).
  const priorLookup = useDictionaryPriorLookup({
    entries: dictionaryHistory.entries,
    cursorId: dictionaryHistory.cursorId,
    formWord: dictionary.word,
    openEntry: dictionaryHistory.openEntry,
    submitFormLookup
  });

  // For typing: allow trailing space, just limit word count
  const enforceWordLimit = React.useCallback((value: string): string => {
    // Normalize multiple spaces to single, but preserve trailing space
    const hasTrailingSpace = value.endsWith(' ');
    const normalized = value.replace(/\s+/g, ' ');
    const tokens = normalized.trim().split(' ').filter(Boolean);

    if (tokens.length === 0) {
      return '';
    }

    const limited = tokens.slice(0, DICTIONARY_PHRASE_WORDS).join(' ');
    // Preserve trailing space if user is typing between words
    return hasTrailingSpace && tokens.length < DICTIONARY_PHRASE_WORDS ? limited + ' ' : limited;
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
      const sanitized = normalizeDictionaryPhrase(injection.word);
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
  }, [selection.dictionaryInjection, dictionary, selection]);

  // Effect: handleInjection, when dictionaryInjection changes (paste button or right-click menu).
  React.useEffect(() => {
    populateDictionaryFromInjection();
  }, [populateDictionaryFromInjection]);

  /**
   * Automatically triggers fast dictionary lookup from right-click menu.
   * - Reads word directly from injection (not dictionary state) to avoid race condition
   * - Posts FAST_GENERATE_DICTIONARY message to extension, unless the phrase is
   *   already in history (ADR D9), in which case the prior entry is offered instead
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

    const sanitizedWord = normalizeDictionaryPhrase(injection.word || '');
    if (!sanitizedWord) {
      // Clear injection even if no word to prevent stuck state
      selection.handleDictionaryInjectionHandled();
      return;
    }

    // Source comes from the injection too: the form's setSource has not rendered yet.
    const contextValue = (injection.context || dictionary.context || '').trim();
    if (!priorLookup.offerPriorLookup(sanitizedWord, 'fast')) {
      submitLookup({
        mode: 'fast',
        word: sanitizedWord,
        context: contextValue,
        sourceUri: injection.sourceUri,
        relativePath: injection.relativePath
      });
    }

    // Clear injection after triggering lookup (or offering the prior one)
    selection.handleDictionaryInjectionHandled();
  }, [selection.dictionaryInjection, dictionary.context, selection, submitLookup, priorLookup.offerPriorLookup]);

  // Effect: autoRunLookup, when dictionaryInjection changes AND its autoRun flag is true.
  React.useEffect(() => {
    autoRunLookupWhenInjected();
  }, [autoRunLookupWhenInjected]);

  const requestFormLookup = (mode: DictionaryLookupMode) => {
    if (!priorLookup.offerPriorLookup(normalizeDictionaryPhrase(dictionary.word), mode)) {
      submitFormLookup(mode);
    }
  };

  const handleLookup = () => requestFormLookup('standard');
  const handleFastGenerate = () => requestFormLookup('fast');

  const handleWordChange = (value: string) => {
    priorLookup.dismissPriorLookup();
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

  const handleCancelStreaming = React.useCallback(() => {
    if (dictionary.currentRequestId) {
      vscode.postMessage(createCancelRequestMessage('dictionary', dictionary.currentRequestId, 'webview.utilities.tab'));
    }
    dictionary.cancelStreaming();
  }, [dictionary, vscode]);

  const markdownContent = React.useMemo(() => {
    if (!dictionary.result) return '';
    return formatAnalysisAsMarkdown(dictionary.result);
  }, [dictionary.result]);

  // Copy and Save name the request behind the displayed result (ADR D8), so a
  // restored entry or later edits to the form cannot mislabel it.
  const resultSubject = () => dictionary.lookupSubject ?? {
    word: normalizeDictionaryPhrase(dictionary.word),
    context: dictionary.context.trim()
  };

  const handleCopyDictionaryResult = () => {
    if (!dictionary.result) {
      return;
    }

    const metadata = resultSubject();
    const header = `# ${metadata.word || normalizeDictionaryPhrase(dictionary.word) || 'Entry'}`;

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

    const metadata = resultSubject();
    const header = `# ${metadata.word || normalizeDictionaryPhrase(dictionary.word) || 'Entry'}`;

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
  const isGenerating = dictionary.loading || dictionary.isFastGenerating || dictionary.isStreaming;

  return (
    <div className="tab-content">
      <div className="pm-dictionary-header">
        <h2 className="text-lg font-semibold">Utilities · Dictionary</h2>
        <DictionaryHistoryNav history={dictionaryHistory} />
      </div>
      <DictionaryHistoryMeta summary={dictionaryHistory.cursorSummary} />

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
            <Icon name="clipboard" size={16} />
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
            <Icon name="clipboard" size={16} />
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

      <DictionaryOptionSwitch
        id="dictionary-encyclopedia"
        label="Topic & Related Lexicon"
        kind="Encyclopedia entry"
        description="Append in-depth topic exploration, related vocabulary, and possible reference books to the end of this entry."
        checked={dictionary.includeEncyclopedia}
        disabled={isGenerating}
        onChange={dictionary.setIncludeEncyclopedia}
      />
      <DictionaryOptionSwitch
        id="dictionary-palettes"
        label="Chromatic Palettes"
        kind="Color swatches"
        description="Add literal and evocative color palettes after AI Advisory Notes. Every swatch is a named color with a short definition and its hex value."
        checked={dictionary.includePalettes}
        disabled={isGenerating}
        onChange={dictionary.setIncludePalettes}
      />

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleLookup}
          disabled={!dictionary.word.trim() || isGenerating}
        >
          Run Dictionary Lookup
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleFastGenerate}
          disabled={!dictionary.word.trim() || isGenerating}
          title="Experimental: Generate using parallel API calls (2-4× faster)"
        >
          ⚡ Experimental: Run Dictionary Lookup [Fast]
        </button>
      </div>

      {priorLookup.priorLookup && (
        <DictionaryPriorLookupPrompt
          offer={priorLookup.priorLookup}
          disabled={isGenerating}
          onOpen={priorLookup.openPriorLookup}
          onLookUpAgain={priorLookup.lookUpAgain}
          onDismiss={priorLookup.dismissPriorLookup}
        />
      )}

      <p className="pm-dictionary-generation-note">
        <em>
          * Fast Dictionary results may be less thorough because each section is generated separately.
          A single request gives the model more continuous context and may lead to richer, more creative exploration.
        </em>
      </p>

      {dictionary.isStreaming && (
        <StreamingContent
          content={dictionary.streamingContent}
          isStreaming={dictionary.isStreaming}
          isBuffering={dictionary.isBuffering}
          chunkCount={dictionary.streamingChunkCount}
          elapsedMs={dictionary.streamingElapsedMs}
          initialLatencyMs={dictionary.streamingInitialLatencyMs}
          chunksPerSecond={dictionary.streamingChunksPerSecond}
          onCancel={dictionary.currentRequestId ? handleCancelStreaming : undefined}
          cancelDisabled={!dictionary.currentRequestId}
          fencedBlocks={DICTIONARY_FENCED_BLOCKS}
        />
      )}

      {dictionary.loading && !dictionary.isStreaming && (
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

      {dictionary.result && !dictionary.isStreaming && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyDictionaryResult}
              disabled={!canCopyDictionary}
              title="Copy dictionary entry"
              aria-label="Copy dictionary entry"
            >
              <Icon name="copy" size={14} />
            </button>
            <button
              className="icon-button"
              onClick={handleSaveDictionaryResult}
              disabled={!canSaveDictionary}
              title="Save dictionary entry"
              aria-label="Save dictionary entry"
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
            <MarkdownRenderer content={markdownContent} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
});

UtilitiesTab.displayName = 'UtilitiesTab';
