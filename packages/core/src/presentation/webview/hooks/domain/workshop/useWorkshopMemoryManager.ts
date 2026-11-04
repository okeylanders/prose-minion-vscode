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
  type WorkshopMemoryWriteResultMessage,
  type WorkshopSessionStateMessage
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
  /** Open memory folder: waiting, or why it didn't open, for the panel it was pressed in (PR #202 F04). */
  folder: WorkshopMemoryFolderStatus;
  /** The memory a card's Open in manager named, marked in the manager (PR #202 N02). */
  focusMemoryId?: string;
}

export interface WorkshopMemoryFolderStatus {
  readonly pending: boolean;
  readonly error?: string;
}

export interface WorkshopMemoryManagerActions {
  requestListing: () => void;
  /** Open the manager; with a memory's id, that memory's row is marked. */
  openManager: (focusMemoryId?: string) => void;
  /** Conversation settings opened or closed: while open, the Memory tab shows the listing, so other writes refresh it (PR #202 N01). */
  setSettingsVisible: (visible: boolean) => void;
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
  /** Slice 3's write answers: this hook's own, and a refresh after any write that landed while the manager or the settings show the listing. */
  noteWriteResult: (message: WorkshopMemoryWriteResultMessage) => void;
  /** The room's snapshot: a Save and tell me receipt not seen before refreshes a visible listing (PR #202 N04). */
  noteSessionState: (message: WorkshopSessionStateMessage) => void;
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
  | { readonly kind: 'open' }
  | { readonly kind: 'folder' };

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
  const [folder, setFolder] = React.useState<WorkshopMemoryFolderStatus>({ pending: false });
  const [focusMemoryId, setFocusMemoryId] = React.useState<string | undefined>(undefined);
  const settingsVisibleRef = React.useRef(false);
  /** Save and tell me's receipts already seen, by turn id: only a new one means the folder moved. */
  const autoReceipts = React.useRef(new Set<string>());
  /** The newest Open memory folder press: only its answer says how the folder went (PR #202 N03). */
  const folderRequest = React.useRef<string | undefined>(undefined);
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

  const start = React.useCallback((entry: Pending, type: MessageType, payload: object): string => {
    const requestId = mint();
    pending.current.set(requestId, entry);
    setActionPending(true);
    setActionError(undefined);
    if (entry.kind === 'load-in-full') {
      setRefusal(undefined);
    }
    post(type, { requestId, ...payload });
    return requestId;
  }, [mint, post]);

  const openManager = React.useCallback((focus?: string) => {
    managerOpenRef.current = true;
    setManagerOpen(true);
    setFocusMemoryId(focus);
    setActionError(undefined);
    setRefusal(undefined);
    requestListing();
  }, [requestListing]);

  const closeManager = React.useCallback(() => {
    managerOpenRef.current = false;
    queryRef.current = '';
    setManagerOpen(false);
    setFocusMemoryId(undefined);
    setQueryState('');
    setRefusal(undefined);
    setActionError(undefined);
    // The tab reads the whole folder again, not the manager's search.
    requestListing();
  }, [requestListing]);

  const setSettingsVisible = React.useCallback((visible: boolean) => {
    settingsVisibleRef.current = visible;
    if (!visible) {
      // Closed, the panel that showed it is gone; reopened, Open memory folder starts clean.
      setFolder((current) => (current.error ? { pending: current.pending } : current));
    }
  }, []);

  const setQuery = React.useCallback((next: string) => {
    queryRef.current = next;
    setQueryState(next);
    requestListing();
  }, [requestListing]);

  const entryKeyOf = (memoryId: string): string | undefined =>
    listingRef.current?.memories.find((entry) => entry.id === memoryId)?.entryKey;

  const actions: Omit<WorkshopMemoryManagerActions, 'requestListing' | 'openManager' | 'setSettingsVisible' | 'closeManager' | 'setQuery'> = {
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
    openFolder: () => {
      setFolder({ pending: true });
      folderRequest.current = start({ kind: 'folder' }, MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { action: 'open-folder' });
    },
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
      if (entry.kind === 'folder') {
        // Only the newest press's answer says how Open memory folder went; an older one, however late, says nothing.
        if (message.payload.requestId !== folderRequest.current) {
          return;
        }
        folderRequest.current = undefined;
        setFolder(message.payload.ok ? { pending: false } : { pending: false, error: message.payload.error });
      }
      if (message.payload.ok) {
        if (entry.kind !== 'open' && entry.kind !== 'folder') {
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
      if (entry.kind !== 'folder' || managerOpenRef.current) {
        setActionError(message.payload.error);
      }
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
      // A write from the sheet or a card that landed while the manager or the settings show the listing: what they show moved.
      if (message.payload.ok && (managerOpenRef.current || settingsVisibleRef.current)) {
        requestListing();
      }
    },
    noteSessionState: (message) => {
      let landed = false;
      for (const turn of message.payload.session.turns) {
        if (turn.projectMemoryReceipt?.by === 'auto' && !autoReceipts.current.has(turn.id)) {
          autoReceipts.current.add(turn.id);
          landed = true;
        }
      }
      // An automatic save writes no WORKSHOP_MEMORY_WRITE_RESULT; its receipt in the snapshot is the sign.
      if (landed && (managerOpenRef.current || settingsVisibleRef.current)) {
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
    folder,
    ...(focusMemoryId ? { focusMemoryId } : {}),
    requestListing,
    openManager,
    setSettingsVisible,
    closeManager,
    setQuery,
    ...actions,
    persistedState: {}
  };
}
