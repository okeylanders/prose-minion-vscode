/**
 * useOverlayDismiss — the ONE implementation of "Escape closes me, and focus
 * behaves" for Workshop overlays (PR #94 review: Marcus/Parker/Stan/Sam).
 *
 * `WorkshopModalShell` owned this for every boxed modal, and
 * `WorkshopConfigureGuide` — which needs the whole surface, not the shell's
 * backdrop box — hand-copied it. Two copies of the same effect did not merely
 * risk drift; they FOUGHT, because React flushes every passive-effect cleanup
 * for a commit before any setup. When one overlay closed as another opened, the
 * closer's cleanup restored page focus before the opener captured it, so focus
 * visibly left the dialog and the opener recorded a background element as the
 * thing to return to.
 *
 * The fix is the reason the bookkeeping below is module-level rather than
 * per-hook: "which page element had focus before ANY overlay opened" is a
 * property of the document, not of one component, and so is "is any overlay
 * still up". Keeping both here lets a handoff between two overlays leave focus
 * alone entirely, and still return it to the right element when the last one
 * closes.
 */

import * as React from 'react';

/** How many overlays using this hook are currently open. */
let openOverlayCount = 0;

/**
 * The element focused before the FIRST overlay opened — the one the writer
 * should land back on when the last overlay closes. Held across an
 * overlay-to-overlay handoff, when `document.activeElement` is transiently
 * `<body>` and would otherwise overwrite a perfectly good target.
 */
let focusBeforeFirstOverlay: HTMLElement | null = null;

/** Test seam: overlay focus bookkeeping is module state, so it needs a reset. */
export function __resetOverlayFocusStateForTests(): void {
  openOverlayCount = 0;
  focusBeforeFirstOverlay = null;
}

interface UseOverlayDismissOptions {
  open: boolean;
  /** Escape, and whatever else the caller wires to the returned close ref. */
  onClose: () => void;
}

/**
 * Returns the ref to put on the overlay's close affordance; it is focused when
 * the overlay opens.
 */
export function useOverlayDismiss({
  open,
  onClose
}: UseOverlayDismissOptions): React.RefObject<HTMLButtonElement> {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  /* Held in a ref so an unstable onClose identity cannot re-run the effect and
     yank focus back to the close button mid-read. */
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    /* Only claim a return target if no overlay already has one: during a
       handoff the previous overlay has decremented but not yet restored, and
       the live activeElement is <body>. */
    if (openOverlayCount === 0 && focusBeforeFirstOverlay === null) {
      focusBeforeFirstOverlay =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
    }
    openOverlayCount += 1;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      openOverlayCount -= 1;
      const target = focusBeforeFirstOverlay;

      /* Decide on a microtask, not now: cleanups run before setups, so an
         overlay opening in this same commit has not incremented yet. If one
         has by the time this runs, the page is not getting focus back. */
      queueMicrotask(() => {
        if (openOverlayCount === 0) {
          focusBeforeFirstOverlay = null;
          target?.focus();
        }
      });
    };
  }, [open]);

  return closeButtonRef;
}
