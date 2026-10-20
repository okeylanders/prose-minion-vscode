/**
 * useLightboxProjectFiles — the Lightbox's project files, as the shared
 * project picker browses them (2026-10-20), mirroring the host's
 * `LightboxProjectFiles` behind `LightboxHandler`.
 *
 * It owns which picker is open, the catalog the host sent for it (Markdown
 * and plain text only) and the latest content-search answer, and it sends
 * the Lightbox's own routes: never a Workshop one. A choice names a catalog
 * key only; the host resolves it. Opening a picker asks for a fresh catalog
 * and shows "Reading…" until it arrives, so the list is the list now.
 *
 * Nothing persists: the catalog is the host's, and a picker is transient.
 */

import * as React from 'react';
import {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults,
  LightboxProjectCatalogMessage,
  LightboxProjectCatalogSearchResultsMessage,
  MessageType
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

/** What a project picker is for. */
export type LightboxProjectPicker = 'source';

export interface LightboxProjectFilesState {
  /** The picker on screen, if any. */
  openPicker: LightboxProjectPicker | null;
  /** The readable files; null until the host answers the latest opening. */
  catalog: ConfiguredResourceEntry[] | null;
  /** The host could not read the configured folders. */
  catalogUnreadable: boolean;
  searchResults: ConfiguredResourceSearchResults | null;
}

export interface LightboxProjectFilesActions {
  /** Open a picker and ask the host for the catalog. */
  open: (picker: LightboxProjectPicker) => void;
  close: () => void;
  /** "Names + content": ask the host to search the files' text. */
  search: (query: string) => void;
  clearSearch: () => void;
  /** Board the file a row names. */
  chooseSource: (item: ConfiguredResourceRef) => void;
  handleCatalog: (message: LightboxProjectCatalogMessage) => void;
  handleSearchResults: (message: LightboxProjectCatalogSearchResultsMessage) => void;
}

/** Nothing: the catalog is the host's, and the picker is transient. */
export type LightboxProjectFilesPersistence = Record<string, never>;

export type UseLightboxProjectFilesReturn = LightboxProjectFilesState & LightboxProjectFilesActions & {
  persistedState: LightboxProjectFilesPersistence;
};

const SOURCE = 'webview.lightbox';
const NO_PERSISTENCE: LightboxProjectFilesPersistence = {};

type LightboxProjectFilesRequest =
  | MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG
  | MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG
  | MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE;

export function useLightboxProjectFiles(): UseLightboxProjectFilesReturn {
  const vscode = useVSCodeApi();
  const [openPicker, setOpenPicker] = React.useState<LightboxProjectPicker | null>(null);
  const [catalog, setCatalog] = React.useState<ConfiguredResourceEntry[] | null>(null);
  const [catalogUnreadable, setCatalogUnreadable] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<ConfiguredResourceSearchResults | null>(null);

  const post = React.useCallback((type: LightboxProjectFilesRequest, payload: object = {}) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const open = React.useCallback((picker: LightboxProjectPicker) => {
    setCatalog(null);
    setCatalogUnreadable(false);
    setSearchResults(null);
    setOpenPicker(picker);
    post(MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG);
  }, [post]);
  const close = React.useCallback(() => setOpenPicker(null), []);
  const search = React.useCallback(
    (query: string) => post(MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG, { query }),
    [post]
  );
  const clearSearch = React.useCallback(() => setSearchResults(null), []);
  const chooseSource = React.useCallback(
    ({ group, path }: ConfiguredResourceRef) => post(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, { group, path }),
    [post]
  );

  const handleCatalog = React.useCallback((message: LightboxProjectCatalogMessage) => {
    const payload = message.payload;
    if (!payload || !Array.isArray(payload.entries)) {
      return;
    }
    setCatalog(payload.entries);
    setCatalogUnreadable(payload.unreadable === true);
  }, []);
  const handleSearchResults = React.useCallback((message: LightboxProjectCatalogSearchResultsMessage) => {
    if (message.payload) {
      setSearchResults(message.payload);
    }
  }, []);

  return {
    openPicker,
    catalog,
    catalogUnreadable,
    searchResults,
    open,
    close,
    search,
    clearSearch,
    chooseSource,
    handleCatalog,
    handleSearchResults,
    persistedState: NO_PERSISTENCE
  };
}
