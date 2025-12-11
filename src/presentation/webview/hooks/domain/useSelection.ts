/**
 * useSelection - Domain hook for selection and paste operations
 *
 * Manages selected text state, dictionary injection, and paste button handlers.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType, SelectionTarget, TabId } from '@shared/types';
import { SelectionUpdatedMessage, SelectionDataMessage } from '@messages';

export interface DictionaryInjection {
  word?: string;
  context?: string;
  sourceUri?: string;
  relativePath?: string;
  autoRun?: boolean;
  timestamp: number;
}

export interface SelectionState {
  selectedText: string;
  selectedSourceUri: string;
  selectedRelativePath: string;
  dictionaryInjection: DictionaryInjection | null;
}

export interface SelectionActions {
  handleSelectionUpdated: (message: SelectionUpdatedMessage, onTabChange: (tab: TabId) => void) => void;
  handleSelectionData: (message: SelectionDataMessage, onTabChange: (tab: TabId) => void, onContextSet?: (context: string) => void) => void;
  requestSelection: (target: SelectionTarget) => void;
  /** Request selection to verify against pasted text - only applies source if match */
  requestSelectionVerify: (pastedText: string) => void;
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

  // Ref to store pending paste text for verification
  const pendingVerifyTextRef = React.useRef<string | null>(null);

  const handleSelectionUpdated = React.useCallback(
    (message: SelectionUpdatedMessage, onTabChange: (tab: TabId) => void) => {
      const { text, sourceUri, relativePath, target, autoRun } = message.payload;
      const targetValue = target || 'assistant';

      if (targetValue === 'assistant' || targetValue === 'both') {
        onTabChange(TabId.ANALYSIS);
        setSelectedText(text);
        setSelectedSourceUri(sourceUri ?? '');
        setSelectedRelativePath(relativePath ?? '');
      }

      if (targetValue === 'dictionary' || targetValue === 'both') {
        onTabChange(TabId.UTILITIES);
        setDictionaryInjection({ word: text, autoRun, timestamp: Date.now() });
      }
    },
    []
  );

  const handleSelectionData = React.useCallback(
    (message: SelectionDataMessage, onTabChange: (tab: TabId) => void, onContextSet?: (context: string) => void) => {
      const { content = '', target, sourceUri, relativePath } = message.payload;

      switch (target) {
        case 'assistant_excerpt':
          onTabChange(TabId.ANALYSIS);
          setSelectedText(content);
          setSelectedSourceUri(sourceUri ?? '');
          setSelectedRelativePath(relativePath ?? '');
          break;

        case 'assistant_excerpt_verify':
          // Verify paste: only apply source metadata if pasted text matches editor selection
          if (pendingVerifyTextRef.current && content === pendingVerifyTextRef.current) {
            // Match! Apply source metadata (text was already pasted, don't overwrite)
            setSelectedSourceUri(sourceUri ?? '');
            setSelectedRelativePath(relativePath ?? '');
          } else {
            // No match - text is from unknown source, clear metadata
            setSelectedSourceUri('');
            setSelectedRelativePath('');
          }
          pendingVerifyTextRef.current = null;
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
        source: 'webview.selection',
        payload: {
          target,
        },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  /**
   * Request selection for paste verification.
   * Stores the pasted text and requests current editor selection.
   * When response arrives, compares and only applies source if they match.
   */
  const requestSelectionVerify = React.useCallback(
    (pastedText: string) => {
      pendingVerifyTextRef.current = pastedText;
      vscode.postMessage({
        type: MessageType.REQUEST_SELECTION,
        source: 'webview.selection',
        payload: {
          target: 'assistant_excerpt_verify',
        },
        timestamp: Date.now()
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
    requestSelectionVerify,
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
