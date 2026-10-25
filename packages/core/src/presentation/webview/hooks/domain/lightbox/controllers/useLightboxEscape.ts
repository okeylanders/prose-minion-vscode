/**
 * useLightboxEscape — Escape lets go of the pinned item (ADR 2026-10-19 D4;
 * Slice 4), after every overlay has had its turn.
 *
 * Enter pins an item already: every board item is a button. Escape unpins,
 * but it follows the overlay stack: while any overlay is open (a sheet on
 * the shared stack, `isAnyOverlayOpen()`, or any modal dialog, such as the
 * header's model browser) Escape belongs to the overlay on top, and the pin
 * stays; so too while a menu is open (the header's Boards menu, Slice 5A.2),
 * which Escape closes. A key another handler already claimed (`defaultPrevented`) is left
 * alone too.
 *
 * A presentation controller: the pin is `useLightbox`'s, cleared through the
 * injected callback; it keeps no state and persists nothing.
 */

import * as React from 'react';
import { isAnyOverlayOpen } from '@hooks/useOverlayDismiss';

export interface UseLightboxEscapeArgs {
  /** Whether anything is pinned; with nothing pinned, Escape is not listened for. */
  pinned: boolean;
  onClear: () => void;
}

/** Nothing: Escape is a key, not state. */
export type LightboxEscapePersistence = Record<string, never>;

export interface UseLightboxEscapeReturn {
  persistedState: LightboxEscapePersistence;
}

const NO_PERSISTENCE: LightboxEscapePersistence = {};

/** Whether an overlay or a modal dialog is open, so Escape is its to take. */
export function lightboxEscapeBelongsElsewhere(event: Pick<KeyboardEvent, 'defaultPrevented'>): boolean {
  return event.defaultPrevented || isAnyOverlayOpen() || document.querySelector('[aria-modal="true"], [role="menu"]') !== null;
}

export function useLightboxEscape({ pinned, onClear }: UseLightboxEscapeArgs): UseLightboxEscapeReturn {
  const clearOnEscape = React.useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !lightboxEscapeBelongsElsewhere(event)) {
      onClear();
    }
  }, [onClear]);
  React.useEffect(() => {
    if (!pinned) {
      return undefined;
    }
    window.addEventListener('keydown', clearOnEscape);
    return () => window.removeEventListener('keydown', clearOnEscape);
  }, [clearOnEscape, pinned]);
  return { persistedState: NO_PERSISTENCE };
}
