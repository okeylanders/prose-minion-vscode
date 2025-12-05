/**
 * useDictionary - Domain hook for dictionary lookup operations
 *
 * Manages dictionary word, context, results, and source tracking.
 * Includes streaming support for progressive response display.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { useStreaming } from '../useStreaming';
import {
  DictionaryResultMessage,
  FastGenerateDictionaryResultMessage,
  StatusMessage,
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage
} from '@messages';

export interface FastGenerationMetadata {
  totalDuration: number;
  blockDurations: Record<string, number>;
  partialFailures: string[];
  successCount: number;
  totalBlocks: number;
}

export interface DictionaryState {
  result: string;
  toolName: string | undefined;
  loading: boolean;
  word: string;
  context: string;
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
  streamingTokenCount: number;
  currentRequestId: string | null;
}

export interface DictionaryActions {
  handleDictionaryResult: (message: DictionaryResultMessage) => void;
  handleStatusMessage: (message: StatusMessage) => void;
  setLoading: (loading: boolean) => void;
  setWord: (word: string) => void;
  setContext: (context: string) => void;
  setWordEdited: (edited: boolean) => void;
  setSource: (uri?: string, relativePath?: string) => void;
  clearResult: () => void;
  // Fast generation actions
  handleFastGenerateResult: (message: FastGenerateDictionaryResultMessage) => void;
  setFastGenerating: (isGenerating: boolean) => void;
  // Streaming actions
  handleStreamChunk: (message: StreamChunkMessage) => void;
  handleStreamComplete: (message: StreamCompleteMessage) => void;
  handleStreamStarted: (message: StreamStartedMessage) => void;
  startStreaming: (requestId: string) => void;
  cancelStreaming: () => void;
}

export interface DictionaryPersistence {
  utilitiesResult: string;
  dictionaryToolName: string | undefined;
  dictionaryWord: string;
  dictionaryContext: string;
  dictionaryWordEdited: boolean;
  dictionarySourceUri: string;
  dictionaryRelativePath: string;
  dictionaryStatusMessage: string;
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
  const persisted = usePersistedState<{
    utilitiesResult?: string;
    dictionaryToolName?: string;
    dictionaryWord?: string;
    dictionaryContext?: string;
    dictionaryWordEdited?: boolean;
    dictionarySourceUri?: string;
    dictionaryRelativePath?: string;
    dictionaryStatusMessage?: string;
  }>();

  const [result, setResult] = React.useState<string>(persisted?.utilitiesResult ?? '');
  const [toolName, setToolName] = React.useState<string | undefined>(persisted?.dictionaryToolName);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [word, setWord] = React.useState<string>(persisted?.dictionaryWord ?? '');
  const [context, setContext] = React.useState<string>(persisted?.dictionaryContext ?? '');
  const [wordEdited, setWordEdited] = React.useState<boolean>(persisted?.dictionaryWordEdited ?? false);
  const [sourceUri, setSourceUri] = React.useState<string>(persisted?.dictionarySourceUri ?? '');
  const [relativePath, setRelativePath] = React.useState<string>(persisted?.dictionaryRelativePath ?? '');
  const [statusMessage, setStatusMessage] = React.useState<string>(persisted?.dictionaryStatusMessage ?? '');

  // Fast generation state
  const [isFastGenerating, setIsFastGenerating] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<{ current: number; total: number } | undefined>(undefined);
  const [lastFastGenerationMetadata, setLastFastGenerationMetadata] = React.useState<FastGenerationMetadata | null>(null);
  const [tickerMessage, setTickerMessage] = React.useState<string>('');

  // Streaming state (using useStreaming hook)
  const streaming = useStreaming();
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(null);
  const ignoredRequestIdsRef = React.useRef<Set<string>>(new Set());

  // Clear result when dictionary lookup starts
  const clearResultWhenLoading = React.useCallback(() => {
    if (loading) {
      setResult('');
    }
  }, [loading]);

  React.useEffect(() => {
    clearResultWhenLoading();
  }, [clearResultWhenLoading]);

  const handleDictionaryResult = React.useCallback((message: DictionaryResultMessage) => {
    const { result, toolName } = message.payload;
    setResult(result);
    setToolName(toolName);
    setLoading(false);
    setStatusMessage(''); // Clear status message
  }, []);

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

  const clearResult = React.useCallback(() => {
    setResult('');
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
    ignoredRequestIdsRef.current.delete(requestId);
    setCurrentRequestId(requestId);
    streaming.startStreaming();
    setLoading(true);
    setResult(''); // Clear previous result
  }, [streaming]);

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
    const { domain, content, cancelled, requestId } = message.payload;
    // Only handle dictionary domain completion
    if (domain !== 'dictionary') return;

    if (ignoredRequestIdsRef.current.has(requestId)) return;

    if (currentRequestId && requestId !== currentRequestId) {
      if (ignoredRequestIdsRef.current.has(requestId)) return;
      return;
    }

    streaming.endStreaming();
    setCurrentRequestId(null);
    setLoading(false);

    if (!cancelled) {
      // Content will come through DICTIONARY_RESULT message for backward compatibility
      // The streaming content is shown progressively until then
    }
  }, [currentRequestId, streaming]);

  const cancelStreaming = React.useCallback(() => {
    if (currentRequestId) {
      ignoredRequestIdsRef.current.add(currentRequestId);
    }
    streaming.reset();
    setCurrentRequestId(null);
    setLoading(false);
    setStatusMessage('');
  }, [currentRequestId, streaming]);

  return {
    // State
    result,
    toolName,
    loading,
    word,
    context,
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
    streamingTokenCount: streaming.tokenCount,
    currentRequestId,

    // Actions
    handleDictionaryResult,
    handleStatusMessage,
    setLoading,
    setWord,
    setContext,
    setWordEdited,
    setSource,
    clearResult,
    handleFastGenerateResult,
    setFastGenerating,
    // Streaming actions
    handleStreamStarted,
    handleStreamChunk,
    handleStreamComplete,
    startStreaming,
    cancelStreaming,

    // Persistence
    persistedState: {
      utilitiesResult: result,
      dictionaryToolName: toolName,
      dictionaryWord: word,
      dictionaryContext: context,
      dictionaryWordEdited: wordEdited,
      dictionarySourceUri: sourceUri,
      dictionaryRelativePath: relativePath,
      dictionaryStatusMessage: statusMessage,
    },
  };
};
