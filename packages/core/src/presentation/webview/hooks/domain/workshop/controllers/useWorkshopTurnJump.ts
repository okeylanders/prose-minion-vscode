/**
 * Showing a turn in the thread: the to-do's "show source", a Read in row's
 * card, and the reader's "Show where it was read" (ADR 2026-11-03 D3, D4).
 *
 * One scroll-and-focus path. A turn outside the reload window goes to the
 * caller instead, which opens it in the read-only turn preview (ADR
 * 2026-11-03 D6, Slice 5).
 *
 * From inside a text sheet the jump must wait twice over. While a sheet is
 * open the frame behind it is `inert`, and an inert turn cannot take focus;
 * and when the sheet closes, the overlay's own cleanup returns focus to the
 * element that opened it. So `jumpAfterClosing` hands the jump to that
 * cleanup (`focusAfterOverlaysClose`): it runs in place of the opener
 * restore, after the closing commit (PR #187 F-01). A turn outside the window
 * is never closed toward: the preview replaces the open sheet in place, so
 * the overlay's opener stays the element focus returns to when it closes.
 *
 * A controller: it reads the DOM it is given and posts nothing.
 */

import * as React from 'react';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';
import { focusAfterOverlaysClose } from '@hooks/useOverlayDismiss';

export interface UseWorkshopTurnJumpOptions {
  /** Closes the overlay the jump starts from. */
  closeOverlay: () => void;
  /**
   * Shows a turn the thread has not rendered (outside the reload window),
   * with the label the caller knows it by, if any.
   */
  onOutsideWindow: (turnId: string, label?: string) => void;
}

export interface WorkshopTurnJumpState {
  // Nothing to show: a pending jump lives with the overlay's focus restore.
}

export interface WorkshopTurnJumpActions {
  /**
   * Scrolls a turn into view and focuses it, or hands it to
   * `onOutsideWindow`. Returns whether it took focus.
   */
  jumpToTurn: (turnId: string, label?: string) => boolean;
  /**
   * Closes the overlay, then jumps once the overlay has let focus go; a turn
   * outside the window goes to `onOutsideWindow` with the overlay still open.
   */
  jumpAfterClosing: (turnId: string) => void;
}

export interface WorkshopTurnJumpPersistence {
  // Nothing outlives the jump.
}

export type UseWorkshopTurnJumpReturn = WorkshopTurnJumpState &
  WorkshopTurnJumpActions & {
    persistedState: WorkshopTurnJumpPersistence;
  };

/** The thread's bubble for a turn, when the thread has rendered it (an inert one included). */
const renderedTurn = (turnId: string): HTMLElement | undefined => Array.from(
  document.querySelectorAll<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}]`)
).find((element) => element.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE) === turnId);

export function useWorkshopTurnJump({
  closeOverlay,
  onOutsideWindow
}: UseWorkshopTurnJumpOptions): UseWorkshopTurnJumpReturn {
  const jumpToTurn = React.useCallback((turnId: string, label?: string): boolean => {
    const turn = renderedTurn(turnId);
    if (!turn) {
      onOutsideWindow(turnId, label);
      return false;
    }
    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    turn.focus({ preventScroll: true });
    return true;
  }, [onOutsideWindow]);

  const jumpAfterClosing = React.useCallback((turnId: string) => {
    if (!renderedTurn(turnId)) {
      onOutsideWindow(turnId);
      return;
    }
    focusAfterOverlaysClose(() => jumpToTurn(turnId));
    closeOverlay();
  }, [closeOverlay, jumpToTurn, onOutsideWindow]);

  return { jumpToTurn, jumpAfterClosing, persistedState: {} };
}
