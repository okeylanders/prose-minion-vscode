import * as React from 'react';
import { MessageType, type UnsavedWorkshopSessionRow, type UnsavedWorkshopSessionsResultPayload } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

export const useUnsavedWorkshopSessions = () => {
  const vscode = useVSCodeApi();
  const [rows, setRows] = React.useState<UnsavedWorkshopSessionRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const pending = React.useRef<string>();
  const idPrefix = React.useRef(Math.random().toString(36).slice(2));
  const sequence = React.useRef(0);
  const request = React.useCallback((type: MessageType, token?: string) => {
    const requestId = `unsaved-${idPrefix.current}-${++sequence.current}`;
    pending.current = requestId;
    setBusy(true);
    setError(undefined);
    vscode.postMessage({ type, source: 'webview.workshop.unsavedSessions',
      payload: token === undefined ? { requestId } : { requestId, token }, timestamp: Date.now() });
  }, [vscode]);
  const refresh = React.useCallback(() => request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS), [request]);
  const open = (token: string) => request(MessageType.OPEN_UNSAVED_WORKSHOP_SESSION, token);
  const remove = (token: string) => request(MessageType.DELETE_UNSAVED_WORKSHOP_SESSION, token);
  const receive = ({ payload }: { payload: UnsavedWorkshopSessionsResultPayload }) => {
    if (payload.requestId !== pending.current) { return; }
    pending.current = undefined;
    setRows(payload.rows);
    setError(payload.error);
    setBusy(false);
  };
  return { rows, busy, error, refresh, open, remove, receive };
};

export type UnsavedWorkshopSessions = ReturnType<typeof useUnsavedWorkshopSessions>;
