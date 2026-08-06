/** Presentation owner for named-session menus, sheets, confirmation, and shortcuts. */

import * as React from 'react';
import {
  WorkshopSessionActionResultMessage,
  WorkshopSessionSummary
} from '@messages';

export type WorkshopSessionConfirm =
  | { kind: 'new' }
  | { kind: 'new-full' }
  | { kind: 'open'; sessionId: string; title: string }
  | { kind: 'replace-shelf'; resume: 'paste' | 'choose' };

/** Work this controller cannot resolve alone; the shell must finish it. */
export type WorkshopSessionConfirmResumption = { resume: 'paste' | 'choose' };

export interface UseWorkshopSessionSurfacesOptions {
  sessionReady: boolean;
  persistenceAvailable: boolean;
  sessionMutationsDisabled: boolean;
  hasReplaceableSessionState: boolean;
  hasWorkingSet: boolean;
  sessionSearchQuery: string;
  sessionActionResult?: WorkshopSessionActionResultMessage['payload'];
  requestSessions: (query?: string) => void;
  setSessionSearchQuery: (query: string) => void;
  resetSession: (options?: { clearWorkingSet?: boolean }) => void;
  openSession: (sessionId: string) => void;
  consumeSessionActionResult: () => void;
  onResult: (result: WorkshopSessionActionResultMessage['payload']) => void;
}

export interface WorkshopSessionSurfacesState {
  sessionsMenuOpen: boolean;
  saveSessionModalOpen: boolean;
  sessionBrowserOpen: boolean;
  sessionConfirm: WorkshopSessionConfirm | null;
}

export interface WorkshopSessionSurfacesActions {
  setSessionsMenuVisibility: (open: boolean) => void;
  openSaveSessionModal: () => void;
  closeSaveSessionModal: () => void;
  openSessionBrowser: () => void;
  closeSessionBrowser: () => void;
  startNewSession: () => void;
  startFullReset: () => void;
  openStoredSession: (session: WorkshopSessionSummary) => void;
  requestShelfReplacement: (resume: 'paste' | 'choose') => void;
  acceptSessionConfirm: () => WorkshopSessionConfirmResumption | undefined;
  cancelSessionConfirm: () => void;
}

export interface WorkshopSessionSurfacesPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseWorkshopSessionSurfacesReturn = WorkshopSessionSurfacesState &
  WorkshopSessionSurfacesActions & {
    persistedState: WorkshopSessionSurfacesPersistence;
  };

export function useWorkshopSessionSurfaces({
  sessionReady,
  persistenceAvailable,
  sessionMutationsDisabled,
  hasReplaceableSessionState,
  hasWorkingSet,
  sessionSearchQuery,
  sessionActionResult,
  requestSessions,
  setSessionSearchQuery,
  resetSession,
  openSession,
  consumeSessionActionResult,
  onResult
}: UseWorkshopSessionSurfacesOptions): UseWorkshopSessionSurfacesReturn {
  const [sessionsMenuOpen, setSessionsMenuOpen] = React.useState(false);
  const [saveSessionModalOpen, setSaveSessionModalOpen] = React.useState(false);
  const [sessionBrowserOpen, setSessionBrowserOpen] = React.useState(false);
  const [sessionConfirm, setSessionConfirm] = React.useState<WorkshopSessionConfirm | null>(null);
  const sessionListInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!sessionReady || sessionListInitializedRef.current) {
      return;
    }
    sessionListInitializedRef.current = true;
    requestSessions('');
  }, [requestSessions, sessionReady]);

  React.useEffect(() => {
    if (!sessionBrowserOpen) {
      return undefined;
    }
    const timer = window.setTimeout(() => requestSessions(), 220);
    return () => window.clearTimeout(timer);
  }, [requestSessions, sessionBrowserOpen, sessionSearchQuery]);

  React.useEffect(() => {
    if (!sessionActionResult) {
      return;
    }
    onResult(sessionActionResult);
    if (sessionActionResult.ok && sessionActionResult.action === 'save') {
      setSaveSessionModalOpen(false);
    }
    if (
      sessionActionResult.ok &&
      (sessionActionResult.action === 'open' || sessionActionResult.action === 'new')
    ) {
      setSessionBrowserOpen(false);
    }
    const sessionIndexChanged =
      sessionActionResult.ok && sessionActionResult.action !== 'reveal';
    const activeRoomIdentityChanged = sessionActionResult.ok && (
      sessionActionResult.action === 'save' ||
      sessionActionResult.action === 'open' ||
      sessionActionResult.action === 'new'
    );
    if (activeRoomIdentityChanged) {
      requestSessions('');
    } else if (sessionBrowserOpen || sessionsMenuOpen || sessionIndexChanged) {
      requestSessions();
    }
    consumeSessionActionResult();
  }, [
    consumeSessionActionResult,
    onResult,
    requestSessions,
    sessionActionResult,
    sessionBrowserOpen,
    sessionsMenuOpen
  ]);

  const setSessionsMenuVisibility = React.useCallback((open: boolean) => {
    setSessionsMenuOpen(open);
    if (open) {
      requestSessions('');
    }
  }, [requestSessions]);

  const openSaveSessionModal = React.useCallback(() => {
    setSessionsMenuOpen(false);
    setSessionBrowserOpen(false);
    setSaveSessionModalOpen(true);
  }, []);

  const closeSaveSessionModal = React.useCallback(() => setSaveSessionModalOpen(false), []);

  const openSessionBrowser = React.useCallback(() => {
    setSessionsMenuOpen(false);
    setSaveSessionModalOpen(false);
    setSessionSearchQuery('');
    setSessionBrowserOpen(true);
  }, [setSessionSearchQuery]);

  const closeSessionBrowser = React.useCallback(() => setSessionBrowserOpen(false), []);

  const startNewSession = React.useCallback(() => {
    if (hasReplaceableSessionState) {
      setSessionConfirm({ kind: 'new' });
      return;
    }
    resetSession();
  }, [hasReplaceableSessionState, resetSession]);

  const startFullReset = React.useCallback(() => {
    if (hasReplaceableSessionState || hasWorkingSet) {
      setSessionConfirm({ kind: 'new-full' });
      return;
    }
    resetSession({ clearWorkingSet: true });
  }, [hasReplaceableSessionState, hasWorkingSet, resetSession]);

  const openStoredSession = React.useCallback((session: WorkshopSessionSummary) => {
    if (hasReplaceableSessionState) {
      setSessionConfirm({
        kind: 'open',
        sessionId: session.sessionId,
        title: session.title
      });
      return;
    }
    openSession(session.sessionId);
  }, [hasReplaceableSessionState, openSession]);

  const requestShelfReplacement = React.useCallback((resume: 'paste' | 'choose') => {
    setSessionConfirm({ kind: 'replace-shelf', resume });
  }, []);

  const acceptSessionConfirm = React.useCallback(() => {
    if (!sessionConfirm) {
      return undefined;
    }
    setSessionConfirm(null);
    if (sessionConfirm.kind === 'new') {
      resetSession();
    } else if (sessionConfirm.kind === 'new-full') {
      resetSession({ clearWorkingSet: true });
    } else if (sessionConfirm.kind === 'open') {
      openSession(sessionConfirm.sessionId);
    } else {
      return { resume: sessionConfirm.resume };
    }
    return undefined;
  }, [openSession, resetSession, sessionConfirm]);

  const cancelSessionConfirm = React.useCallback(() => setSessionConfirm(null), []);

  React.useEffect(() => {
    const handleSessionShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (event.key.toLocaleLowerCase() === 's' && !event.shiftKey) {
        event.preventDefault();
        if (sessionReady && persistenceAvailable && !sessionMutationsDisabled) {
          openSaveSessionModal();
        }
      }
      if (event.key.toLocaleLowerCase() === 'n' && event.shiftKey) {
        event.preventDefault();
        if (sessionReady && !sessionMutationsDisabled) {
          startNewSession();
        }
      }
    };
    window.addEventListener('keydown', handleSessionShortcut);
    return () => window.removeEventListener('keydown', handleSessionShortcut);
  }, [
    openSaveSessionModal,
    persistenceAvailable,
    sessionMutationsDisabled,
    sessionReady,
    startNewSession
  ]);

  return {
    sessionsMenuOpen,
    saveSessionModalOpen,
    sessionBrowserOpen,
    sessionConfirm,
    setSessionsMenuVisibility,
    openSaveSessionModal,
    closeSaveSessionModal,
    openSessionBrowser,
    closeSessionBrowser,
    startNewSession,
    startFullReset,
    openStoredSession,
    requestShelfReplacement,
    acceptSessionConfirm,
    cancelSessionConfirm,
    persistedState: {}
  };
}
