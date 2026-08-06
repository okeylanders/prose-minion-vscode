/** Webview domain hook for family-generic Workshop widget-host mechanics. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  MessageType,
  WorkshopWidgetConfigDataMessage,
  WorkshopWidgetConfigSnapshot
} from '@messages';

export interface WorkshopWidgetHostState {
  widgetConfigData: WorkshopWidgetConfigSnapshot | null;
  widgetConfigResponseId: string | null;
  widgetConfigError: string | null;
}

export interface WorkshopWidgetHostActions {
  requestWidgetConfig: (configId: string) => void;
  clearWidgetConfigData: () => void;
  handleWidgetConfigData: (message: WorkshopWidgetConfigDataMessage) => void;
}

export interface WorkshopWidgetHostPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseWorkshopWidgetHostReturn = WorkshopWidgetHostState &
  WorkshopWidgetHostActions & {
    persistedState: WorkshopWidgetHostPersistence;
  };

export function useWorkshopWidgetHost(): UseWorkshopWidgetHostReturn {
  const vscode = useVSCodeApi();
  const [widgetConfigData, setWidgetConfigData] =
    React.useState<WorkshopWidgetConfigSnapshot | null>(null);
  const [widgetConfigResponseId, setWidgetConfigResponseId] = React.useState<string | null>(null);
  const [widgetConfigError, setWidgetConfigError] = React.useState<string | null>(null);

  const requestWidgetConfig = React.useCallback((configId: string) => {
    setWidgetConfigData(null);
    setWidgetConfigResponseId(null);
    setWidgetConfigError(null);
    vscode.postMessage({
      type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      source: 'webview.workshop',
      payload: { configId },
      timestamp: Date.now()
    });
  }, [vscode]);

  const clearWidgetConfigData = React.useCallback(() => {
    setWidgetConfigData(null);
    setWidgetConfigResponseId(null);
    setWidgetConfigError(null);
  }, []);

  const handleWidgetConfigData = React.useCallback(
    (message: WorkshopWidgetConfigDataMessage) => {
      setWidgetConfigResponseId(message.payload.configId);
      setWidgetConfigData(message.payload.config ?? null);
      setWidgetConfigError(message.payload.error ?? null);
    },
    []
  );

  return {
    widgetConfigData,
    widgetConfigResponseId,
    widgetConfigError,
    requestWidgetConfig,
    clearWidgetConfigData,
    handleWidgetConfigData,
    persistedState: {}
  };
}
