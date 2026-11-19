/**
 * A reply's to-do receipt, as the webview asks to undo it (ADR 2026-11-19
 * D8): Undo on one row, and the words an Undo that did nothing came back
 * with.
 *
 * - **Host-owned truth.** The rows and their states arrive on the
 *   snapshot's turns; nothing is worked out here. Undo posts ids only (a
 *   webview-minted `requestId`, the room revision, the turn id, the row's
 *   index) and waits for `WORKSHOP_TODO_STATUS_UNDO_RESULT`.
 * - **Correlated.** Only an answer still waited for, for the room on screen,
 *   is taken: a late, duplicate or other room's answer changes nothing.
 * - **Per row** (`turnId#index`): one Undo at a time; a refusal's words stay
 *   with the row until the next room.
 * - **It listens for its own answer** (`useMessageRouter`), so the app's
 *   router gains no route.
 * - **A new room** drops everything the old one waited on or said.
 * - **Nothing persisted.** The session owns the rows.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopTodoStatusUndoResultMessage,
  type WorkshopUndoTodoStatusPayload
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useMessageRouter } from '@hooks/useMessageRouter';

export interface WorkshopTodoReceiptState {
  /** Rows whose Undo waits for the host, by `workshopTodoReceiptKey`. */
  undoing: ReadonlySet<string>;
  /** The host's words for an Undo that did nothing, by row. */
  feedback: ReadonlyMap<string, string>;
}

export interface WorkshopTodoReceiptActions {
  undo: (turnId: string, index: number) => void;
  handleResult: (message: WorkshopTodoStatusUndoResultMessage) => void;
}

export interface WorkshopTodoReceiptPersistence {
  // The session owns every row; nothing is kept in webview state.
}

export type UseWorkshopTodoReceiptReturn = WorkshopTodoReceiptState &
  WorkshopTodoReceiptActions & {
    persistedState: WorkshopTodoReceiptPersistence;
  };

export interface UseWorkshopTodoReceiptOptions {
  /** The room's identity (`room:<revision>`, or `pending` before the first snapshot). */
  roomKey: string;
  /** The room generation rows are shown in; absent before the first snapshot, when nothing posts. */
  roomRevision?: number;
}

/** One row's key. */
export const workshopTodoReceiptKey = (turnId: string, index: number): string => `${turnId}#${index}`;

const SOURCE = 'webview.workshop.todoReceipt';
const NO_PERSISTENCE: WorkshopTodoReceiptPersistence = {};

export function useWorkshopTodoReceipt({ roomKey, roomRevision }: UseWorkshopTodoReceiptOptions): UseWorkshopTodoReceiptReturn {
  const vscode = useVSCodeApi();
  const [undoing, setUndoing] = React.useState<ReadonlySet<string>>(new Set());
  const [feedback, setFeedback] = React.useState<ReadonlyMap<string, string>>(new Map());
  const room = React.useRef({ key: roomKey, revision: roomRevision });
  const pending = React.useRef(new Map<string, { row: string; roomKey: string }>());
  const undoingRef = React.useRef(new Set<string>());
  const ids = React.useRef({ prefix: `ws-todo-undo-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const setRowUndoing = React.useCallback((row: string, value: boolean) => {
    if (value) {
      undoingRef.current.add(row);
    } else {
      undoingRef.current.delete(row);
    }
    setUndoing(new Set(undoingRef.current));
  }, []);

  const undo = React.useCallback((turnId: string, index: number) => {
    const { key, revision } = room.current;
    const row = workshopTodoReceiptKey(turnId, index);
    if (revision === undefined || undoingRef.current.has(row)) {
      return;
    }
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    pending.current.set(requestId, { row, roomKey: key });
    setRowUndoing(row, true);
    setFeedback((current) => {
      if (!current.has(row)) {
        return current;
      }
      const next = new Map(current);
      next.delete(row);
      return next;
    });
    // Ids only (D8): no text, no session, no status.
    const payload: WorkshopUndoTodoStatusPayload = { requestId, roomRevision: revision, turnId, index };
    vscode.postMessage({ type: MessageType.WORKSHOP_UNDO_TODO_STATUS, source: SOURCE, payload, timestamp: Date.now() });
  }, [setRowUndoing, vscode]);

  const clearWhenRoomChanges = React.useCallback((key: string, revision: number | undefined) => {
    const changed = room.current.key !== key;
    room.current = { key, revision };
    if (!changed) {
      return;
    }
    pending.current.clear();
    undoingRef.current.clear();
    setUndoing((current) => (current.size === 0 ? current : new Set()));
    setFeedback((current) => (current.size === 0 ? current : new Map()));
  }, []);
  React.useEffect(() => {
    clearWhenRoomChanges(roomKey, roomRevision);
  }, [clearWhenRoomChanges, roomKey, roomRevision]);

  const handleResult = React.useCallback((message: WorkshopTodoStatusUndoResultMessage) => {
    const owner = pending.current.get(message.payload.requestId);
    if (!owner) {
      return;
    }
    pending.current.delete(message.payload.requestId);
    if (owner.roomKey !== room.current.key) {
      return;
    }
    setRowUndoing(owner.row, false);
    if (!message.payload.ok) {
      setFeedback((current) => new Map(current).set(owner.row, message.payload.message));
    }
  }, [setRowUndoing]);

  const routes = React.useMemo(() => ({ [MessageType.WORKSHOP_TODO_STATUS_UNDO_RESULT]: handleResult }), [handleResult]);
  useMessageRouter(routes as Parameters<typeof useMessageRouter>[0]);

  return { undoing, feedback, undo, handleResult, persistedState: NO_PERSISTENCE };
}
