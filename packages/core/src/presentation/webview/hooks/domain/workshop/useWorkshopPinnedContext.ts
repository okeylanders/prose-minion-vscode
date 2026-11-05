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
  /** The id of the request waiting, so a caller can tell its own answer. */
  pendingRequestId?: string;
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
  const [pendingRequestId, setPendingRequestId] = React.useState<string | undefined>(undefined);
  const waiting = React.useRef<string | undefined>(undefined);
  const revision = React.useRef<string | null>(null);
  const ids = React.useRef({ prefix: `ws-pinned-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const post = React.useCallback((type: MessageType, payload: Record<string, unknown>): string => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    waiting.current = requestId;
    setPendingRequestId(requestId);
    vscode.postMessage({ type, source: SOURCE, payload: { requestId, ...payload }, timestamp: Date.now() });
    return requestId;
  }, [vscode]);

  /** A change to the list, against the revision the tab shows. */
  const change = React.useCallback((type: MessageType, payload: Record<string, unknown>): string | undefined => {
    if (revision.current === null) {
      return undefined;
    }
    return post(type, { revision: revision.current, ...payload });
  }, [post]);

  const requestList = React.useCallback(() => {
    post(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
  }, [post]);

  React.useEffect(() => {
    requestList();
  }, [requestList]);

  const handlePinnedContext = React.useCallback((message: WorkshopPinnedContextMessage) => {
    const payload = message.payload;
    if (payload.requestId === null ? waiting.current !== undefined : payload.requestId !== waiting.current) {
      return;
    }
    waiting.current = undefined;
    revision.current = payload.revision;
    setPendingRequestId(undefined);
    setAnswer(payload);
  }, []);

  const actions: Omit<WorkshopPinnedContextActions, 'requestList' | 'handlePinnedContext' | 'toggleNote'> = React.useMemo(() => ({
    pinResources: (items) => change(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, { items: items.map(({ group, path }) => ({ group, path })) }),
    pinAttachments: (attachmentIds) => change(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { attachmentIds: [...attachmentIds] }),
    unpin: (entryPath) => change(MessageType.WORKSHOP_UNPIN_CONTEXT, { entryPath }),
    move: (entryPath, direction) => change(MessageType.WORKSHOP_MOVE_PINNED_CONTEXT, { entryPath, direction }),
    attachMissing: () => post(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {}),
    openFile: (entryPath) => post(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, entryPath === undefined ? {} : { entryPath })
  }), [change, post]);

  const toggleNote = React.useCallback(() => setNoteOpen((open) => !open), []);

  const pending = pendingRequestId !== undefined;
  const view = React.useMemo(
    () => workshopPinnedContextTabView({ ...(answer ? { answer } : {}), attachments, running, pending }),
    [answer, attachments, pending, running]
  );
  const persistedState = React.useMemo(() => ({ pinnedContextNoteOpen: noteOpen }), [noteOpen]);

  return {
    ...(answer ? { answer } : {}),
    pending,
    ...(pendingRequestId ? { pendingRequestId } : {}),
    view,
    pinnedFileCount: answer?.availability.available && answer.file.state === 'ok' ? answer.entries.length : 0,
    noteOpen,
    requestList,
    ...actions,
    toggleNote,
    handlePinnedContext,
    persistedState
  };
}
