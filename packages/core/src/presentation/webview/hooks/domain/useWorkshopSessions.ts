import * as React from 'react';
import { MessageType, type MessageSource, type RecentWorkshopSessionsResultPayload, type UnsavedWorkshopSessionsResultPayload } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

const useWorkshopSessionList = <Result extends RecentWorkshopSessionsResultPayload | UnsavedWorkshopSessionsResultPayload>(
  source: MessageSource, listType: MessageType, openType: MessageType
) => {
  const vscode = useVSCodeApi();
  const [rows, setRows] = React.useState<Result['rows']>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const pending = React.useRef<string>();
  const idPrefix = React.useRef(Math.random().toString(36).slice(2));
  const sequence = React.useRef(0);
  const request = React.useCallback((type: MessageType, token?: string) => {
    const requestId = `${source}-${idPrefix.current}-${++sequence.current}`;
    pending.current = requestId;
    setBusy(true);
    setError(undefined);
    vscode.postMessage({ type, source,
      payload: token === undefined ? { requestId } : { requestId, token }, timestamp: Date.now() });
  }, [source, vscode]);
  const refresh = React.useCallback(() => request(listType), [request, listType]);
  const open = (token: string) => request(openType, token);
  const receive = ({ payload }: { payload: Result }) => {
    if (payload.requestId !== pending.current) { return; }
    pending.current = undefined;
    setRows(payload.rows);
    setError(payload.error);
    setBusy(false);
  };
  return { rows, busy, error, refresh, open, receive, request };
};

export const useRecentWorkshopSessions = () => {
  const { rows, busy, error, refresh, open, receive } = useWorkshopSessionList<RecentWorkshopSessionsResultPayload>(
    'webview.workshop.recentSessions', MessageType.LIST_RECENT_WORKSHOP_SESSIONS, MessageType.OPEN_RECENT_WORKSHOP_SESSION
  );
  return { rows, busy, error, refresh, open, receive };
};

export const useUnsavedWorkshopSessions = () => {
  const { request, ...sessions } = useWorkshopSessionList<UnsavedWorkshopSessionsResultPayload>(
    'webview.workshop.unsavedSessions', MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS, MessageType.OPEN_UNSAVED_WORKSHOP_SESSION
  );
  const remove = (token: string) => request(MessageType.DELETE_UNSAVED_WORKSHOP_SESSION, token);
  return { ...sessions, remove };
};

export type RecentWorkshopSessions = ReturnType<typeof useRecentWorkshopSessions>;
export type UnsavedWorkshopSessions = ReturnType<typeof useUnsavedWorkshopSessions>;
