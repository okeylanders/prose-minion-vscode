/** Webview domain hook for Gesture Playground's transient authoring workflow. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  MessageType,
  WorkshopCommitWidgetPayload,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetGeneratePayload,
  WorkshopWidgetGenerationProgressMessage,
  WorkshopWidgetGenerationProgressPayload,
  WorkshopWidgetMenuResultMessage,
  WorkshopWidgetMenuResultPayload
} from '@messages';

export interface GesturePlaygroundState {
  widgetMenuResult: WorkshopWidgetMenuResultPayload | null;
  widgetGenerationProgress: WorkshopWidgetGenerationProgressPayload | null;
  widgetActionResult: WorkshopWidgetActionResultPayload | null;
}

export interface GesturePlaygroundActions {
  generateWidgetMenu: (payload: WorkshopWidgetGeneratePayload) => void;
  cancelWidgetGenerate: (requestId: string) => void;
  commitWidget: (payload: WorkshopCommitWidgetPayload) => void;
  handleWidgetMenuResult: (message: WorkshopWidgetMenuResultMessage) => void;
  handleWidgetGenerationProgress: (message: WorkshopWidgetGenerationProgressMessage) => void;
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
  const [widgetMenuResult, setWidgetMenuResult] =
    React.useState<WorkshopWidgetMenuResultPayload | null>(null);
  const [widgetGenerationProgress, setWidgetGenerationProgress] =
    React.useState<WorkshopWidgetGenerationProgressPayload | null>(null);
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

  const generateWidgetMenu = React.useCallback((payload: WorkshopWidgetGeneratePayload) => {
    setWidgetMenuResult(null);
    setWidgetGenerationProgress(null);
    post(MessageType.WORKSHOP_WIDGET_GENERATE, payload);
  }, [post]);

  const cancelWidgetGenerate = React.useCallback((requestId: string) => {
    vscode.postMessage(
      createCancelRequestMessage('workshop-widget', requestId, 'webview.workshop.widget')
    );
  }, [vscode]);

  const commitWidget = React.useCallback((payload: WorkshopCommitWidgetPayload) => {
    setWidgetActionResult(null);
    post(MessageType.WORKSHOP_COMMIT_WIDGET, payload);
  }, [post]);

  const handleWidgetMenuResult = React.useCallback(
    (message: WorkshopWidgetMenuResultMessage) => {
      setWidgetMenuResult(message.payload);
      setWidgetGenerationProgress((current) =>
        current?.token === message.payload.token ? null : current
      );
    },
    []
  );

  const handleWidgetGenerationProgress = React.useCallback(
    (message: WorkshopWidgetGenerationProgressMessage) => {
      setWidgetGenerationProgress(message.payload);
    },
    []
  );

  const handleWidgetActionResult = React.useCallback(
    (message: WorkshopWidgetActionResultMessage) => {
      if (
        message.payload.action === 'commit'
        && message.payload.widgetId === 'gesture-playground'
      ) {
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
