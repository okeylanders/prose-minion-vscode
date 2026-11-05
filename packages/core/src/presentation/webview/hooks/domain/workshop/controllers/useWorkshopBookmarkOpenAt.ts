/**
 * "Open at bookmark" for a saved session (ADR 2026-11-05 D8): open the
 * session through the existing Open (its confirmation included), wait for the
 * new room, then jump to the bookmarked turn.
 *
 * The host posts the opened room's snapshot before Open's result, so the
 * jump waits for both: an `open` result that succeeded, and a room on screen
 * other than the one the Open left. It then goes through the thread's one
 * jump path (`jumpToTurn`), which opens the read-only preview for a turn
 * outside the loaded window. It runs in an effect, after the new room has
 * rendered its bubbles.
 *
 * A refused Open (its result failed) and a cancelled one (the confirmation
 * declined, `dropPendingJump`) jump nowhere, and neither does a pending jump
 * a later Open overtakes.
 *
 * A controller: it posts nothing; Open and the jump are injected.
 */

import * as React from 'react';

export interface WorkshopBookmarkOpenTarget {
  sessionId: string;
  title: string;
  turnId: string;
  label: string;
}

export interface UseWorkshopBookmarkOpenAtOptions {
  /** The room on screen. */
  roomRevision: number | undefined;
  /** The latest session action result, as `useWorkshopSessions` holds it. */
  sessionActionResult?: { action: string; ok: boolean };
  openStoredSession: (session: { sessionId: string; title: string }) => void;
  jumpToTurn: (turnId: string, label?: string) => boolean;
}

export interface WorkshopBookmarkOpenAtState {
  /** The jump waiting on an Open, if any. */
  pendingJump: (WorkshopBookmarkOpenTarget & { fromRevision: number | undefined; opened: boolean }) | null;
}

export interface WorkshopBookmarkOpenAtActions {
  openAtBookmark: (target: WorkshopBookmarkOpenTarget) => void;
  /** The Open was declined: jump nowhere. */
  dropPendingJump: () => void;
}

export interface WorkshopBookmarkOpenAtPersistence {
  // A pending jump never outlives the webview.
}

export type UseWorkshopBookmarkOpenAtReturn = WorkshopBookmarkOpenAtState &
  WorkshopBookmarkOpenAtActions & {
    persistedState: WorkshopBookmarkOpenAtPersistence;
  };

export function useWorkshopBookmarkOpenAt({
  roomRevision,
  sessionActionResult,
  openStoredSession,
  jumpToTurn
}: UseWorkshopBookmarkOpenAtOptions): UseWorkshopBookmarkOpenAtReturn {
  const [pendingJump, setPendingJump] = React.useState<WorkshopBookmarkOpenAtState['pendingJump']>(null);

  const openAtBookmark = React.useCallback((target: WorkshopBookmarkOpenTarget) => {
    setPendingJump({ ...target, fromRevision: roomRevision, opened: false });
    openStoredSession({ sessionId: target.sessionId, title: target.title });
  }, [openStoredSession, roomRevision]);

  const dropPendingJump = React.useCallback(() => setPendingJump(null), []);

  // Open answered: a success arms the jump, a refusal drops it.
  const settleWhenOpenAnswered = React.useCallback(() => {
    if (sessionActionResult?.action !== 'open') {
      return;
    }
    setPendingJump((pending) => {
      if (!pending || pending.opened) {
        return pending;
      }
      return sessionActionResult.ok ? { ...pending, opened: true } : null;
    });
  }, [sessionActionResult]);
  React.useEffect(settleWhenOpenAnswered, [settleWhenOpenAnswered]);

  // The opened room is on screen: jump, once.
  const jumpWhenRoomArrived = React.useCallback(() => {
    if (!pendingJump?.opened || roomRevision === undefined || roomRevision === pendingJump.fromRevision) {
      return;
    }
    setPendingJump(null);
    jumpToTurn(pendingJump.turnId, pendingJump.label);
  }, [jumpToTurn, pendingJump, roomRevision]);
  React.useEffect(jumpWhenRoomArrived, [jumpWhenRoomArrived]);

  return { pendingJump, openAtBookmark, dropPendingJump, persistedState: {} };
}
