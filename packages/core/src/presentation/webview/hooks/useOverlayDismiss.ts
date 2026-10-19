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
 *
 * "Which overlay is on top" is document state too (PR #150 F-02). The open
 * overlays form a stack, newest last, and one window listener sends Escape to
 * the top one only: two stacked sheets never both close on one key, and the
 * one underneath keeps its draft. `isAnyOverlayOpen()` lets a surface that
 * arrives from outside (a handed-over seed) refuse rather than cover one.
 */

import * as React from 'react';

/** One open overlay; `close` reads the hook's latest onClose. */
interface OpenOverlay {
  close: () => void;
}

/** The overlays using this hook that are currently open, oldest first. */
const openOverlays: OpenOverlay[] = [];

/**
 * The element focused before the FIRST overlay opened — the one the writer
 * should land back on when the last overlay closes. Held across an
 * overlay-to-overlay handoff, when `document.activeElement` is transiently
 * `<body>` and would otherwise overwrite a perfectly good target.
 */
let focusBeforeFirstOverlay: HTMLElement | null = null;

/** Escape goes to the overlay on top, and to no other. */
function dismissTopOverlay(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    openOverlays.at(-1)?.close();
  }
}

function pushOverlay(overlay: OpenOverlay): void {
  if (openOverlays.length === 0) {
    window.addEventListener('keydown', dismissTopOverlay);
  }
  openOverlays.push(overlay);
}

function removeOverlay(overlay: OpenOverlay): void {
  const index = openOverlays.indexOf(overlay);
  if (index >= 0) {
    openOverlays.splice(index, 1);
  }
  if (openOverlays.length === 0) {
    window.removeEventListener('keydown', dismissTopOverlay);
  }
}

/** Whether any overlay using this hook (every Workshop sheet, editor and browser) is open. */
export function isAnyOverlayOpen(): boolean {
  return openOverlays.length > 0;
}

/** Test seam: overlay focus bookkeeping is module state, so it needs a reset. */
export function __resetOverlayFocusStateForTests(): void {
  openOverlays.splice(0);
  window.removeEventListener('keydown', dismissTopOverlay);
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
    if (openOverlays.length === 0 && focusBeforeFirstOverlay === null) {
      focusBeforeFirstOverlay =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
    }
    const overlay: OpenOverlay = { close: () => onCloseRef.current() };
    pushOverlay(overlay);
    closeButtonRef.current?.focus();

    return () => {
      removeOverlay(overlay);
      const target = focusBeforeFirstOverlay;

      /* Decide on a microtask, not now: cleanups run before setups, so an
         overlay opening in this same commit has not incremented yet. If one
         has by the time this runs, the page is not getting focus back. */
      queueMicrotask(() => {
        if (openOverlays.length === 0) {
          focusBeforeFirstOverlay = null;
          target?.focus();
        }
      });
    };
  }, [open]);

  return closeButtonRef;
}
