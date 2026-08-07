/** Named-session browser and action owner for the Workshop presentation. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  MessageType,
  WorkshopSessionAction,
  WorkshopSessionActionResultMessage,
  WorkshopSessionRecoveryNoticeMessage,
  WorkshopSessionSaveStatusMessage,
  WorkshopSessionSummary,
  WorkshopSessionsDataMessage
} from '@messages';
import type {
  WorkshopRoomReplacementPort,
  WorkshopRoomThreadSnapshot
} from './useWorkshopRoom';

export interface WorkshopSessionsState {
  sessionsAvailable: boolean | null;
  sessionsUnavailableReason?: 'no-workspace' | 'multi-root';
  currentSessionSummary?: WorkshopSessionSummary;
  /** Stable active named-room identity; browser search results must not erase it. */
  activeNamedSessionSummary?: WorkshopSessionSummary;
  savedSessionSummaries: WorkshopSessionSummary[];
  sessionsTruncated: boolean;
  sessionsSearchTruncated: boolean;
  sessionsPending: boolean;
  sessionsError?: string;
  sessionSearchQuery: string;
  sessionActionPending?: WorkshopSessionAction;
  sessionActionResult?: WorkshopSessionActionResultMessage['payload'];
  sessionSaveStatus?: WorkshopSessionSaveStatusMessage['payload'];
  recoveryNotices: WorkshopSessionRecoveryNoticeMessage['payload'][];
}

export interface WorkshopSessionsActions {
  resetSession: (options?: { clearWorkingSet?: boolean }) => void;
  requestSessions: (query?: string) => void;
  setSessionSearchQuery: (query: string) => void;
  saveSession: (title: string, sessionId?: string) => void;
  openSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  duplicateSession: (sessionId: string, title?: string) => void;
  revealSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  consumeSessionActionResult: () => void;
  handleSessionsData: (message: WorkshopSessionsDataMessage) => void;
  handleSessionActionResult: (message: WorkshopSessionActionResultMessage) => void;
  handleSessionSaveStatus: (message: WorkshopSessionSaveStatusMessage) => void;
  handleSessionRecoveryNotice: (message: WorkshopSessionRecoveryNoticeMessage) => void;
  consumeRecoveryNotice: () => void;
}

export type WorkshopSessionsPersistence = Record<string, never>;

export type UseWorkshopSessionsReturn = WorkshopSessionsState & WorkshopSessionsActions & {
  persistedState: WorkshopSessionsPersistence;
};

export function useWorkshopSessions(
  roomReplacement: WorkshopRoomReplacementPort
): UseWorkshopSessionsReturn {
  const vscode = useVSCodeApi();
  const [sessionsAvailable, setSessionsAvailable] = React.useState<boolean | null>(null);
  const [sessionsUnavailableReason, setSessionsUnavailableReason] = React.useState<
    'no-workspace' | 'multi-root' | undefined
  >();
  const [currentSessionSummary, setCurrentSessionSummary] = React.useState<WorkshopSessionSummary>();
  const [activeNamedSessionSummary, setActiveNamedSessionSummary] =
    React.useState<WorkshopSessionSummary>();
  const [savedSessionSummaries, setSavedSessionSummaries] =
    React.useState<WorkshopSessionSummary[]>([]);
  const [sessionsTruncated, setSessionsTruncated] = React.useState(false);
  const [sessionsSearchTruncated, setSessionsSearchTruncated] = React.useState(false);
  const [sessionsPending, setSessionsPending] = React.useState(false);
  const [sessionsError, setSessionsError] = React.useState<string>();
  const [sessionSearchQuery, setSessionSearchQuery] = React.useState('');
  const [sessionActionResult, setSessionActionResult] = React.useState<
    WorkshopSessionActionResultMessage['payload']
  >();
  const [sessionActionPending, setSessionActionPending] =
    React.useState<WorkshopSessionAction>();
  const [sessionSaveStatus, setSessionSaveStatus] =
    React.useState<WorkshopSessionSaveStatusMessage['payload']>();
  const [recoveryNotices, setRecoveryNotices] = React.useState<
    WorkshopSessionRecoveryNoticeMessage['payload'][]
  >([]);
  const latestSessionsRequestIdRef = React.useRef<string>();
  const latestSessionsQueryRef = React.useRef('');
  const sessionsRequestCounterRef = React.useRef(0);
  const pendingResetRollbackRef = React.useRef<WorkshopRoomThreadSnapshot>();
  const pendingNamedActionRef = React.useRef<{
    action: 'save' | 'rename' | 'delete';
    sessionId: string;
    title?: string;
  }>();

  const post = React.useCallback((type: MessageType, payload: unknown) => {
    vscode.postMessage({
      type,
      source: 'webview.workshop',
      payload,
      timestamp: Date.now()
    });
  }, [vscode]);

  const resetSession = React.useCallback((options: { clearWorkingSet?: boolean } = {}) => {
    setSessionActionPending('new');
    pendingResetRollbackRef.current = roomReplacement.beginReplacement();
    post(MessageType.WORKSHOP_RESET_SESSION, {
      ...(options.clearWorkingSet ? { clearWorkingSet: true } : {})
    });
  }, [post, roomReplacement]);

  const requestSessions = React.useCallback((query?: string) => {
    const nextQuery = query ?? sessionSearchQuery;
    const requestId = `workshop-sessions-${Date.now()}-${++sessionsRequestCounterRef.current}`;
    latestSessionsRequestIdRef.current = requestId;
    latestSessionsQueryRef.current = nextQuery.trim();
    setSessionsPending(true);
    setSessionsError(undefined);
    post(MessageType.WORKSHOP_LIST_SESSIONS, {
      requestId,
      ...(nextQuery.trim() ? { query: nextQuery.trim() } : {})
    });
  }, [post, sessionSearchQuery]);

  const saveSession = React.useCallback((title: string, sessionId?: string) => {
    setSessionActionPending('save');
    pendingNamedActionRef.current = sessionId
      ? { action: 'save', sessionId, title }
      : undefined;
    post(MessageType.WORKSHOP_SAVE_SESSION, {
      title,
      ...(sessionId ? { sessionId } : {})
    });
  }, [post]);

  const openSession = React.useCallback((sessionId: string) => {
    setSessionActionPending('open');
    post(MessageType.WORKSHOP_OPEN_SESSION, { sessionId });
  }, [post]);

  const renameSession = React.useCallback((sessionId: string, title: string) => {
    setSessionActionPending('rename');
    pendingNamedActionRef.current = { action: 'rename', sessionId, title };
    post(MessageType.WORKSHOP_RENAME_SESSION, { sessionId, title });
  }, [post]);

  const duplicateSession = React.useCallback((sessionId: string, title?: string) => {
    setSessionActionPending('duplicate');
    post(MessageType.WORKSHOP_DUPLICATE_SESSION, {
      sessionId,
      ...(title?.trim() ? { title: title.trim() } : {})
    });
  }, [post]);

  const revealSession = React.useCallback((sessionId: string) => {
    post(MessageType.WORKSHOP_REVEAL_SESSION, { sessionId });
  }, [post]);

  const deleteSession = React.useCallback((sessionId: string) => {
    setSessionActionPending('delete');
    pendingNamedActionRef.current = { action: 'delete', sessionId };
    post(MessageType.WORKSHOP_DELETE_SESSION, { sessionId });
  }, [post]);

  const consumeSessionActionResult = React.useCallback(() => {
    setSessionActionResult(undefined);
  }, []);

  const handleSessionsData = React.useCallback((message: WorkshopSessionsDataMessage) => {
    if (message.payload.requestId !== latestSessionsRequestIdRef.current) {
      return;
    }
    setSessionsPending(false);
    setSessionsAvailable(message.payload.available);
    setSessionsUnavailableReason(message.payload.unavailableReason);
    setSessionsError(message.payload.error);
    setCurrentSessionSummary(message.payload.current);
    setSavedSessionSummaries(message.payload.sessions);
    if (!message.payload.error) {
      const activeNamedSession = message.payload.current
        ? message.payload.sessions.find(
            (session) => session.sessionId === message.payload.current?.sessionId
          )
        : undefined;
      if (activeNamedSession) {
        setActiveNamedSessionSummary(activeNamedSession);
      } else if (latestSessionsQueryRef.current === '') {
        setActiveNamedSessionSummary(undefined);
      }
    }
    setSessionsTruncated(!!message.payload.truncated);
    setSessionsSearchTruncated(!!message.payload.searchTruncated);
  }, []);

  const handleSessionActionResult = React.useCallback(
    (message: WorkshopSessionActionResultMessage) => {
      if (message.payload.action === 'new') {
        const rollback = pendingResetRollbackRef.current;
        if (!message.payload.ok && rollback) {
          roomReplacement.restoreReplacement(rollback);
        }
        pendingResetRollbackRef.current = undefined;
      }
      const pendingNamedAction = pendingNamedActionRef.current;
      if (pendingNamedAction?.action === message.payload.action) {
        if (message.payload.ok) {
          setActiveNamedSessionSummary((active) => {
            if (active?.sessionId !== pendingNamedAction.sessionId) {
              return active;
            }
            if (pendingNamedAction.action === 'delete') {
              return undefined;
            }
            return pendingNamedAction.title
              ? { ...active, title: pendingNamedAction.title }
              : active;
          });
        }
        pendingNamedActionRef.current = undefined;
      }
      if (message.payload.action === 'new' && message.payload.ok) {
        setActiveNamedSessionSummary(undefined);
      }
      setSessionActionPending((pending) =>
        pending === message.payload.action ? undefined : pending
      );
      setSessionActionResult(message.payload);
    },
    [roomReplacement]
  );

  const handleSessionSaveStatus = React.useCallback((message: WorkshopSessionSaveStatusMessage) => {
    setSessionSaveStatus(message.payload);
  }, []);

  const handleSessionRecoveryNotice = React.useCallback(
    (message: WorkshopSessionRecoveryNoticeMessage) => {
      setRecoveryNotices((current) => {
        const key = `${message.payload.code}:${message.payload.configId}`;
        if (current.some((notice) => `${notice.code}:${notice.configId}` === key)) {
          return current;
        }
        return current.length >= 8
          ? current
          : [...current, { ...message.payload }];
      });
    },
    []
  );

  const consumeRecoveryNotice = React.useCallback(() => {
    setRecoveryNotices((current) => current.slice(1));
  }, []);

  return {
    sessionsAvailable,
    sessionsUnavailableReason,
    currentSessionSummary,
    activeNamedSessionSummary,
    savedSessionSummaries,
    sessionsTruncated,
    sessionsSearchTruncated,
    sessionsPending,
    sessionsError,
    sessionSearchQuery,
    sessionActionPending,
    sessionActionResult,
    sessionSaveStatus,
    recoveryNotices,
    resetSession,
    requestSessions,
    setSessionSearchQuery,
    saveSession,
    openSession,
    renameSession,
    duplicateSession,
    revealSession,
    deleteSession,
    consumeSessionActionResult,
    handleSessionsData,
    handleSessionActionResult,
    handleSessionSaveStatus,
    handleSessionRecoveryNotice,
    consumeRecoveryNotice,
    persistedState: {}
  };
}
