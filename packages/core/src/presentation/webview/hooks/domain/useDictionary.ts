/**
 * useDictionary - Domain hook for dictionary lookup operations
 *
 * Manages dictionary word, context, results, and source tracking.
 * Includes streaming support for progressive response display.
 *
 * `lookupSubject` is the request the displayed result answers (ADR 2026-10-14,
 * D8). Submitting a lookup sets it, and so does restoring a history entry or
 * draft through `restoreView`, so Copy, Save, and the history draft rule all
 * name the lookup the writer is actually reading.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { useStreaming } from '../useStreaming';
import { MessageType } from '@shared/types';
import {
  DictionaryResultMessage,
  FastGenerateDictionaryResultMessage,
  StatusMessage,
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  ClearTransientApiKeyWarningMessage,
  DictionaryLookupRequest,
  isApiKeyNotConfiguredWarning
} from '@messages';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';

export interface FastGenerationMetadata {
  totalDuration: number;
  blockDurations: Record<string, number>;
  partialFailures: string[];
  successCount: number;
  totalBlocks: number;
}

/**
 * Everything the Dictionary tab shows for one lookup: the form, the result,
 * and the request that result answers. History navigation stashes and
 * restores whole views so the form and the result can never disagree.
 */
export interface DictionaryView {
  word: string;
  context: string;
  includeEncyclopedia: boolean;
  includePalettes: boolean;
  sourceUri: string;
  relativePath: string;
  result: string;
  toolName: string | undefined;
  lookupSubject: DictionaryLookupRequest | null;
}

export interface DictionaryState {
  result: string;
  toolName: string | undefined;
  /** The request the displayed result answers; null when nothing was looked up. */
  lookupSubject: DictionaryLookupRequest | null;
  loading: boolean;
  word: string;
  context: string;
  includeEncyclopedia: boolean;
  includePalettes: boolean;
  wordEdited: boolean;
  sourceUri: string;
  relativePath: string;
  statusMessage: string;
  // Fast generation state
  isFastGenerating: boolean;
  progress: { current: number; total: number } | undefined;
  lastFastGenerationMetadata: FastGenerationMetadata | null;
  tickerMessage: string;
  // Streaming state
  isStreaming: boolean;
  isBuffering: boolean;
  streamingContent: string;
  streamingChunkCount: number;
  streamingElapsedMs: number;
  streamingInitialLatencyMs?: number;
  streamingChunksPerSecond: number;
  currentRequestId: string | null;
}

export interface DictionaryActions {
  handleDictionaryResult: (message: DictionaryResultMessage) => void;
  handleStatusMessage: (message: StatusMessage) => void;
  setLoading: (loading: boolean) => void;
  setWord: (word: string) => void;
  setContext: (context: string) => void;
  setIncludeEncyclopedia: (include: boolean) => void;
  setIncludePalettes: (include: boolean) => void;
  setWordEdited: (edited: boolean) => void;
  setSource: (uri?: string, relativePath?: string) => void;
  setLookupSubject: (subject: DictionaryLookupRequest | null) => void;
  /**
   * Show a stashed or recorded view. Leaves loading, streaming, and fast
   * generation alone, and marks the word edited so a selection auto-fill
   * cannot overwrite the restored word.
   */
  restoreView: (view: DictionaryView) => void;
  clearResult: () => void;
  handleClearTransientApiKeyWarning: (message: ClearTransientApiKeyWarningMessage) => void;
  // Fast generation actions
  handleFastGenerateResult: (message: FastGenerateDictionaryResultMessage) => void;
  setFastGenerating: (isGenerating: boolean) => void;
  // Streaming actions
  handleStreamChunk: (message: StreamChunkMessage) => void;
  handleStreamComplete: (message: StreamCompleteMessage) => void;
  handleStreamStarted: (message: StreamStartedMessage) => void;
  /**
   * True when this result settles the lookup this view is awaiting: its
   * stream completed here and no result has settled it yet. Replays,
   * superseded lookups, and cancelled lookups are false.
   */
  isAwaitedResult: (message: DictionaryResultMessage) => boolean;
  startStreaming: (requestId: string) => void;
  cancelStreaming: () => void;
}

export interface DictionaryPersistence {
  utilitiesResult: string;
  dictionaryToolName: string | undefined;
  dictionaryWord: string;
  dictionaryContext: string;
  dictionaryIncludeEncyclopedia: boolean;
  dictionaryIncludePalettes: boolean;
  dictionaryWordEdited: boolean;
  dictionarySourceUri: string;
  dictionaryRelativePath: string;
  dictionaryStatusMessage: string;
  dictionaryLookupSubject: DictionaryLookupRequest | null;
}

export type UseDictionaryReturn = DictionaryState & DictionaryActions & { persistedState: DictionaryPersistence };

/**
 * Custom hook for managing dictionary state and operations
 *
 * @example
 * ```tsx
 * const dictionary = useDictionary();
 *
 * // Handle dictionary messages
 * useMessageRouter({
 *   [MessageType.DICTIONARY_RESULT]: dictionary.handleDictionaryResult,
 * });
 *
 * // Use in UtilitiesTab
 * <UtilitiesTab
 *   result={dictionary.result}
 *   isLoading={dictionary.loading}
 *   onLoadingChange={dictionary.setLoading}
 *   toolName={dictionary.toolName}
 *   word={dictionary.word}
 *   context={dictionary.context}
 *   onWordChange={dictionary.setWord}
 *   onContextChange={dictionary.setContext}
 *   hasWordBeenEdited={dictionary.wordEdited}
 *   setHasWordBeenEdited={dictionary.setWordEdited}
 *   sourceUri={dictionary.sourceUri}
 *   relativePath={dictionary.relativePath}
 *   onSourceChange={dictionary.setSource}
 * />
 * ```
 */
export const useDictionary = (): UseDictionaryReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    utilitiesResult?: string;
    dictionaryToolName?: string;
    dictionaryWord?: string;
    dictionaryContext?: string;
    dictionaryIncludeEncyclopedia?: boolean;
    dictionaryIncludePalettes?: boolean;
    dictionaryWordEdited?: boolean;
    dictionarySourceUri?: string;
    dictionaryRelativePath?: string;
    dictionaryStatusMessage?: string;
    dictionaryLookupSubject?: DictionaryLookupRequest | null;
  }>();

  const [result, setResult] = React.useState<string>(
    isApiKeyNotConfiguredWarning(persisted?.utilitiesResult) ? '' : (persisted?.utilitiesResult ?? '')
  );
  const [toolName, setToolName] = React.useState<string | undefined>(persisted?.dictionaryToolName);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [word, setWord] = React.useState<string>(persisted?.dictionaryWord ?? '');
  const [context, setContext] = React.useState<string>(persisted?.dictionaryContext ?? '');
  const [includeEncyclopedia, setIncludeEncyclopedia] = React.useState<boolean>(
    persisted?.dictionaryIncludeEncyclopedia ?? true
  );
  const [includePalettes, setIncludePalettes] = React.useState<boolean>(
    persisted?.dictionaryIncludePalettes ?? true
  );
  const [wordEdited, setWordEdited] = React.useState<boolean>(persisted?.dictionaryWordEdited ?? false);
  const [sourceUri, setSourceUri] = React.useState<string>(persisted?.dictionarySourceUri ?? '');
  const [relativePath, setRelativePath] = React.useState<string>(persisted?.dictionaryRelativePath ?? '');
  const [statusMessage, setStatusMessage] = React.useState<string>(persisted?.dictionaryStatusMessage ?? '');
  const [lookupSubject, setLookupSubject] = React.useState<DictionaryLookupRequest | null>(
    persisted?.dictionaryLookupSubject ?? null
  );

  // Fast generation state
  const [isFastGenerating, setIsFastGenerating] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<{ current: number; total: number } | undefined>(undefined);
  const [lastFastGenerationMetadata, setLastFastGenerationMetadata] = React.useState<FastGenerationMetadata | null>(null);
  const [tickerMessage, setTickerMessage] = React.useState<string>('');

  // Streaming state (using useStreaming hook)
  const streaming = useStreaming();
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(null);
  const ignoredRequestIdsRef = React.useRef<Set<string>>(new Set());
  /**
   * The stream that completed here and now awaits its DICTIONARY_RESULT. Until
   * that result settles it, the lookup stays owned (loading), so Run and
   * history navigation cannot slip in between (Astra F-01). A ref, not state:
   * completion and result arrive back to back, before React re-renders.
   */
  const awaitedResultIdRef = React.useRef<string | null>(null);

  // Clear result when dictionary lookup starts
  const clearResultWhenLoading = React.useCallback(() => {
    if (loading) {
      setResult('');
    }
  }, [loading]);

  React.useEffect(() => {
    clearResultWhenLoading();
  }, [clearResultWhenLoading]);

  const isAwaitedResult = React.useCallback(
    (message: DictionaryResultMessage) => message.payload.requestId === awaitedResultIdRef.current,
    []
  );

  const handleDictionaryResult = React.useCallback((message: DictionaryResultMessage) => {
    // Only the result that settles the awaited lookup applies. The host replays
    // its cached result whenever the sidebar is shown again, whatever its
    // outcome, and a cancelled or superseded lookup's result can still arrive
    // (Astra F-01, F-02). Either would replace a newer or restored view.
    if (!isAwaitedResult(message)) {
      return;
    }
    awaitedResultIdRef.current = null;
    const { result, toolName } = message.payload;
    setResult(result);
    setToolName(toolName);
    setLoading(false);
    setStatusMessage(''); // Clear status message
  }, [isAwaitedResult]);

  const handleStatusMessage = React.useCallback((message: StatusMessage) => {
    const { message: statusText, progress: statusProgress, tickerMessage: ticker } = message.payload;
    setStatusMessage(statusText);

    // Extract progress from STATUS message if present and we're fast generating
    if (statusProgress && isFastGenerating) {
      setProgress(statusProgress);
    }

    // Extract ticker message if present and we're fast generating
    if (ticker && isFastGenerating) {
      setTickerMessage(ticker);
    }
  }, [isFastGenerating]);

  const setSource = React.useCallback((uri?: string, rel?: string) => {
    setSourceUri(uri || '');
    setRelativePath(rel || '');
  }, []);

  const restoreView = React.useCallback((view: DictionaryView) => {
    setWord(view.word);
    setContext(view.context);
    setIncludeEncyclopedia(view.includeEncyclopedia);
    setIncludePalettes(view.includePalettes);
    setSourceUri(view.sourceUri);
    setRelativePath(view.relativePath);
    setResult(view.result);
    setToolName(view.toolName);
    setLookupSubject(view.lookupSubject);
    setWordEdited(true);
    setStatusMessage('');
  }, []);

  const clearResult = React.useCallback(() => {
    setResult('');
  }, []);

  const handleClearTransientApiKeyWarning = React.useCallback((_message: ClearTransientApiKeyWarningMessage) => {
    setResult(current => isApiKeyNotConfiguredWarning(current) ? '' : current);
  }, []);

  // Fast generation handlers
  const handleFastGenerateResult = React.useCallback((message: FastGenerateDictionaryResultMessage) => {
    const { result: content, metadata } = message.payload;
    setResult(content);
    setToolName('dictionary_fast_generate');
    setIsFastGenerating(false);
    setProgress(undefined); // Clear progress
    setLastFastGenerationMetadata(metadata);
    setStatusMessage(''); // Clear status message
    setTickerMessage(''); // Clear ticker message
  }, []);

  const setFastGenerating = React.useCallback((isGenerating: boolean) => {
    setIsFastGenerating(isGenerating);
    if (isGenerating) {
      setResult('');
      setProgress(undefined); // Clear progress when starting
      setLastFastGenerationMetadata(null);
      setTickerMessage(''); // Clear ticker when starting
    }
  }, []);

  // Streaming handlers
  const startStreaming = React.useCallback((requestId: string) => {
    // Cancel any existing stream first
    if (currentRequestId) {
      // Notify backend to stop the old stream
      vscode.postMessage(createCancelRequestMessage('dictionary', currentRequestId, 'webview.dictionary.preempt'));

      ignoredRequestIdsRef.current.add(currentRequestId);
      streaming.reset();
    }

    ignoredRequestIdsRef.current.delete(requestId);
    // A new stream supersedes any result still awaited.
    awaitedResultIdRef.current = null;
    setCurrentRequestId(requestId);
    streaming.startStreaming();
    setLoading(true);
    setResult(''); // Clear previous result
  }, [currentRequestId, streaming, vscode]);

  const handleStreamStarted = React.useCallback((message: StreamStartedMessage) => {
    const { domain, requestId } = message.payload;
    if (domain !== 'dictionary') return;
    startStreaming(requestId);
  }, [startStreaming]);

  const handleStreamChunk = React.useCallback((message: StreamChunkMessage) => {
    const { domain, token, requestId } = message.payload;
    // Only handle dictionary domain chunks
    if (domain !== 'dictionary') return;

    if (ignoredRequestIdsRef.current.has(requestId)) return;

    if (currentRequestId && requestId !== currentRequestId) {
      if (ignoredRequestIdsRef.current.has(requestId)) return;
      return;
    }

    // Auto-start streaming on first chunk (if not already streaming)
    if (!streaming.isStreaming) {
      startStreaming(requestId);
    }

    streaming.appendToken(token);
  }, [currentRequestId, startStreaming, streaming]);

  const handleStreamComplete = React.useCallback((message: StreamCompleteMessage) => {
    const { domain, cancelled, requestId } = message.payload;
    // Only handle dictionary domain completion
    if (domain !== 'dictionary') return;

    // A request this view cancelled or preempted: forget it and change nothing.
    if (ignoredRequestIdsRef.current.has(requestId)) {
      ignoredRequestIdsRef.current.delete(requestId);
      return;
    }

    if (currentRequestId && requestId !== currentRequestId) {
      return;
    }

    streaming.endStreaming();
    setCurrentRequestId(null);

    if (cancelled) {
      setLoading(false);
      return;
    }
    // The content arrives in this stream's DICTIONARY_RESULT, right behind this
    // message. Stay loading until it settles the lookup.
    awaitedResultIdRef.current = requestId;
  }, [currentRequestId, streaming]);

  const cancelStreaming = React.useCallback(() => {
    if (currentRequestId) {
      ignoredRequestIdsRef.current.add(currentRequestId);
    }
    awaitedResultIdRef.current = null;
    const partialContent = streaming.buffer;
    streaming.endStreaming();
    if (partialContent) {
      setResult(partialContent);
    }
    setCurrentRequestId(null);
    setLoading(false);
    setStatusMessage('');
  }, [currentRequestId, streaming]);

  return {
    // State
    result,
    toolName,
    lookupSubject,
    loading,
    word,
    context,
    includeEncyclopedia,
    includePalettes,
    wordEdited,
    sourceUri,
    relativePath,
    statusMessage,
    isFastGenerating,
    progress,
    lastFastGenerationMetadata,
    tickerMessage,
    // Streaming state
    isStreaming: streaming.isStreaming,
    isBuffering: streaming.isBuffering,
    streamingContent: streaming.displayContent,
    streamingChunkCount: streaming.chunkCount,
    streamingElapsedMs: streaming.elapsedMs,
    streamingInitialLatencyMs: streaming.initialLatencyMs,
    streamingChunksPerSecond: streaming.chunksPerSecond,
    currentRequestId,

    // Actions
    handleDictionaryResult,
    handleStatusMessage,
    setLoading,
    setWord,
    setContext,
    setIncludeEncyclopedia,
    setIncludePalettes,
    setWordEdited,
    setSource,
    setLookupSubject,
    restoreView,
    clearResult,
    handleClearTransientApiKeyWarning,
    handleFastGenerateResult,
    setFastGenerating,
    // Streaming actions
    handleStreamStarted,
    handleStreamChunk,
    handleStreamComplete,
    isAwaitedResult,
    startStreaming,
    cancelStreaming,

    // Persistence
    persistedState: {
      utilitiesResult: isApiKeyNotConfiguredWarning(result) ? '' : result,
      dictionaryToolName: toolName,
      dictionaryWord: word,
      dictionaryContext: context,
      dictionaryIncludeEncyclopedia: includeEncyclopedia,
      dictionaryIncludePalettes: includePalettes,
      dictionaryWordEdited: wordEdited,
      dictionarySourceUri: sourceUri,
      dictionaryRelativePath: relativePath,
      dictionaryStatusMessage: statusMessage,
      dictionaryLookupSubject: lookupSubject,
    },
  };
};
