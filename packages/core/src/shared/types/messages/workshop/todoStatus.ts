/**
 * A persona's to-do status changes (ADR 2026-11-19 D1–D9): who closed a
 * to-do, the receipt rows a reply carries, and the writer's Undo.
 *
 * - **`closedBy`** is optional and additive on every stored to-do: a
 *   persona's close records the persona, the room it was closed from and
 *   its title then, the turn, the time and the note. The writer's own
 *   change clears it.
 * - **`todoStatusChanges`** is optional and additive on a host or guest
 *   reply: one row per change, in reply order. A row names the session as
 *   `current` (the open room) or a saved session's id, and holds the to-do's
 *   text and the session's title as read, so the card can name them.
 * - **Undo posts ids only** (`requestId`, `roomRevision`, `turnId`,
 *   `index`), and the host answers by `requestId`.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { WorkshopPersonaId } from './participants';

/** The open room, as a trailer and a row name it. */
export const WORKSHOP_TODO_STATUS_CURRENT_SESSION = 'current';

/** What a persona may set (D3): only the writer reopens. */
export const WORKSHOP_TODO_STATUS_SETTABLE = ['completed', 'dismissed'] as const;
export type WorkshopTodoStatusSettable = typeof WORKSHOP_TODO_STATUS_SETTABLE[number];

export function isWorkshopTodoStatusSettable(value: unknown): value is WorkshopTodoStatusSettable {
  return value === 'completed' || value === 'dismissed';
}

/** Who closed a to-do, when a persona did (D9). */
export interface WorkshopTodoClosedBy {
  personaId: WorkshopPersonaId;
  personaLabel: string;
  /** The room it was closed from, and its title then. */
  sessionId: string;
  sessionTitle: string;
  turnId: string;
  at: number;
  /** The write that set it (D8a): what reconciliation and Undo recognize. */
  operationId: string;
  note?: string;
}

/** A row's state (D5, D8). */
/** `unverified` (D8b): the target could not be read to tell; not final, re-checked read-only. */
export const WORKSHOP_TODO_STATUS_CHANGE_STATES = ['applied', 'saving', 'refused', 'interrupted', 'unverified', 'undone'] as const;
export type WorkshopTodoStatusChangeState = typeof WORKSHOP_TODO_STATUS_CHANGE_STATES[number];

/**
 * Why a saved session's row was not written (D5, D6): a closed list, whose
 * words are `WORKSHOP_TODO_STATUS_REFUSAL_WORDS`.
 */
export const WORKSHOP_TODO_STATUS_WRITE_REFUSALS = [
  /** The file changed since it was read: nothing was overwritten. */
  'session-changed',
  /** The reply left the room (a Rewind, a new room) before the write. */
  'room-changed',
  /** The session is gone from the store. */
  'session-not-found',
  /** Another window held the file under its claim just then (D6a). */
  'session-busy',
  /** The store or the workspace was not available. */
  'sessions-unavailable',
  /** The write failed. */
  'write-failed',
  /** The room holding the receipt could not be saved first, so no saved session was written (D5). */
  'receipt-not-saved'
] as const;
export type WorkshopTodoStatusWriteRefusal = typeof WORKSHOP_TODO_STATUS_WRITE_REFUSALS[number];

/** One receipt row: one change, as made (D8). */
export interface WorkshopTodoStatusChange {
  /** `current` (the open room), or a saved session's id. */
  session: string;
  /** The session's title as read: the open room's, or the saved file's. */
  sessionTitle: string;
  todoId: string;
  /** The to-do's text as read, cut to the to-do's own bound. */
  todoText: string;
  status: WorkshopTodoStatusSettable;
  /** The status it held before: always `open` (D3). */
  previous: 'open';
  note?: string;
  state: WorkshopTodoStatusChangeState;
  /**
   * The write that makes this change (D8a): one per saved session's write,
   * one for the open room's changes; stamped into `closedBy.operationId`.
   */
  operationId: string;
  /** With `refused` only. */
  reason?: WorkshopTodoStatusWriteRefusal;
  /**
   * The open room's session id when the reply committed: a saved row's Undo
   * belongs to that room (D5). Host-only: the webview gets `elsewhere`.
   */
  roomSessionId?: string;
  /** Webview-only: a saved row whose Undo is in another room (a branch's copy). */
  elsewhere?: true;
}

/** The writer's Undo of one row: ids only. */
export interface WorkshopUndoTodoStatusPayload {
  requestId: string;
  roomRevision: number;
  turnId: string;
  index: number;
}

export interface WorkshopUndoTodoStatusMessage extends MessageEnvelope<WorkshopUndoTodoStatusPayload> {
  type: MessageType.WORKSHOP_UNDO_TODO_STATUS;
}

/** Why an Undo did nothing: a closed list, worded by the host. */
export const WORKSHOP_TODO_STATUS_UNDO_REFUSALS = [
  'invalid-request',
  'room-changed',
  'session-operation',
  'no-row',
  'not-undoable',
  'elsewhere',
  'todo-changed',
  'session-changed',
  'session-busy',
  'session-not-found',
  'sessions-unavailable',
  'failed'
] as const;
export type WorkshopTodoStatusUndoRefusal = typeof WORKSHOP_TODO_STATUS_UNDO_REFUSALS[number];

export interface WorkshopTodoStatusUndoResultPayload {
  requestId: string;
  turnId: string;
  index: number;
  ok: boolean;
  reason?: WorkshopTodoStatusUndoRefusal;
  /** The writer's words for it. */
  message: string;
}

export interface WorkshopTodoStatusUndoResultMessage extends MessageEnvelope<WorkshopTodoStatusUndoResultPayload> {
  type: MessageType.WORKSHOP_TODO_STATUS_UNDO_RESULT;
}
