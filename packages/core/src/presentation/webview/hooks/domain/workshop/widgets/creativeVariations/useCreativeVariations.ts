/** Webview transport owner for Creative Variations generation and intake. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  createWorkshopWidgetActionRequestToken
} from '@hooks/domain/workshop/createWorkshopWidgetActionRequestToken';
import {
  reportWorkshopWidgetActionCorrelationIssue
} from '@hooks/domain/workshop/reportWorkshopWidgetActionCorrelationIssue';
import {
  MessageType,
  type WorkshopCreativeVariationsCommitPayload,
  type WorkshopCreativeVariationsDraft,
  type WorkshopCreativeVariationsGenerationProgressMessage,
  type WorkshopCreativeVariationsGenerationProgressPayload,
  type WorkshopCreativeVariationsResultMessage,
  type WorkshopCreativeVariationsResultPayload,
  type WorkshopWidgetActionResultMessage,
  type WorkshopWidgetActionResultPayload
} from '@messages';
interface ActiveCreativeVariationsAttempt {
  token: string;
  /** Minted by the host and latched from the first correlated callback. */
  workupId?: string;
}

let creativeVariationsTokenCounter = 0;

const createCreativeVariationsRequestToken = (): string =>
  `creative-variations-${Date.now()}-${++creativeVariationsTokenCounter}`;

export interface CreativeVariationsState {
  generationProgress: WorkshopCreativeVariationsGenerationProgressPayload | null;
  generationResult: WorkshopCreativeVariationsResultPayload | null;
  commitPending: boolean;
  commitResult: CreativeVariationsCommitResult | null;
}

export type CreativeVariationsCommitResult = Extract<
  WorkshopWidgetActionResultPayload,
  { action: 'commit'; widgetId: 'creative-variations' }
>;

export interface CreativeVariationsActions {
  requestSubjectSelection: () => void;
  generate: (draft: WorkshopCreativeVariationsDraft) => string;
  cancelGeneration: (token?: string) => void;
  commit: (
    payload: Omit<WorkshopCreativeVariationsCommitPayload, 'requestToken'>
  ) => string | undefined;
  handleCommitResult: (message: WorkshopWidgetActionResultMessage) => void;
  clearCommitResult: () => void;
  /** Recover a newly opened sheet from an acknowledgement lost with an older surface. */
  resetCommitState: () => void;
  handleGenerationProgress: (
    message: WorkshopCreativeVariationsGenerationProgressMessage
  ) => void;
  handleGenerationResult: (message: WorkshopCreativeVariationsResultMessage) => void;
}

export interface CreativeVariationsPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseCreativeVariationsReturn = CreativeVariationsState &
  CreativeVariationsActions & {
    persistedState: CreativeVariationsPersistence;
  };

export function useCreativeVariations(): UseCreativeVariationsReturn {
  const vscode = useVSCodeApi();
  const activeAttemptRef = React.useRef<ActiveCreativeVariationsAttempt>();
  const activeCommitTokenRef = React.useRef<string>();
  const [generationProgress, setGenerationProgress] =
    React.useState<WorkshopCreativeVariationsGenerationProgressPayload | null>(null);
  const [generationResult, setGenerationResult] =
    React.useState<WorkshopCreativeVariationsResultPayload | null>(null);
  const [commitPending, setCommitPending] = React.useState(false);
  const [commitResult, setCommitResult] =
    React.useState<CreativeVariationsCommitResult | null>(null);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({
      type,
      source: 'webview.workshop.creative-variations',
      payload,
      timestamp: Date.now()
    });
  }, [vscode]);

  const requestSubjectSelection = React.useCallback(() => {
    post(MessageType.REQUEST_SELECTION, {
      target: 'workshop_creative_variations_subject'
    });
  }, [post]);

  const generate = React.useCallback((draft: WorkshopCreativeVariationsDraft): string => {
    const token = createCreativeVariationsRequestToken();
    activeAttemptRef.current = { token };
    setGenerationProgress(null);
    setGenerationResult(null);
    post(MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE, {
      widgetId: 'creative-variations',
      token,
      subject: draft.subject,
      surroundingContext: draft.surroundingContext,
      invariants: draft.invariants,
      intent: draft.intent,
      requestedCount: draft.requestedCount
    });
    return token;
  }, [post]);

  const cancelGeneration = React.useCallback((token?: string) => {
    const active = activeAttemptRef.current;
    if (active && token !== undefined && token !== active.token) {
      return;
    }
    if (active) {
      vscode.postMessage(
        createCancelRequestMessage(
          'workshop-creative-variations',
          active.token,
          'webview.workshop.creative-variations'
        )
      );
    }
    activeAttemptRef.current = undefined;
    setGenerationProgress(null);
    setGenerationResult(null);
  }, [vscode]);

  const commit = React.useCallback((
    payload: Omit<WorkshopCreativeVariationsCommitPayload, 'requestToken'>
  ): string | undefined => {
    if (activeCommitTokenRef.current !== undefined) {
      return undefined;
    }
    const requestToken = createWorkshopWidgetActionRequestToken('commit');
    activeCommitTokenRef.current = requestToken;
    setCommitPending(true);
    setCommitResult(null);
    post(MessageType.WORKSHOP_COMMIT_WIDGET, { ...payload, requestToken });
    return requestToken;
  }, [post]);

  const handleCommitResult = React.useCallback((
    message: WorkshopWidgetActionResultMessage
  ) => {
    if (message.payload.action !== 'commit') {
      return;
    }
    const expectedToken = activeCommitTokenRef.current;
    if (message.payload.widgetId !== 'creative-variations') {
      if (message.payload.requestToken === expectedToken) {
        reportWorkshopWidgetActionCorrelationIssue(
          'useCreativeVariations',
          message,
          'expected widget creative-variations'
        );
      }
      return;
    }
    if (message.payload.requestToken !== expectedToken) {
      reportWorkshopWidgetActionCorrelationIssue(
        'useCreativeVariations',
        message,
        'no current commit request owns this token'
      );
      return;
    }
    activeCommitTokenRef.current = undefined;
    setCommitPending(false);
    setCommitResult(message.payload);
  }, []);

  const clearCommitResult = React.useCallback(() => {
    setCommitResult(null);
  }, []);

  const resetCommitState = React.useCallback(() => {
    activeCommitTokenRef.current = undefined;
    setCommitPending(false);
    setCommitResult(null);
  }, []);

  const handleGenerationProgress = React.useCallback(
    (message: WorkshopCreativeVariationsGenerationProgressMessage) => {
      const active = activeAttemptRef.current;
      const payload = message.payload;
      if (
        !active
        || payload.widgetId !== 'creative-variations'
        || payload.token !== active.token
        || (active.workupId !== undefined && payload.workupId !== active.workupId)
      ) {
        return;
      }
      active.workupId = payload.workupId;
      setGenerationProgress(payload);
      if (payload.phase === 'cancelled') {
        activeAttemptRef.current = undefined;
      }
    },
    []
  );

  const handleGenerationResult = React.useCallback(
    (message: WorkshopCreativeVariationsResultMessage) => {
      const active = activeAttemptRef.current;
      const payload = message.payload;
      if (
        !active
        || payload.widgetId !== 'creative-variations'
        || payload.token !== active.token
        || (active.workupId !== undefined && payload.workupId !== active.workupId)
        || (payload.ok && payload.workup.workupId !== payload.workupId)
      ) {
        return;
      }
      active.workupId = payload.workupId;
      activeAttemptRef.current = undefined;
      setGenerationProgress(null);
      setGenerationResult(payload);
    },
    []
  );

  return {
    generationProgress,
    generationResult,
    commitPending,
    commitResult,
    requestSubjectSelection,
    generate,
    cancelGeneration,
    commit,
    handleCommitResult,
    clearCommitResult,
    resetCommitState,
    handleGenerationProgress,
    handleGenerationResult,
    persistedState: {}
  };
}
