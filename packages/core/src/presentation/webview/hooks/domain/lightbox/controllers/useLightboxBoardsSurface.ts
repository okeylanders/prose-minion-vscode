/**
 * useLightboxBoardsSurface — which of the saved boards' surfaces is open
 * (Lightbox Slice 5A.2): the Boards menu in the header, the browser it
 * opens, and the name sheet its "Rename board…" opens; and the browser's
 * search. A presentation controller: the host's effects (asking for the
 * shelf again when the browser opens) arrive as an injected callback, and it
 * keeps no transport of its own. Nothing persists: a closed tab reopens with
 * every surface closed and the search empty, as the Workshop's sessions do.
 */

import * as React from 'react';

export interface UseLightboxBoardsSurfaceArgs {
  /** Ask the host for the shelf again: the browser shows every chapter's boards as they are now. */
  onBrowse: () => void;
}

export interface LightboxBoardsSurfaceState {
  menuOpen: boolean;
  browserOpen: boolean;
  renameOpen: boolean;
  /** The browser's search, over names and chapter paths. */
  query: string;
}

export interface LightboxBoardsSurfaceActions {
  setMenuOpen: (open: boolean) => void;
  openBrowser: () => void;
  closeBrowser: () => void;
  openRename: () => void;
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
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const openBrowser = React.useCallback(() => {
    setQuery('');
    setBrowserOpen(true);
    onBrowse();
  }, [onBrowse]);
  const closeBrowser = React.useCallback(() => setBrowserOpen(false), []);
  const openRename = React.useCallback(() => setRenameOpen(true), []);
  const closeRename = React.useCallback(() => setRenameOpen(false), []);

  return {
    menuOpen,
    browserOpen,
    renameOpen,
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
