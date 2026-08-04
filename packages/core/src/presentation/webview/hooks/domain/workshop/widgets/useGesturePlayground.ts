/** Webview domain hook for Gesture Playground's transient authoring workflow. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  createWorkshopWidgetActionRequestToken
} from '@hooks/domain/workshop/createWorkshopWidgetActionRequestToken';
import {
  MessageType,
  WorkshopCommitWidgetPayload,
  WorkshopGesturePlaygroundGeneratePayload,
  WorkshopGesturePlaygroundGenerationProgressMessage,
  WorkshopGesturePlaygroundGenerationProgressPayload,
  WorkshopGesturePlaygroundMenuResultMessage,
  WorkshopGesturePlaygroundMenuResultPayload,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload
} from '@messages';

export interface GesturePlaygroundState {
  widgetMenuResult: WorkshopGesturePlaygroundMenuResultPayload | null;
  widgetGenerationProgress: WorkshopGesturePlaygroundGenerationProgressPayload | null;
  widgetActionResult: WorkshopWidgetActionResultPayload | null;
}

export interface GesturePlaygroundActions {
  generateWidgetMenu: (payload: WorkshopGesturePlaygroundGeneratePayload) => void;
  cancelWidgetGenerate: (requestId: string) => void;
  commitWidget: (payload: Omit<WorkshopCommitWidgetPayload, 'requestToken'>) => void;
  handleWidgetMenuResult: (message: WorkshopGesturePlaygroundMenuResultMessage) => void;
  handleWidgetGenerationProgress: (
    message: WorkshopGesturePlaygroundGenerationProgressMessage
  ) => void;
  handleWidgetActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  consumeWidgetActionResult: () => void;
}

export interface GesturePlaygroundPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseGesturePlaygroundReturn = GesturePlaygroundState &
  GesturePlaygroundActions & {
    persistedState: GesturePlaygroundPersistence;
  };

export function useGesturePlayground(): UseGesturePlaygroundReturn {
  const vscode = useVSCodeApi();
  const latestCommitRequestTokenRef = React.useRef<string>();
  const [widgetMenuResult, setWidgetMenuResult] =
    React.useState<WorkshopGesturePlaygroundMenuResultPayload | null>(null);
  const [widgetGenerationProgress, setWidgetGenerationProgress] =
    React.useState<WorkshopGesturePlaygroundGenerationProgressPayload | null>(null);
  const [widgetActionResult, setWidgetActionResult] =
    React.useState<WorkshopWidgetActionResultPayload | null>(null);

  const post = React.useCallback((type: MessageType, payload: unknown) => {
    vscode.postMessage({
      type,
      source: 'webview.workshop',
      payload,
      timestamp: Date.now()
    });
  }, [vscode]);

  const generateWidgetMenu = React.useCallback((payload: WorkshopGesturePlaygroundGeneratePayload) => {
    setWidgetMenuResult(null);
    setWidgetGenerationProgress(null);
    post(MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATE, payload);
  }, [post]);

  const cancelWidgetGenerate = React.useCallback((requestId: string) => {
    vscode.postMessage(
      createCancelRequestMessage(
        'workshop-gesture-playground',
        requestId,
        'webview.workshop.gesture-playground'
      )
    );
  }, [vscode]);

  const commitWidget = React.useCallback((
    payload: Omit<WorkshopCommitWidgetPayload, 'requestToken'>
  ) => {
    const requestToken = createWorkshopWidgetActionRequestToken('commit');
    latestCommitRequestTokenRef.current = requestToken;
    setWidgetActionResult(null);
    post(MessageType.WORKSHOP_COMMIT_WIDGET, { ...payload, requestToken });
  }, [post]);

  const handleWidgetMenuResult = React.useCallback(
    (message: WorkshopGesturePlaygroundMenuResultMessage) => {
      setWidgetMenuResult(message.payload);
      setWidgetGenerationProgress((current) =>
        current?.token === message.payload.token ? null : current
      );
    },
    []
  );

  const handleWidgetGenerationProgress = React.useCallback(
    (message: WorkshopGesturePlaygroundGenerationProgressMessage) => {
      setWidgetGenerationProgress(message.payload);
    },
    []
  );

  const handleWidgetActionResult = React.useCallback(
    (message: WorkshopWidgetActionResultMessage) => {
      if (
        message.payload.action === 'commit'
        && message.payload.widgetId === 'gesture-playground'
        && message.payload.requestToken === latestCommitRequestTokenRef.current
      ) {
        latestCommitRequestTokenRef.current = undefined;
        setWidgetActionResult(message.payload);
      }
    },
    []
  );

  const consumeWidgetActionResult = React.useCallback(
    () => setWidgetActionResult(null),
    []
  );

  return {
    widgetMenuResult,
    widgetGenerationProgress,
    widgetActionResult,
    generateWidgetMenu,
    cancelWidgetGenerate,
    commitWidget,
    handleWidgetMenuResult,
    handleWidgetGenerationProgress,
    handleWidgetActionResult,
    consumeWidgetActionResult,
    persistedState: {}
  };
}
