/**
 * useDictionary - Domain hook for dictionary lookup operations
 *
 * Manages dictionary word, context, results, and source tracking.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { DictionaryResultMessage } from '../../../../shared/types/messages';

export interface DictionaryState {
  result: string;
  toolName: string | undefined;
  loading: boolean;
  word: string;
  context: string;
  wordEdited: boolean;
  sourceUri: string;
  relativePath: string;
}

export interface DictionaryActions {
  handleDictionaryResult: (message: DictionaryResultMessage) => void;
  setLoading: (loading: boolean) => void;
  setWord: (word: string) => void;
  setContext: (context: string) => void;
  setWordEdited: (edited: boolean) => void;
  setSource: (uri?: string, relativePath?: string) => void;
  clearResult: () => void;
}

export interface DictionaryPersistence {
  utilitiesResult: string;
  dictionaryToolName: string | undefined;
  dictionaryWord: string;
  dictionaryContext: string;
  dictionaryWordEdited: boolean;
  dictionarySourceUri: string;
  dictionaryRelativePath: string;
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
  }>();

  const [result, setResult] = React.useState<string>(persisted?.utilitiesResult ?? '');
  const [toolName, setToolName] = React.useState<string | undefined>(persisted?.dictionaryToolName);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [word, setWord] = React.useState<string>(persisted?.dictionaryWord ?? '');
  const [context, setContext] = React.useState<string>(persisted?.dictionaryContext ?? '');
  const [wordEdited, setWordEdited] = React.useState<boolean>(persisted?.dictionaryWordEdited ?? false);
  const [sourceUri, setSourceUri] = React.useState<string>(persisted?.dictionarySourceUri ?? '');
  const [relativePath, setRelativePath] = React.useState<string>(persisted?.dictionaryRelativePath ?? '');

  // Clear result when dictionary lookup starts
  React.useEffect(() => {
    if (loading) {
      setResult('');
    }
  }, [loading]);

  const handleDictionaryResult = React.useCallback((message: DictionaryResultMessage) => {
    const { result, toolName } = message.payload;
    setResult(result);
    setToolName(toolName);
    setLoading(false);
  }, []);

  const setSource = React.useCallback((uri?: string, rel?: string) => {
    setSourceUri(uri || '');
    setRelativePath(rel || '');
  }, []);

  const clearResult = React.useCallback(() => {
    setResult('');
  }, []);

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

    // Actions
    handleDictionaryResult,
    setLoading,
    setWord,
    setContext,
    setWordEdited,
    setSource,
    clearResult,

    // Persistence
    persistedState: {
      utilitiesResult: result,
      dictionaryToolName: toolName,
      dictionaryWord: word,
      dictionaryContext: context,
      dictionaryWordEdited: wordEdited,
      dictionarySourceUri: sourceUri,
      dictionaryRelativePath: relativePath,
    },
  };
};
