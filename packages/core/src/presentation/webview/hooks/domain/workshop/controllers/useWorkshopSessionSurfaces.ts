/** Presentation owner for named-session menus, sheets, confirmation, and shortcuts. */

import * as React from 'react';
import {
  WorkshopSessionActionResultMessage,
  WorkshopSessionSummary
} from '@messages';

/**
 * What a writer-message rewind hands back for editing: its text to the
 * composer, or a widget commit's released config to its widget sheet.
 */
export type WorkshopRewindEdit = 'composer' | 'widget';

export type WorkshopSessionConfirm =
  | { kind: 'new' }
  | { kind: 'new-full' }
  | { kind: 'open'; sessionId: string; title: string }
  | { kind: 'replace-shelf'; resume: 'paste' | 'choose' }
  /**
   * Rewind to one bubble (ADR 2026-09-30, D4: Rewind confirms). `edit` marks a
   * writer message, which returns for editing; a reply has none.
   */
  | { kind: 'rewind'; turnId: string; removedCount: number; edit?: WorkshopRewindEdit }
  /**
   * Branch from an unsaved room (ADR 2026-09-30, D2): nothing is sent. The
   * writer saves first, then branches again; nothing saves automatically.
   */
  | { kind: 'save-before-branch' };

/** Work this controller cannot resolve alone; the shell must finish it. */
export type WorkshopSessionConfirmResumption = { resume: 'paste' | 'choose' };

export interface UseWorkshopSessionSurfacesOptions {
  sessionReady: boolean;
  persistenceAvailable: boolean;
  sessionMutationsDisabled: boolean;
  hasReplaceableSessionState: boolean;
  hasWorkingSet: boolean;
  /** The live room is a saved, named session: the one kind Branch accepts (D2). */
  roomIsNamed: boolean;
  sessionSearchQuery: string;
  sessionActionResult?: WorkshopSessionActionResultMessage['payload'];
  requestSessions: (query?: string) => void;
  setSessionSearchQuery: (query: string) => void;
  resetSession: (options?: { clearWorkingSet?: boolean }) => void;
  openSession: (sessionId: string) => void;
  rewindTo: (turnId: string) => void;
  branchFrom: (turnId: string) => void;
  consumeSessionActionResult: () => void;
  onResult: (result: WorkshopSessionActionResultMessage['payload']) => void;
}

export interface WorkshopSessionSurfacesState {
  sessionsMenuOpen: boolean;
  saveSessionModalOpen: boolean;
  exportSessionModalOpen: boolean;
  sessionBrowserOpen: boolean;
  sessionConfirm: WorkshopSessionConfirm | null;
}

export interface WorkshopSessionSurfacesActions {
  setSessionsMenuVisibility: (open: boolean) => void;
  openSaveSessionModal: () => void;
  closeSaveSessionModal: () => void;
  openExportSessionModal: () => void;
  closeExportSessionModal: () => void;
  openSessionBrowser: () => void;
  closeSessionBrowser: () => void;
  startNewSession: () => void;
  startFullReset: () => void;
  openStoredSession: (session: WorkshopSessionSummary) => void;
  requestShelfReplacement: (resume: 'paste' | 'choose') => void;
  requestRewind: (turnId: string, removedCount: number, edit?: WorkshopRewindEdit) => void;
  requestBranch: (turnId: string) => void;
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
  roomIsNamed,
  sessionSearchQuery,
  sessionActionResult,
  requestSessions,
  setSessionSearchQuery,
  resetSession,
  openSession,
  rewindTo,
  branchFrom,
  consumeSessionActionResult,
  onResult
}: UseWorkshopSessionSurfacesOptions): UseWorkshopSessionSurfacesReturn {
  const [sessionsMenuOpen, setSessionsMenuOpen] = React.useState(false);
  const [saveSessionModalOpen, setSaveSessionModalOpen] = React.useState(false);
  const [exportSessionModalOpen, setExportSessionModalOpen] = React.useState(false);
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
    if (sessionActionResult.ok && sessionActionResult.action === 'export') {
      setExportSessionModalOpen(false);
    }
    if (
      sessionActionResult.ok && (
        sessionActionResult.action === 'open' ||
        sessionActionResult.action === 'new' ||
        sessionActionResult.action === 'branch'
      )
    ) {
      setSessionBrowserOpen(false);
    }
    // Reveal and Export read sessions; neither changes the saved-session index.
    const sessionIndexChanged =
      sessionActionResult.ok &&
      sessionActionResult.action !== 'reveal' &&
      sessionActionResult.action !== 'export';
    const activeRoomIdentityChanged = sessionActionResult.ok && (
      sessionActionResult.action === 'save' ||
      sessionActionResult.action === 'open' ||
      sessionActionResult.action === 'new' ||
      sessionActionResult.action === 'branch'
    );
    // A branch that was saved but not opened still added a session.
    if (activeRoomIdentityChanged || sessionActionResult.action === 'branch') {
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
    setExportSessionModalOpen(false);
    setSaveSessionModalOpen(true);
  }, []);

  const closeSaveSessionModal = React.useCallback(() => setSaveSessionModalOpen(false), []);

  const openExportSessionModal = React.useCallback(() => {
    setSessionsMenuOpen(false);
    setSessionBrowserOpen(false);
    setSaveSessionModalOpen(false);
    setExportSessionModalOpen(true);
  }, []);

  const closeExportSessionModal = React.useCallback(() => setExportSessionModalOpen(false), []);

  const openSessionBrowser = React.useCallback(() => {
    setSessionsMenuOpen(false);
    setSaveSessionModalOpen(false);
    setExportSessionModalOpen(false);
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

  const requestRewind = React.useCallback(
    (turnId: string, removedCount: number, edit?: WorkshopRewindEdit) => {
      setSessionConfirm({ kind: 'rewind', turnId, removedCount, ...(edit ? { edit } : {}) });
    },
    []
  );

  // D4: Branch is non-destructive, so a saved room branches without a
  // confirmation. An unsaved room is asked to save first (D2).
  const requestBranch = React.useCallback((turnId: string) => {
    if (roomIsNamed) {
      branchFrom(turnId);
      return;
    }
    setSessionConfirm({ kind: 'save-before-branch' });
  }, [branchFrom, roomIsNamed]);

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
    } else if (sessionConfirm.kind === 'rewind') {
      rewindTo(sessionConfirm.turnId);
    } else if (sessionConfirm.kind === 'save-before-branch') {
      openSaveSessionModal();
    } else {
      return { resume: sessionConfirm.resume };
    }
    return undefined;
  }, [openSaveSessionModal, openSession, resetSession, rewindTo, sessionConfirm]);

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
    exportSessionModalOpen,
    sessionBrowserOpen,
    sessionConfirm,
    setSessionsMenuVisibility,
    openSaveSessionModal,
    closeSaveSessionModal,
    openExportSessionModal,
    closeExportSessionModal,
    openSessionBrowser,
    closeSessionBrowser,
    startNewSession,
    startFullReset,
    openStoredSession,
    requestShelfReplacement,
    requestRewind,
    requestBranch,
    acceptSessionConfirm,
    cancelSessionConfirm,
    persistedState: {}
  };
}
