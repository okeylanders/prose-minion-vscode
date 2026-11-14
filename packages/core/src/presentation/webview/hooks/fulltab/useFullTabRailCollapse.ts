/**
 * useFullTabRailCollapse — whether a full editor tab's leading rail is
 * collapsed to its strip (Everyday Conveniences, item D).
 *
 * A presentation controller: it posts nothing and reads no host state. A tab
 * that opts in composes it, hands its state to `FullTabShell`'s
 * `railCollapse`, and adds `persistedState` to its webview state.
 *
 * Two widths, two rules:
 * - **Wide:** the rail is as the writer left it. That choice is the stored
 *   preference (per window, never the session, never the host).
 * - **Narrow** (at or under {@link FULL_TAB_RAIL_NARROW_WIDTH}): the rail
 *   starts collapsed on every load and every time the tab becomes narrow.
 *   Opening it there is for the moment only: it lays over the main column
 *   (`overlay`), and it never changes the stored preference.
 */
import * as React from 'react';

/** At this width and below the rail starts collapsed and opens as an overlay. */
export const FULL_TAB_RAIL_NARROW_WIDTH = 900;

export const FULL_TAB_RAIL_NARROW_QUERY = `(max-width: ${FULL_TAB_RAIL_NARROW_WIDTH}px)`;

type NarrowListener = (event: { matches: boolean }) => void;

/** The part of `MediaQueryList` this hook reads; a test supplies its own. */
export interface FullTabNarrowQuery {
  matches: boolean;
  addEventListener: (type: 'change', listener: NarrowListener) => void;
  removeEventListener: (type: 'change', listener: NarrowListener) => void;
}

export type FullTabMatchMedia = (query: string) => FullTabNarrowQuery | undefined;

/** The window's own `matchMedia`, where there is one (jsdom has none: never narrow). */
const windowMatchMedia: FullTabMatchMedia = (query) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : undefined;

export interface UseFullTabRailCollapseOptions {
  /** The stored preference from webview state, read by the caller; may be anything. */
  initialCollapsed?: unknown;
  /** Injected in tests; defaults to the window's. */
  matchMedia?: FullTabMatchMedia;
}

export interface FullTabRailCollapseState {
  collapsed: boolean;
  /** The rail is open on a narrow tab, laid over the main column. */
  overlay: boolean;
  narrow: boolean;
}

export interface FullTabRailCollapseActions {
  onToggle: () => void;
  /**
   * Opens the rail. `focusId` names the element to focus once the rail's
   * content is showing again (the strip that held focus is gone by then).
   */
  expand: (focusId?: string) => void;
}

export interface FullTabRailCollapsePersistence {
  fullTabRailCollapsed: boolean;
}

export type UseFullTabRailCollapseReturn = FullTabRailCollapseState &
  FullTabRailCollapseActions & {
    persistedState: FullTabRailCollapsePersistence;
  };

export function useFullTabRailCollapse({
  initialCollapsed,
  matchMedia = windowMatchMedia
}: UseFullTabRailCollapseOptions = {}): UseFullTabRailCollapseReturn {
  const [preferCollapsed, setPreferCollapsed] = React.useState(initialCollapsed === true);
  const [narrow, setNarrow] = React.useState(
    () => matchMedia(FULL_TAB_RAIL_NARROW_QUERY)?.matches ?? false
  );
  const [openWhileNarrow, setOpenWhileNarrow] = React.useState(false);
  const pendingFocusId = React.useRef<string | undefined>(undefined);

  const collapsed = narrow ? !openWhileNarrow : preferCollapsed;
  const overlay = narrow && openWhileNarrow;

  const setCollapsed = React.useCallback(
    (next: boolean) => {
      if (narrow) {
        setOpenWhileNarrow(!next);
      } else {
        setPreferCollapsed(next);
      }
    },
    [narrow]
  );

  const onToggle = React.useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const expand = React.useCallback(
    (focusId?: string) => {
      pendingFocusId.current = focusId;
      setCollapsed(false);
    },
    [setCollapsed]
  );

  // Each time the tab becomes narrow (or wide again) the overlay starts closed.
  const syncNarrow = React.useCallback((matches: boolean) => {
    setNarrow(matches);
    setOpenWhileNarrow(false);
  }, []);

  const watchNarrowWidth = React.useCallback(() => {
    const query = matchMedia(FULL_TAB_RAIL_NARROW_QUERY);
    if (!query) {
      return undefined;
    }
    const listener: NarrowListener = (event) => syncNarrow(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [matchMedia, syncNarrow]);

  React.useEffect(() => watchNarrowWidth(), [watchNarrowWidth]);

  const focusPendingWhenExpanded = React.useCallback(() => {
    const focusId = pendingFocusId.current;
    if (collapsed || focusId === undefined) {
      return;
    }
    pendingFocusId.current = undefined;
    document.getElementById(focusId)?.focus();
  }, [collapsed]);

  // Layout, not passive: the strip button that held focus has just unmounted.
  React.useLayoutEffect(() => {
    focusPendingWhenExpanded();
  }, [focusPendingWhenExpanded]);

  const persistedState = React.useMemo<FullTabRailCollapsePersistence>(
    () => ({ fullTabRailCollapsed: preferCollapsed }),
    [preferCollapsed]
  );

  return { collapsed, overlay, narrow, onToggle, expand, persistedState };
}
