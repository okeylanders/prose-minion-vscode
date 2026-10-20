/**
 * useLightboxProjectFiles — the Lightbox's project files, as the shared
 * project picker browses them (2026-10-20), mirroring the host's
 * `LightboxProjectFiles` behind `LightboxHandler`.
 *
 * It owns which picker is open (the source's, or the context list's), the
 * catalog the host sent for it (Markdown and plain text only) and the latest
 * content-search answer, and it sends the Lightbox's own routes: never a
 * Workshop one. A choice names catalog keys only; the host resolves them.
 * Context added this way comes back as the shelf (`LIGHTBOX_CONTEXT_FILES`,
 * `useLightbox`), which re-estimates when the list changes. Opening a picker asks for a fresh catalog
 * and shows "Reading…" until it arrives, so the list is the list now.
 *
 * Answers are taken only when they are awaited (PR #154 F-01). Each opening,
 * and each catalog or search request within it, gets an id minted here; the
 * host echoes it, and an answer whose id is not the one pending is dropped
 * without touching what is on screen. Opening and closing a picker drop
 * every pending answer; clearing the search drops the pending search; and a
 * search for a new query takes down the previous query's answer (and its
 * safety-bound note) at once. Query text alone cannot tell answers apart: the
 * same query asked in two openings, or before and after a clear, is two
 * requests.
 *
 * Nothing persists: the catalog is the host's, and a picker is transient.
 */

import * as React from 'react';
import {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  LightboxProjectCatalogMessage,
  LightboxProjectCatalogSearchResultsMessage,
  LightboxProjectCatalogSearchResultsPayload,
  MessageType
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

/** What a project picker is for: the board's source (one file) or its context (several). */
export type LightboxProjectPicker = 'source' | 'context';

export interface LightboxProjectFilesState {
  /** The picker on screen, if any. */
  openPicker: LightboxProjectPicker | null;
  /** The readable files; null until the host answers the latest opening. */
  catalog: ConfiguredResourceEntry[] | null;
  /** The host could not read the configured folders. */
  catalogUnreadable: boolean;
  /** The answer to the pending search's query in this opening, if one has come. */
  searchResults: LightboxProjectCatalogSearchResultsPayload | null;
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
  /** Add the files the rows name to the context, in the writer's order. */
  addContext: (items: ConfiguredResourceRef[]) => void;
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

/** The answers this webview still waits for, by request id. */
interface PendingAnswers {
  catalog?: string;
  search?: string;
}

const sameQuery = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type LightboxProjectFilesRequest =
  | MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG
  | MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG
  | MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE
  | MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT;

export function useLightboxProjectFiles(): UseLightboxProjectFilesReturn {
  const vscode = useVSCodeApi();
  const [openPicker, setOpenPicker] = React.useState<LightboxProjectPicker | null>(null);
  const [catalog, setCatalog] = React.useState<ConfiguredResourceEntry[] | null>(null);
  const [catalogUnreadable, setCatalogUnreadable] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<LightboxProjectCatalogSearchResultsPayload | null>(null);

  // Request ids: this webview's prefix (so a reloaded webview never mistakes
  // an answer meant for the one before it), the opening, and a running count.
  const idPrefix = React.useRef(`lbp-${Math.random().toString(36).slice(2, 10)}`);
  const opening = React.useRef(0);
  const minted = React.useRef(0);
  const pending = React.useRef<PendingAnswers>({});
  const mintRequestId = React.useCallback((kind: keyof PendingAnswers) => {
    minted.current += 1;
    return `${idPrefix.current}:${opening.current}:${kind}-${minted.current}`;
  }, []);

  const post = React.useCallback((type: LightboxProjectFilesRequest, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const open = React.useCallback((picker: LightboxProjectPicker) => {
    opening.current += 1;
    const requestId = mintRequestId('catalog');
    pending.current = { catalog: requestId };
    setCatalog(null);
    setCatalogUnreadable(false);
    setSearchResults(null);
    setOpenPicker(picker);
    post(MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG, { requestId });
  }, [mintRequestId, post]);
  const close = React.useCallback(() => {
    opening.current += 1;
    pending.current = {};
    setOpenPicker(null);
  }, []);
  const search = React.useCallback((query: string) => {
    const requestId = mintRequestId('search');
    pending.current = { ...pending.current, search: requestId };
    // An answer to another query is not this one's: its matches and bound note go now, not when this answers.
    setSearchResults((current) => (current && !sameQuery(current.query, query) ? null : current));
    post(MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG, { requestId, query });
  }, [mintRequestId, post]);
  const clearSearch = React.useCallback(() => {
    pending.current = { ...pending.current, search: undefined };
    setSearchResults(null);
  }, []);
  const chooseSource = React.useCallback(
    ({ group, path }: ConfiguredResourceRef) => post(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, { group, path }),
    [post]
  );
  const addContext = React.useCallback((items: ConfiguredResourceRef[]) => {
    if (items.length > 0) {
      post(MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT, { items: items.map(({ group, path }) => ({ group, path })) });
    }
  }, [post]);

  const handleCatalog = React.useCallback((message: LightboxProjectCatalogMessage) => {
    const payload = message.payload;
    if (!payload || !Array.isArray(payload.entries) || !isPending(pending.current.catalog, payload.requestId)) {
      return;
    }
    pending.current = { ...pending.current, catalog: undefined };
    setCatalog(payload.entries);
    setCatalogUnreadable(payload.unreadable === true);
  }, []);
  const handleSearchResults = React.useCallback((message: LightboxProjectCatalogSearchResultsMessage) => {
    const payload = message.payload;
    if (!payload || !Array.isArray(payload.matches) || !isPending(pending.current.search, payload.requestId)) {
      return;
    }
    pending.current = { ...pending.current, search: undefined };
    setSearchResults(payload);
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
    addContext,
    handleCatalog,
    handleSearchResults,
    persistedState: NO_PERSISTENCE
  };
}

/** An answer is taken only when its id is the one still pending; none is pending once it is taken. */
function isPending(awaited: string | undefined, requestId: unknown): boolean {
  return awaited !== undefined && requestId === awaited;
}
