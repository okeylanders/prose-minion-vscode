/**
 * Recover… for a saved session left mid-save (ADR 2026-11-19 D6e), as the
 * webview offers it: on the notice a refused save or open leaves, and on
 * the session browser's "Recovery required" row.
 *
 * - **Confirm first.** Recover… opens a confirm (close other windows; your
 *   unsaved work is kept); only its Recover posts.
 * - **Ids only, correlated.** The post carries a webview-minted `requestId`
 *   and the session id; only the answer still waited for is taken.
 * - **The notice** comes from a failed save or open whose result names
 *   `recoverSessionId`; it stays until dismissed or recovered.
 * - **After an answer** the browser's list is asked for again (`onSettled`).
 * - **It listens for its own answer** (`useMessageRouter`); nothing persisted.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopNamedSessionRecoveryResultMessage,
  type WorkshopRecoverNamedSessionMessage,
  type WorkshopSessionActionResultMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useMessageRouter } from '@hooks/useMessageRouter';

export interface WorkshopNamedSessionRecoveryTarget {
  sessionId: string;
  title?: string;
}

export interface WorkshopNamedSessionRecoveryState {
  /** The session a refused save or open offers to recover. */
  offer?: WorkshopNamedSessionRecoveryTarget;
  /** The session whose confirm is open. */
  confirming?: WorkshopNamedSessionRecoveryTarget;
  /** True while a recovery waits for the host. */
  recovering: boolean;
  /** The host's words for the last answer. */
  outcome?: { ok: boolean; message: string };
}

export interface WorkshopNamedSessionRecoveryActions {
  ask: (sessionId: string, title?: string) => void;
  confirm: () => void;
  cancel: () => void;
  dismiss: () => void;
  handleResult: (message: WorkshopNamedSessionRecoveryResultMessage) => void;
}

export interface WorkshopNamedSessionRecoveryPersistence {
  // The host owns every saved session; nothing is kept in webview state.
}

export type UseWorkshopNamedSessionRecoveryReturn = WorkshopNamedSessionRecoveryState &
  WorkshopNamedSessionRecoveryActions & {
    persistedState: WorkshopNamedSessionRecoveryPersistence;
  };

export interface UseWorkshopNamedSessionRecoveryOptions {
  sessionActionResult?: WorkshopSessionActionResultMessage['payload'];
  onSettled: () => void;
}

const SOURCE = 'webview.workshop.sessionRecovery';
const NO_PERSISTENCE: WorkshopNamedSessionRecoveryPersistence = {};

export function useWorkshopNamedSessionRecovery({ sessionActionResult, onSettled }: UseWorkshopNamedSessionRecoveryOptions): UseWorkshopNamedSessionRecoveryReturn {
  const vscode = useVSCodeApi();
  const [offer, setOffer] = React.useState<WorkshopNamedSessionRecoveryTarget>();
  const [confirming, setConfirming] = React.useState<WorkshopNamedSessionRecoveryTarget>();
  const [outcome, setOutcome] = React.useState<{ ok: boolean; message: string }>();
  const [pending, setPending] = React.useState<string>();
  const ids = React.useRef({ prefix: `ws-session-recover-${Math.random().toString(36).slice(2, 10)}`, count: 0 });
  const settled = React.useRef(onSettled);
  settled.current = onSettled;

  const syncOfferFromActionResult = React.useCallback((result: UseWorkshopNamedSessionRecoveryOptions['sessionActionResult']) => {
    if (result && !result.ok && result.recoverSessionId) {
      setOffer({ sessionId: result.recoverSessionId });
      setOutcome(undefined);
    }
  }, []);
  React.useEffect(() => syncOfferFromActionResult(sessionActionResult), [sessionActionResult, syncOfferFromActionResult]);

  const ask = React.useCallback((sessionId: string, title?: string) => {
    setConfirming({ sessionId, ...(title !== undefined ? { title } : {}) });
  }, []);

  const cancel = React.useCallback(() => setConfirming(undefined), []);

  const dismiss = React.useCallback(() => {
    setOffer(undefined);
    setOutcome(undefined);
  }, []);

  const confirm = React.useCallback(() => {
    if (!confirming || pending) {
      return;
    }
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    setPending(requestId);
    setConfirming(undefined);
    setOutcome(undefined);
    const message: WorkshopRecoverNamedSessionMessage = {
      type: MessageType.WORKSHOP_RECOVER_NAMED_SESSION,
      source: SOURCE,
      payload: { requestId, sessionId: confirming.sessionId },
      timestamp: Date.now()
    };
    vscode.postMessage(message);
  }, [confirming, pending, vscode]);

  const handleResult = React.useCallback((message: WorkshopNamedSessionRecoveryResultMessage) => {
    const payload = message.payload;
    if (!payload || payload.requestId !== pending) {
      return;
    }
    setPending(undefined);
    setOutcome({ ok: payload.ok, message: payload.message });
    if (payload.ok) {
      setOffer((current) => (current?.sessionId === payload.sessionId ? undefined : current));
    }
    settled.current();
  }, [pending]);

  useMessageRouter({ [MessageType.WORKSHOP_NAMED_SESSION_RECOVERY_RESULT]: handleResult });

  return {
    ...(offer ? { offer } : {}),
    ...(confirming ? { confirming } : {}),
    recovering: pending !== undefined,
    ...(outcome ? { outcome } : {}),
    ask,
    confirm,
    cancel,
    dismiss,
    handleResult,
    persistedState: NO_PERSISTENCE
  };
}
