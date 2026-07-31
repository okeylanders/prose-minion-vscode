/** Webview domain hook for Lexical Gravity's host-owned operations. */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import {
  MessageType,
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityLensCandidatesMessage,
  WorkshopLexicalGravityLensCandidatesPayload,
  WorkshopLexicalGravityLensesDataMessage,
  WorkshopLexicalGravityPreviewResultMessage,
  WorkshopLexicalGravityPreviewResultPayload,
  WorkshopLexicalGravityLensesSavedMessage,
  WorkshopLexicalGravityLensesSavedPayload,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload
} from '@messages';

export interface LexicalGravityState {
  lenses: WorkshopLexicalGravityLens[];
  storagePath?: string;
  catalogError?: string;
  previewResult: WorkshopLexicalGravityPreviewResultPayload | null;
  lensCandidates: WorkshopLexicalGravityLensCandidatesPayload | null;
  lensesSaved: WorkshopLexicalGravityLensesSavedPayload | null;
  actionResult: WorkshopWidgetActionResultPayload | null;
}

export interface LexicalGravityActions {
  requestLenses: () => void;
  preview: (token: string, draft: WorkshopLexicalGravityDraft) => void;
  buildLens: (token: string, query: string) => void;
  saveLenses: (
    token: string,
    query: string,
    candidateIds: string[]
  ) => void;
  apply: (draft: WorkshopLexicalGravityDraft, widgetConfigId?: string) => void;
  remove: () => void;
  handleLensesData: (message: WorkshopLexicalGravityLensesDataMessage) => void;
  handlePreviewResult: (message: WorkshopLexicalGravityPreviewResultMessage) => void;
  handleCandidates: (message: WorkshopLexicalGravityLensCandidatesMessage) => void;
  handleLensesSaved: (message: WorkshopLexicalGravityLensesSavedMessage) => void;
  handleActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  clearTransientResults: () => void;
  consumeActionResult: () => void;
}

export interface LexicalGravityPersistence {
  // Host/session/project storage own every durable value in this domain.
}

export type UseLexicalGravityReturn = LexicalGravityState & LexicalGravityActions & {
  persistedState: LexicalGravityPersistence;
};

export function useLexicalGravity(): UseLexicalGravityReturn {
  const vscode = useVSCodeApi();
  const [lenses, setLenses] = React.useState<WorkshopLexicalGravityLens[]>([]);
  const [storagePath, setStoragePath] = React.useState<string>();
  const [catalogError, setCatalogError] = React.useState<string>();
  const [previewResult, setPreviewResult] =
    React.useState<WorkshopLexicalGravityPreviewResultPayload | null>(null);
  const [lensCandidates, setLensCandidates] =
    React.useState<WorkshopLexicalGravityLensCandidatesPayload | null>(null);
  const [lensesSaved, setLensesSaved] =
    React.useState<WorkshopLexicalGravityLensesSavedPayload | null>(null);
  const [actionResult, setActionResult] =
    React.useState<WorkshopWidgetActionResultPayload | null>(null);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: 'webview.workshop.lexical-gravity', payload, timestamp: Date.now() });
  }, [vscode]);

  const requestLenses = React.useCallback(() => {
    post(MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES, {});
  }, [post]);
  const preview = React.useCallback((token: string, draft: WorkshopLexicalGravityDraft) => {
    post(MessageType.WORKSHOP_PREVIEW_LEXICAL_GRAVITY, { token, draft });
  }, [post]);
  const buildLens = React.useCallback((token: string, query: string) => {
    post(MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS, { token, query });
  }, [post]);
  const saveLenses = React.useCallback((
    token: string,
    query: string,
    candidateIds: string[]
  ) => {
    post(MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES, { token, query, candidateIds });
  }, [post]);
  const apply = React.useCallback((
    draft: WorkshopLexicalGravityDraft,
    widgetConfigId?: string
  ) => {
    post(MessageType.WORKSHOP_APPLY_STANDING_WIDGET, {
      widgetId: 'lexical-gravity',
      draft,
      widgetConfigId
    });
  }, [post]);
  const remove = React.useCallback(() => {
    post(MessageType.WORKSHOP_REMOVE_STANDING_WIDGET, { family: 'lexical-gravity' });
  }, [post]);

  const handleLensesData = React.useCallback((message: WorkshopLexicalGravityLensesDataMessage) => {
    setLenses(message.payload.lenses);
    setStoragePath(message.payload.storagePath);
    setCatalogError(message.payload.error);
  }, []);
  const handlePreviewResult = React.useCallback((message: WorkshopLexicalGravityPreviewResultMessage) => {
    setPreviewResult(message.payload);
  }, []);
  const handleCandidates = React.useCallback((message: WorkshopLexicalGravityLensCandidatesMessage) => {
    setLensCandidates(message.payload);
  }, []);
  const handleLensesSaved = React.useCallback((message: WorkshopLexicalGravityLensesSavedMessage) => {
    setLensesSaved(message.payload);
  }, []);
  const handleActionResult = React.useCallback((message: WorkshopWidgetActionResultMessage) => {
    if (message.payload.action !== 'commit') {setActionResult(message.payload);}
  }, []);
  const clearTransientResults = React.useCallback(() => {
    setPreviewResult(null);
    setLensCandidates(null);
    setLensesSaved(null);
    setActionResult(null);
  }, []);
  const consumeActionResult = React.useCallback(() => setActionResult(null), []);

  return {
    lenses,
    storagePath,
    catalogError,
    previewResult,
    lensCandidates,
    lensesSaved,
    actionResult,
    requestLenses,
    preview,
    buildLens,
    saveLenses,
    apply,
    remove,
    handleLensesData,
    handlePreviewResult,
    handleCandidates,
    handleLensesSaved,
    handleActionResult,
    clearTransientResults,
    consumeActionResult,
    persistedState: {}
  };
}
