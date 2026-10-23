/**
 * useLightboxBoardsSurface — which of the saved boards' surfaces is open
 * (Lightbox Slice 5A.2): the Boards menu in the header, the browser it
 * opens, and the name sheet its "Rename board…" opens; and the browser's
 * search. A presentation controller: the host's effects (asking for the
 * shelf again when the browser opens) arrive as an injected callback, and it
 * keeps no transport of its own. Nothing persists: a closed tab reopens with
 * every surface closed and the search empty, as the Workshop's sessions do.
 *
 * The name sheet is bound to its board (PR #167 F-02): "Rename board…"
 * opens it for the board on screen, by id and adoption, and the sheet names
 * that board or none. The app closes it the moment another board, or
 * another adoption of the same one, comes on screen, so a draft typed for
 * one board is never given to another.
 */

import * as React from 'react';

/** The board the name sheet was opened for: its id, and the adoption its shelf named (null before one did). */
export interface LightboxBoardsRenameTarget {
  boardId: string;
  adoption: number | null;
}

export interface UseLightboxBoardsSurfaceArgs {
  /** Ask the host for the shelf again: the browser shows every chapter's boards as they are now. */
  onBrowse: () => void;
}

export interface LightboxBoardsSurfaceState {
  menuOpen: boolean;
  browserOpen: boolean;
  renameOpen: boolean;
  /** The board the open name sheet names; null when it is closed. */
  renameTarget: LightboxBoardsRenameTarget | null;
  /** The browser's search, over names and chapter paths. */
  query: string;
}

export interface LightboxBoardsSurfaceActions {
  setMenuOpen: (open: boolean) => void;
  openBrowser: () => void;
  closeBrowser: () => void;
  openRename: (target: LightboxBoardsRenameTarget) => void;
  closeRename: () => void;
  setQuery: (query: string) => void;
}

/** Nothing: which surface is open is not kept across a reload. */
export type LightboxBoardsSurfacePersistence = Record<string, never>;

export type UseLightboxBoardsSurfaceReturn = LightboxBoardsSurfaceState & LightboxBoardsSurfaceActions & {
  persistedState: LightboxBoardsSurfacePersistence;
};

const NO_PERSISTENCE: LightboxBoardsSurfacePersistence = {};

export function useLightboxBoardsSurface({ onBrowse }: UseLightboxBoardsSurfaceArgs): UseLightboxBoardsSurfaceReturn {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<LightboxBoardsRenameTarget | null>(null);
  const [query, setQuery] = React.useState('');

  const openBrowser = React.useCallback(() => {
    setQuery('');
    setBrowserOpen(true);
    onBrowse();
  }, [onBrowse]);
  const closeBrowser = React.useCallback(() => setBrowserOpen(false), []);
  const openRename = React.useCallback((target: LightboxBoardsRenameTarget) => setRenameTarget(target), []);
  const closeRename = React.useCallback(() => setRenameTarget(null), []);

  return {
    menuOpen,
    browserOpen,
    renameOpen: renameTarget !== null,
    renameTarget,
    query,
    setMenuOpen,
    openBrowser,
    closeBrowser,
    openRename,
    closeRename,
    setQuery,
    persistedState: NO_PERSISTENCE
  };
}
