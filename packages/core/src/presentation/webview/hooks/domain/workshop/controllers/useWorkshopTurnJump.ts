/**
 * Showing a turn in the thread: the to-do's "show source", a Read in row's
 * card, and the reader's "Show where it was read" (ADR 2026-11-03 D3, D4).
 *
 * One scroll-and-focus path. A turn outside the reload window shows the
 * caller's notice instead (Slice 5 replaces it with the reader).
 *
 * From inside a text sheet the jump must wait: while a sheet is open the
 * frame behind it is `inert`, and an inert turn cannot take focus. So
 * `jumpAfterClosing` closes the overlay first and jumps once the overlay is
 * gone and the frame is live again.
 *
 * A controller: it reads the DOM it is given and posts nothing.
 */

import * as React from 'react';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';

export interface UseWorkshopTurnJumpOptions {
  /** True while an overlay makes the frame behind it inert. */
  overlayOpen: boolean;
  /** Closes that overlay. */
  closeOverlay: () => void;
  /** Says the turn is outside the current reload window. */
  onOutsideWindow: () => void;
}

export interface WorkshopTurnJumpState {
  /** The turn waiting for the overlay to close, if any. */
  pendingTurnId: string | null;
}

export interface WorkshopTurnJumpActions {
  /** Scrolls a turn into view and focuses it, or reports it outside the window. */
  jumpToTurn: (turnId: string) => void;
  /** Closes the overlay, then jumps once the frame can take focus. */
  jumpAfterClosing: (turnId: string) => void;
}

export interface WorkshopTurnJumpPersistence {
  // Nothing outlives the jump.
}

export type UseWorkshopTurnJumpReturn = WorkshopTurnJumpState &
  WorkshopTurnJumpActions & {
    persistedState: WorkshopTurnJumpPersistence;
  };

export function useWorkshopTurnJump({
  overlayOpen,
  closeOverlay,
  onOutsideWindow
}: UseWorkshopTurnJumpOptions): UseWorkshopTurnJumpReturn {
  const [pendingTurnId, setPendingTurnId] = React.useState<string | null>(null);

  const jumpToTurn = React.useCallback((turnId: string) => {
    const turn = Array.from(
      document.querySelectorAll<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}]`)
    ).find((element) => element.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE) === turnId);
    if (turn) {
      turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      turn.focus({ preventScroll: true });
    } else {
      onOutsideWindow();
    }
  }, [onOutsideWindow]);

  const jumpAfterClosing = React.useCallback((turnId: string) => {
    setPendingTurnId(turnId);
    closeOverlay();
  }, [closeOverlay]);

  const jumpWhenOverlayClosed = React.useCallback(() => {
    if (pendingTurnId === null || overlayOpen) {
      return;
    }
    setPendingTurnId(null);
    jumpToTurn(pendingTurnId);
  }, [jumpToTurn, overlayOpen, pendingTurnId]);

  // Effects run after the commit that removed the overlay and its `inert`.
  React.useEffect(() => {
    jumpWhenOverlayClosed();
  }, [jumpWhenOverlayClosed]);

  return { pendingTurnId, jumpToTurn, jumpAfterClosing, persistedState: {} };
}
