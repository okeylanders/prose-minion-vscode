/**
 * The Pinned context tab's transport (ADR 2026-11-04 D8, D9; epic Slice 3).
 *
 * - **Host-owned truth.** Its state is the host's last answer; nothing is
 *   applied optimistically, and every change is answered with the list.
 * - **Correlated.** Each request carries an id this hook mints; only the
 *   answer to the request it waits on is taken. A push (`requestId: null`)
 *   replaces the state only while no request is pending.
 * - **Derived, never stored** (D4). "In this conversation", the missing
 *   count and the attachments that could be pinned follow the room's
 *   snapshot through the shared match rule, so the tab moves with the room
 *   and nothing is posted.
 * - **One persisted preference:** whether the template well is open. The
 *   list, its paths and its words are never persisted.
 *
 * It asks for the list when the Workshop mounts, so the sessions menu has
 * its count before the tab is ever opened.
 */

import * as React from 'react';
import {
  MessageType,
  type ConfiguredResourceRef,
  type WorkshopContextAttachmentSnapshot,
  type WorkshopPinnedContextMessage,
  type WorkshopPinnedContextPayload
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';
import {
  workshopPinnedContextTabView,
  type WorkshopPinnedContextTabView
} from '@hooks/domain/workshop/pinnedContext/workshopPinnedContextTabView';

export interface WorkshopPinnedContextState {
  /** The host's last answer taken; absent until it answers. */
  answer?: WorkshopPinnedContextPayload;
  /** A request is waiting for its answer. */
  pending: boolean;
  /** The changes still waiting for their answers, so a caller can tell its own. */
  pendingRequestIds: readonly string[];
  /** The tab as drawn, derived from the answer and the room. */
  view: WorkshopPinnedContextTabView;
  /** Pinned entries, for the sessions menu: 0 until the host answers. */
  pinnedFileCount: number;
  /** The template well is open (the one persisted preference). */
  noteOpen: boolean;
}

export interface WorkshopPinnedContextActions {
  requestList: () => void;
  /** Each change returns the request id it posted, or undefined when there is no list to change. */
  pinResources: (items: readonly ConfiguredResourceRef[]) => string | undefined;
  pinAttachments: (attachmentIds: readonly string[]) => string | undefined;
  /**
   * Explore project folders… in pin mode: the host opens its picker. A
   * dismissed picker is answered with nothing, so this request never holds
   * the tab's other controls; its answer is still taken when it comes.
   */
  pinPickedFile: () => string | undefined;
  unpin: (entryPath: string) => string | undefined;
  move: (entryPath: string, direction: 'up' | 'down') => string | undefined;
  attachMissing: () => string;
  /** An entry's file, or the list file with no path. */
  openFile: (entryPath?: string) => string;
  toggleNote: () => void;
  handlePinnedContext: (message: WorkshopPinnedContextMessage) => void;
}

export interface WorkshopPinnedContextPersistence {
  pinnedContextNoteOpen: boolean;
}

export type UseWorkshopPinnedContextReturn = WorkshopPinnedContextState &
  WorkshopPinnedContextActions & {
    persistedState: WorkshopPinnedContextPersistence;
  };

export interface UseWorkshopPinnedContextInput {
  /** The room's attachments, from the session snapshot. */
  attachments: readonly WorkshopContextAttachmentSnapshot[];
  /** A reply or the Context wizard is running. */
  running: boolean;
}

const SOURCE = 'webview.workshop.pinnedContext';

export function useWorkshopPinnedContext({ attachments, running }: UseWorkshopPinnedContextInput): UseWorkshopPinnedContextReturn {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<Partial<WorkshopPinnedContextPersistence>>();
  const [noteOpen, setNoteOpen] = React.useState(persisted?.pinnedContextNoteOpen ?? true);
  const [answer, setAnswer] = React.useState<WorkshopPinnedContextPayload | undefined>(undefined);
  const [pendingRequestIds, setPendingRequestIds] = React.useState<readonly string[]>([]);
  const [listPending, setListPending] = React.useState(false);
  /** The list read waited on, and how many changes had settled when it was asked. */
  const read = React.useRef<{ id: string; epoch: number } | undefined>(undefined);
  /** Changes waiting for their answers (a pick held apart: a dismissed picker never answers). */
  const changes = React.useRef(new Map<string, 'change' | 'pick'>());
  /** How many changes have settled: a read asked before one settled describes an older list (PR #210 F03). */
  const epoch = React.useRef(0);
  const revision = React.useRef<string | null>(null);
  const ids = React.useRef({ prefix: `ws-pinned-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const syncPending = React.useCallback(() => {
    setListPending(read.current !== undefined || [...changes.current.values()].includes('change'));
    setPendingRequestIds([...changes.current.keys()]);
  }, []);

  const send = React.useCallback((type: MessageType, payload: Record<string, unknown>, kind: 'read' | 'change' | 'pick'): string => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    if (kind === 'read') {
      read.current = { id: requestId, epoch: epoch.current };
    } else {
      changes.current.set(requestId, kind);
    }
    syncPending();
    vscode.postMessage({ type, source: SOURCE, payload: { requestId, ...payload }, timestamp: Date.now() });
    return requestId;
  }, [syncPending, vscode]);

  /** A change to the list, against the revision the tab shows. */
  const change = React.useCallback((type: MessageType, payload: Record<string, unknown>, kind: 'change' | 'pick' = 'change'): string | undefined => {
    if (revision.current === null) {
      return undefined;
    }
    return send(type, { revision: revision.current, ...payload }, kind);
  }, [send]);

  const requestList = React.useCallback(() => {
    send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {}, 'read');
  }, [send]);

  React.useEffect(() => {
    requestList();
  }, [requestList]);

  const pinPickedFile = React.useCallback(
    (): string | undefined => change(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, {}, 'pick'),
    [change]
  );

  /**
   * Mutations and reads are tracked apart (PR #210 F03). A change's answer is
   * the list after it settled, so it is always taken. A read is taken only
   * while it is the newest read and no change has settled since it was asked;
   * otherwise its list may predate a committed change, and the change's own
   * answer already holds the newer list. A push is taken only while nothing
   * waits.
   */
  const handlePinnedContext = React.useCallback((message: WorkshopPinnedContextMessage) => {
    const payload = message.payload;
    const apply = () => {
      revision.current = payload.revision;
      setAnswer(payload);
    };
    if (payload.requestId !== null && changes.current.has(payload.requestId)) {
      changes.current.delete(payload.requestId);
      epoch.current += 1;
      apply();
      syncPending();
      return;
    }
    if (payload.requestId !== null && payload.requestId === read.current?.id) {
      const current = read.current.epoch === epoch.current;
      read.current = undefined;
      if (current) {
        apply();
      }
      syncPending();
      return;
    }
    if (payload.requestId === null && read.current === undefined && ![...changes.current.values()].includes('change')) {
      apply();
    }
  }, [syncPending]);

  const actions: Omit<WorkshopPinnedContextActions, 'requestList' | 'handlePinnedContext' | 'toggleNote' | 'pinPickedFile'> = React.useMemo(() => ({
    pinResources: (items) => change(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, { items: items.map(({ group, path }) => ({ group, path })) }),
    pinAttachments: (attachmentIds) => change(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { attachmentIds: [...attachmentIds] }),
    unpin: (entryPath) => change(MessageType.WORKSHOP_UNPIN_CONTEXT, { entryPath }),
    move: (entryPath, direction) => change(MessageType.WORKSHOP_MOVE_PINNED_CONTEXT, { entryPath, direction }),
    attachMissing: () => send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {}, 'change'),
    openFile: (entryPath) => send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, entryPath === undefined ? {} : { entryPath }, 'change')
  }), [change, send]);

  const toggleNote = React.useCallback(() => setNoteOpen((open) => !open), []);

  const pending = listPending;
  const view = React.useMemo(
    () => workshopPinnedContextTabView({ ...(answer ? { answer } : {}), attachments, running, pending }),
    [answer, attachments, pending, running]
  );
  const persistedState = React.useMemo(() => ({ pinnedContextNoteOpen: noteOpen }), [noteOpen]);

  return {
    ...(answer ? { answer } : {}),
    pending,
    pendingRequestIds,
    view,
    pinnedFileCount: answer?.availability.available && answer.file.state === 'ok' ? answer.entries.length : 0,
    noteOpen,
    requestList,
    ...actions,
    pinPickedFile,
    toggleNote,
    handlePinnedContext,
    persistedState
  };
}
