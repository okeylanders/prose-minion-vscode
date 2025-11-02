/**
 * useSelection - Domain hook for selection and paste operations
 *
 * Manages selected text state, dictionary injection, and paste button handlers.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType, SelectionTarget, TabId } from '../../../../shared/types';

export interface DictionaryInjection {
  word?: string;
  context?: string;
  sourceUri?: string;
  relativePath?: string;
  timestamp: number;
}

export interface SelectionState {
  selectedText: string;
  selectedSourceUri: string;
  selectedRelativePath: string;
  dictionaryInjection: DictionaryInjection | null;
}

export interface SelectionActions {
  handleSelectionUpdated: (message: any, onTabChange: (tab: TabId) => void) => void;
  handleSelectionData: (message: any, onTabChange: (tab: TabId) => void, onContextSet?: (context: string) => void) => void;
  requestSelection: (target: SelectionTarget) => void;
  handleDictionaryInjectionHandled: () => void;
  setSelectedText: (text: string) => void;
  setSelectedSourceUri: (uri: string) => void;
  setSelectedRelativePath: (path: string) => void;
}

export interface SelectionPersistence {
  selectedText: string;
  selectedSourceUri: string;
  selectedRelativePath: string;
}

export type UseSelectionReturn = SelectionState & SelectionActions & { persistedState: SelectionPersistence };

/**
 * Custom hook for managing selection and paste operations
 *
 * @example
 * ```tsx
 * const selection = useSelection();
 *
 * // Handle selection messages
 * useMessageRouter({
 *   [MessageType.SELECTION_UPDATED]: (msg) => selection.handleSelectionUpdated(msg, setActiveTab),
 *   [MessageType.SELECTION_DATA]: (msg) => selection.handleSelectionData(msg, setActiveTab, context.setContextText),
 * });
 *
 * // Use in AnalysisTab
 * <AnalysisTab
 *   selectedText={selection.selectedText}
 *   selectedRelativePath={selection.selectedRelativePath}
 *   selectedSourceUri={selection.selectedSourceUri}
 *   onRequestSelection={selection.requestSelection}
 * />
 * ```
 */
export const useSelection = (): UseSelectionReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    selectedText?: string;
    selectedSourceUri?: string;
    selectedRelativePath?: string;
  }>();

  const [selectedText, setSelectedText] = React.useState<string>(persisted?.selectedText ?? '');
  const [selectedSourceUri, setSelectedSourceUri] = React.useState<string>(persisted?.selectedSourceUri ?? '');
  const [selectedRelativePath, setSelectedRelativePath] = React.useState<string>(
    persisted?.selectedRelativePath ?? ''
  );
  const [dictionaryInjection, setDictionaryInjection] = React.useState<DictionaryInjection | null>(null);

  const handleSelectionUpdated = React.useCallback(
    (message: any, onTabChange: (tab: TabId) => void) => {
      const { text, sourceUri, relativePath, target } = message.payload;
      const targetValue = target || 'assistant';

      if (targetValue === 'assistant' || targetValue === 'both') {
        onTabChange(TabId.ANALYSIS);
        setSelectedText(text);
        setSelectedSourceUri(sourceUri ?? '');
        setSelectedRelativePath(relativePath ?? '');
      }

      if (targetValue === 'dictionary' || targetValue === 'both') {
        onTabChange(TabId.UTILITIES);
        setDictionaryInjection({ word: text, timestamp: Date.now() });
      }
    },
    []
  );

  const handleSelectionData = React.useCallback(
    (message: any, onTabChange: (tab: TabId) => void, onContextSet?: (context: string) => void) => {
      const { content = '', target, sourceUri, relativePath } = message.payload;

      switch (target) {
        case 'assistant_excerpt':
          onTabChange(TabId.ANALYSIS);
          setSelectedText(content);
          setSelectedSourceUri(sourceUri ?? '');
          setSelectedRelativePath(relativePath ?? '');
          break;

        case 'assistant_context':
          onTabChange(TabId.ANALYSIS);
          if (onContextSet) {
            onContextSet(content);
          }
          break;

        case 'dictionary_word':
          onTabChange(TabId.UTILITIES);
          setDictionaryInjection({
            word: content,
            sourceUri,
            relativePath,
            timestamp: Date.now(),
          });
          break;

        case 'dictionary_context':
          onTabChange(TabId.UTILITIES);
          setDictionaryInjection({
            context: content,
            sourceUri,
            relativePath,
            timestamp: Date.now(),
          });
          break;
      }
    },
    []
  );

  const requestSelection = React.useCallback(
    (target: SelectionTarget) => {
      vscode.postMessage({
        type: MessageType.REQUEST_SELECTION,
        target,
      });
    },
    [vscode]
  );

  const handleDictionaryInjectionHandled = React.useCallback(() => {
    setDictionaryInjection(null);
  }, []);

  return {
    // State
    selectedText,
    selectedSourceUri,
    selectedRelativePath,
    dictionaryInjection,

    // Actions
    handleSelectionUpdated,
    handleSelectionData,
    requestSelection,
    handleDictionaryInjectionHandled,
    setSelectedText,
    setSelectedSourceUri,
    setSelectedRelativePath,

    // Persistence
    persistedState: {
      selectedText,
      selectedSourceUri,
      selectedRelativePath,
    },
  };
};
