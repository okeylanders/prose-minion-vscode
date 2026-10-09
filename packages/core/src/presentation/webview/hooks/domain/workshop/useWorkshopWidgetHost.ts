/** Webview domain hook for family-generic Workshop widget-host mechanics. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  MessageType,
  WorkshopSessionStateMessage,
  WorkshopWidgetConfigDataMessage,
  WorkshopWidgetConfigRestoredMessage,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetConfigSummary
} from '@messages';

export interface WorkshopWidgetHostState {
  widgetConfigData: WorkshopWidgetConfigSnapshot | null;
  widgetConfigResponseId: string | null;
  widgetConfigError: string | null;
  /**
   * A config the host released by rewinding its widget message, waiting for
   * the opening controller to reopen it (ADR 2026-09-30, Sprint 03 kickoff
   * decision 3).
   */
  restoredWidgetConfigId: string | null;
  /**
   * Bounded identities of the committed configs behind the visible thread
   * window, keyed by config id. A chip reads display counts here, so the
   * persisted turn stays exactly as it is. Mirrored from the host snapshot.
   */
  widgetConfigSummaries: Readonly<Record<string, WorkshopWidgetConfigSummary>>;
}

export interface WorkshopWidgetHostActions {
  requestWidgetConfig: (configId: string) => void;
  clearWidgetConfigData: () => void;
  handleWidgetConfigData: (message: WorkshopWidgetConfigDataMessage) => void;
  handleWidgetConfigRestored: (message: WorkshopWidgetConfigRestoredMessage) => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  consumeRestoredWidgetConfig: () => void;
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
  const [restoredWidgetConfigId, setRestoredWidgetConfigId] = React.useState<string | null>(null);

  const [widgetConfigSummaries, setWidgetConfigSummaries] =
    React.useState<Readonly<Record<string, WorkshopWidgetConfigSummary>>>({});

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    setWidgetConfigSummaries(Object.fromEntries(
      (message.payload.session.widgetConfigs ?? []).map((config) => [config.id, config])
    ));
  }, []);

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

  const handleWidgetConfigRestored = React.useCallback(
    (message: WorkshopWidgetConfigRestoredMessage) => {
      setRestoredWidgetConfigId(message.payload.widgetConfigId);
    },
    []
  );

  const consumeRestoredWidgetConfig = React.useCallback(() => {
    setRestoredWidgetConfigId(null);
  }, []);

  return {
    widgetConfigData,
    widgetConfigResponseId,
    widgetConfigError,
    restoredWidgetConfigId,
    widgetConfigSummaries,
    requestWidgetConfig,
    clearWidgetConfigData,
    handleWidgetConfigData,
    handleWidgetConfigRestored,
    handleSessionState,
    consumeRestoredWidgetConfig,
    persistedState: {}
  };
}
