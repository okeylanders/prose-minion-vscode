/**
 * Showing a turn in the thread: the to-do's "show source", a Read in row's
 * card, and the reader's "Show where it was read" (ADR 2026-11-03 D3, D4).
 *
 * One scroll-and-focus path. A turn outside the reload window shows the
 * caller's notice instead (Slice 5 replaces it with the reader).
 *
 * From inside a text sheet the jump must wait twice over. While a sheet is
 * open the frame behind it is `inert`, and an inert turn cannot take focus;
 * and when the sheet closes, the overlay's own cleanup returns focus to the
 * element that opened it. So `jumpAfterClosing` hands the jump to that
 * cleanup (`focusAfterOverlaysClose`): it runs in place of the opener
 * restore, after the closing commit (PR #187 F-01). A turn outside the window
 * takes no focus, so the opener gets it back, beside the notice.
 *
 * A controller: it reads the DOM it is given and posts nothing.
 */

import * as React from 'react';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';
import { focusAfterOverlaysClose } from '@hooks/useOverlayDismiss';

export interface UseWorkshopTurnJumpOptions {
  /** Closes the overlay the jump starts from. */
  closeOverlay: () => void;
  /** Says the turn is outside the current reload window. */
  onOutsideWindow: () => void;
}

export interface WorkshopTurnJumpState {
  // Nothing to show: a pending jump lives with the overlay's focus restore.
}

export interface WorkshopTurnJumpActions {
  /**
   * Scrolls a turn into view and focuses it, or reports it outside the
   * window. Returns whether it took focus.
   */
  jumpToTurn: (turnId: string) => boolean;
  /** Closes the overlay, then jumps once the overlay has let focus go. */
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
  closeOverlay,
  onOutsideWindow
}: UseWorkshopTurnJumpOptions): UseWorkshopTurnJumpReturn {
  const jumpToTurn = React.useCallback((turnId: string): boolean => {
    const turn = Array.from(
      document.querySelectorAll<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}]`)
    ).find((element) => element.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE) === turnId);
    if (!turn) {
      onOutsideWindow();
      return false;
    }
    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    turn.focus({ preventScroll: true });
    return true;
  }, [onOutsideWindow]);

  const jumpAfterClosing = React.useCallback((turnId: string) => {
    focusAfterOverlaysClose(() => jumpToTurn(turnId));
    closeOverlay();
  }, [closeOverlay, jumpToTurn]);

  return { jumpToTurn, jumpAfterClosing, persistedState: {} };
}
