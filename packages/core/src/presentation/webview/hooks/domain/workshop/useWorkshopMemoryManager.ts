/**
 * The Memory tab's and the memory manager's transport (ADR 2026-11-04 D5,
 * D8, D10; epic Slice 4b): the folder's listing, the manager's open state
 * and search, and every action a row can ask for.
 *
 * - **Host-owned truth.** The listing (rows, estimate, residency) is the
 *   host's; nothing is applied optimistically. Every action that lands asks
 *   for the listing again.
 * - **Correlated.** Each request carries an id this hook mints, and only an
 *   answer still pending is taken: a late listing never replaces a newer
 *   one, and a late result never closes over a newer action.
 * - **Whose route.** The manager's own (`WORKSHOP_MEMORY_MANAGER_ACTION`):
 *   Always load in full, Delete, Open file, Open memory folder. Slice 3's:
 *   Archive and Restore (`WORKSHOP_MEMORY_FORGET`, so their receipts stand)
 *   and Rename (the sheet's own read then edit, the same whole-draft edit
 *   the sheet makes). Edit and New open Slice 3's sheet, not this hook.
 *   Slice 3's answers reach this hook through `noteWriteResult` and
 *   `noteEditData`, beside `useWorkshopProjectMemory`; each takes only its
 *   own requests.
 * - **Nothing persisted.** Memory files own everything.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopMemoryEditDataMessage,
  type WorkshopMemoryListingMessage,
  type WorkshopMemoryListingPayload,
  type WorkshopMemoryManagerResultMessage,
  type WorkshopMemoryWriteResultMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import type { WorkshopMemoryLoadInFullRefusal } from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';

export interface WorkshopMemoryManagerState {
  /** The latest listing answered; absent until the host answers. */
  listing?: WorkshopMemoryListingPayload;
  /** A listing is pending. */
  listingPending: boolean;
  managerOpen: boolean;
  query: string;
  /** An action is waiting for the host: rows' writes wait for it. */
  actionPending: boolean;
  /** The latest refused Always load in full, on its row. */
  refusal?: WorkshopMemoryLoadInFullRefusal;
  /** The latest refusal of any other action, in the host's words. */
  actionError?: string;
}

export interface WorkshopMemoryManagerActions {
  requestListing: () => void;
  openManager: () => void;
  closeManager: () => void;
  setQuery: (query: string) => void;
  toggleLoadInFull: (memoryId: string, loadInFull: boolean) => void;
  archive: (memoryId: string) => void;
  restore: (memoryId: string) => void;
  remove: (memoryId: string) => void;
  rename: (memoryId: string, title: string) => void;
  openFile: (entryKey: string) => void;
  openFolder: () => void;
  handleListing: (message: WorkshopMemoryListingMessage) => void;
  handleManagerResult: (message: WorkshopMemoryManagerResultMessage) => void;
  /** Slice 3's write answers: this hook's own, and a refresh after any write that landed while the manager is open. */
  noteWriteResult: (message: WorkshopMemoryWriteResultMessage) => void;
  /** Slice 3's edit data: a rename's read. */
  noteEditData: (message: WorkshopMemoryEditDataMessage) => void;
}

export interface WorkshopMemoryManagerPersistence {
  // Memory files own everything; nothing is kept in webview state.
}

export type UseWorkshopMemoryManagerReturn = WorkshopMemoryManagerState &
  WorkshopMemoryManagerActions & {
    persistedState: WorkshopMemoryManagerPersistence;
  };

type Pending =
  | { readonly kind: 'load-in-full'; readonly memoryId: string }
  | { readonly kind: 'write' }
  | { readonly kind: 'open' };

const SOURCE = 'webview.workshop.memoryManager';

export function useWorkshopMemoryManager(): UseWorkshopMemoryManagerReturn {
  const vscode = useVSCodeApi();
  const [listing, setListing] = React.useState<WorkshopMemoryListingPayload | undefined>(undefined);
  const [listingPending, setListingPending] = React.useState(false);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [query, setQueryState] = React.useState('');
  const [actionPending, setActionPending] = React.useState(false);
  const [refusal, setRefusal] = React.useState<WorkshopMemoryLoadInFullRefusal | undefined>(undefined);
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);
  const listRequest = React.useRef<string | undefined>(undefined);
  const queryRef = React.useRef('');
  const managerOpenRef = React.useRef(false);
  const listingRef = React.useRef<WorkshopMemoryListingPayload | undefined>(undefined);
  const pending = React.useRef(new Map<string, Pending>());
  /** A rename's read, by its request: the memory and the new title. */
  const renames = React.useRef(new Map<string, { memoryId: string; title: string }>());
  const ids = React.useRef({ prefix: `ws-memory-manager-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const mint = React.useCallback((): string => {
    ids.current.count += 1;
    return `${ids.current.prefix}-${ids.current.count}`;
  }, []);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const requestListing = React.useCallback(() => {
    const requestId = mint();
    listRequest.current = requestId;
    setListingPending(true);
    post(MessageType.WORKSHOP_MEMORY_LIST, { requestId, query: managerOpenRef.current ? queryRef.current : '' });
  }, [mint, post]);

  const settleAction = React.useCallback(() => {
    setActionPending(pending.current.size > 0 || renames.current.size > 0);
  }, []);

  const start = React.useCallback((entry: Pending, type: MessageType, payload: object) => {
    const requestId = mint();
    pending.current.set(requestId, entry);
    setActionPending(true);
    setActionError(undefined);
    if (entry.kind === 'load-in-full') {
      setRefusal(undefined);
    }
    post(type, { requestId, ...payload });
  }, [mint, post]);

  const openManager = React.useCallback(() => {
    managerOpenRef.current = true;
    setManagerOpen(true);
    setActionError(undefined);
    setRefusal(undefined);
    requestListing();
  }, [requestListing]);

  const closeManager = React.useCallback(() => {
    managerOpenRef.current = false;
    queryRef.current = '';
    setManagerOpen(false);
    setQueryState('');
    setRefusal(undefined);
    setActionError(undefined);
    // The tab reads the whole folder again, not the manager's search.
    requestListing();
  }, [requestListing]);

  const setQuery = React.useCallback((next: string) => {
    queryRef.current = next;
    setQueryState(next);
    requestListing();
  }, [requestListing]);

  const entryKeyOf = (memoryId: string): string | undefined =>
    listingRef.current?.memories.find((entry) => entry.id === memoryId)?.entryKey;

  const actions: Omit<WorkshopMemoryManagerActions, 'requestListing' | 'openManager' | 'closeManager' | 'setQuery'> = {
    toggleLoadInFull: (memoryId, loadInFull) =>
      start({ kind: 'load-in-full', memoryId }, MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { action: 'set-load-in-full', memoryId, loadInFull }),
    archive: (memoryId) => start({ kind: 'write' }, MessageType.WORKSHOP_MEMORY_FORGET, { memoryId, action: 'forget' }),
    restore: (memoryId) => start({ kind: 'write' }, MessageType.WORKSHOP_MEMORY_FORGET, { memoryId, action: 'restore' }),
    remove: (memoryId) => start({ kind: 'write' }, MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { action: 'delete', memoryId }),
    rename: (memoryId, title) => {
      const requestId = mint();
      renames.current.set(requestId, { memoryId, title });
      setActionPending(true);
      setActionError(undefined);
      post(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT, { requestId, memoryId });
    },
    openFile: (entryKey) => start({ kind: 'open' }, MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { action: 'open-file', entryKey }),
    openFolder: () => start({ kind: 'open' }, MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { action: 'open-folder' }),
    handleListing: (message) => {
      if (message.payload.requestId !== listRequest.current) {
        return;
      }
      listRequest.current = undefined;
      listingRef.current = message.payload;
      setListing(message.payload);
      setListingPending(false);
    },
    handleManagerResult: (message) => {
      const entry = pending.current.get(message.payload.requestId);
      if (!entry) {
        return;
      }
      pending.current.delete(message.payload.requestId);
      settleAction();
      if (message.payload.ok) {
        if (entry.kind !== 'open') {
          requestListing();
        }
        return;
      }
      if (entry.kind === 'load-in-full' && message.payload.budget) {
        const entryKey = entryKeyOf(entry.memoryId);
        if (entryKey) {
          setRefusal({ entryKey, wouldBeTokens: message.payload.budget.totalTokens });
          return;
        }
      }
      setActionError(message.payload.error);
      // A file that wasn't where the list said: read the list again.
      requestListing();
    },
    noteWriteResult: (message) => {
      const entry = pending.current.get(message.payload.requestId);
      if (entry) {
        pending.current.delete(message.payload.requestId);
        settleAction();
        if (!message.payload.ok) {
          setActionError(message.payload.error);
        }
        requestListing();
        return;
      }
      // A write from the sheet or a card that landed while the manager is open: what it shows moved.
      if (message.payload.ok && managerOpenRef.current) {
        requestListing();
      }
    },
    noteEditData: (message) => {
      const rename = renames.current.get(message.payload.requestId);
      if (!rename) {
        return;
      }
      renames.current.delete(message.payload.requestId);
      if (!message.payload.draft) {
        settleAction();
        setActionError(message.payload.error);
        requestListing();
        return;
      }
      start({ kind: 'write' }, MessageType.WORKSHOP_MEMORY_UPDATE, {
        memoryId: rename.memoryId,
        patch: { ...message.payload.draft, title: rename.title }
      });
    }
  };

  return {
    listing,
    listingPending,
    managerOpen,
    query,
    actionPending,
    refusal,
    actionError,
    requestListing,
    openManager,
    closeManager,
    setQuery,
    ...actions,
    persistedState: {}
  };
}
