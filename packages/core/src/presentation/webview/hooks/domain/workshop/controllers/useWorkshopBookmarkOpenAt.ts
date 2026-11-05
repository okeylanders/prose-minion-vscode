/**
 * "Open at bookmark" for a saved session (ADR 2026-11-05 D8): open the
 * session through the existing Open (its confirmation included), wait for the
 * new room, then jump to the bookmarked turn.
 *
 * The pending jump belongs to one Open, of one session (PR #216 F-02). It
 * follows that Open step by step and is dropped the moment anything else
 * takes its place:
 * - **starting:** right after it asks for the Open, the Open must show as
 *   this session's confirmation, or as an Open in flight (no confirmation
 *   needed); anything else drops it.
 * - **confirming:** while that confirmation is up it waits. If the
 *   confirmation closes with an Open in flight, the writer accepted; if it
 *   closes otherwise (Cancel, Escape) or another confirmation replaces it
 *   (New, Rewind, another Open), the jump is dropped.
 * - **opening:** the Open's own result decides: success arms it, refusal
 *   drops it. Any other action settling instead drops it too.
 * - **opened:** the host posts the opened room's snapshot before the result,
 *   so it jumps once a room other than the one the Open left is on screen,
 *   through the thread's one jump path (`jumpToTurn`), which previews a turn
 *   outside the loaded window. It runs in an effect, after the new room has
 *   rendered its bubbles.
 *
 * A controller: it posts nothing; Open and the jump are injected, and it
 * reads the session surfaces' state.
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
  /** The confirmation on screen, as the session surfaces hold it. */
  sessionConfirm: { kind: string; sessionId?: string } | null;
  /** The session action in flight, as `useWorkshopSessions` holds it. */
  sessionActionPending?: string;
  /** The latest session action result, as `useWorkshopSessions` holds it. */
  sessionActionResult?: { action: string; ok: boolean };
  openStoredSession: (session: { sessionId: string; title: string }) => void;
  jumpToTurn: (turnId: string, label?: string) => boolean;
}

export type WorkshopBookmarkOpenPhase = 'starting' | 'confirming' | 'opening' | 'opened';

export interface WorkshopBookmarkOpenAtState {
  /** The jump waiting on its Open, if any. */
  pendingJump: (WorkshopBookmarkOpenTarget & { fromRevision: number | undefined; phase: WorkshopBookmarkOpenPhase }) | null;
}

export interface WorkshopBookmarkOpenAtActions {
  openAtBookmark: (target: WorkshopBookmarkOpenTarget) => void;
  /** Forget the pending jump. */
  dropPendingJump: () => void;
}

export interface WorkshopBookmarkOpenAtPersistence {
  // A pending jump never outlives the webview.
}

export type UseWorkshopBookmarkOpenAtReturn = WorkshopBookmarkOpenAtState &
  WorkshopBookmarkOpenAtActions & {
    persistedState: WorkshopBookmarkOpenAtPersistence;
  };

type Pending = WorkshopBookmarkOpenAtState['pendingJump'];

export function useWorkshopBookmarkOpenAt({
  roomRevision,
  sessionConfirm,
  sessionActionPending,
  sessionActionResult,
  openStoredSession,
  jumpToTurn
}: UseWorkshopBookmarkOpenAtOptions): UseWorkshopBookmarkOpenAtReturn {
  const [pendingJump, setPendingJump] = React.useState<Pending>(null);

  const openAtBookmark = React.useCallback((target: WorkshopBookmarkOpenTarget) => {
    setPendingJump({ ...target, fromRevision: roomRevision, phase: 'starting' });
    openStoredSession({ sessionId: target.sessionId, title: target.title });
  }, [openStoredSession, roomRevision]);

  const dropPendingJump = React.useCallback(() => setPendingJump(null), []);

  // Follow this jump's own Open, and drop it once anything else takes its place. It
  // also runs when the phase moves, so a jump just started settles on the very next
  // render, never waiting on a later, unrelated session change.
  const phase = pendingJump?.phase;
  const syncWithItsOpen = React.useCallback(() => {
    if (phase === undefined) {
      return;
    }
    setPendingJump((pending) => nextPhase(pending, { sessionConfirm, sessionActionPending, sessionActionResult }));
  }, [phase, sessionActionPending, sessionActionResult, sessionConfirm]);
  React.useEffect(syncWithItsOpen, [syncWithItsOpen]);

  // The opened room is on screen: jump, once.
  const jumpWhenRoomArrived = React.useCallback(() => {
    if (pendingJump?.phase !== 'opened' || roomRevision === undefined || roomRevision === pendingJump.fromRevision) {
      return;
    }
    setPendingJump(null);
    jumpToTurn(pendingJump.turnId, pendingJump.label);
  }, [jumpToTurn, pendingJump, roomRevision]);
  React.useEffect(jumpWhenRoomArrived, [jumpWhenRoomArrived]);

  return { pendingJump, openAtBookmark, dropPendingJump, persistedState: {} };
}

/** Where a pending jump stands given the session surfaces now; null drops it. Pure. */
export function nextPhase(
  pending: Pending,
  now: Pick<UseWorkshopBookmarkOpenAtOptions, 'sessionConfirm' | 'sessionActionPending' | 'sessionActionResult'>
): Pending {
  if (!pending) {
    return pending;
  }
  const confirmingIt = now.sessionConfirm?.kind === 'open' && now.sessionConfirm.sessionId === pending.sessionId;
  const opening = now.sessionActionPending === 'open';
  switch (pending.phase) {
    case 'starting':
      if (confirmingIt) {
        return { ...pending, phase: 'confirming' };
      }
      return opening && now.sessionConfirm === null ? { ...pending, phase: 'opening' } : null;
    case 'confirming':
      if (confirmingIt) {
        return pending;
      }
      return opening && now.sessionConfirm === null ? { ...pending, phase: 'opening' } : null;
    case 'opening':
      if (now.sessionActionResult?.action === 'open') {
        return now.sessionActionResult.ok ? { ...pending, phase: 'opened' } : null;
      }
      return opening && now.sessionConfirm === null ? pending : null;
    case 'opened':
      return now.sessionConfirm === null ? pending : null;
    default: {
      const unreachable: never = pending.phase;
      return unreachable;
    }
  }
}
