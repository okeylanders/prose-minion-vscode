/**
 * The saved-session write port for a persona's to-do changes (ADR 2026-11-19
 * D6). Recall never imports it, and it imports nothing of `recall/`: recall
 * stays read-only, and this is the one way a saved session's to-dos change
 * from a reply.
 *
 * - **`read`** returns one saved session as it stands, decoded exactly as the
 *   store's compare reads it, or why not. The copy is held in memory only.
 * - **`write`** writes status changes only if the file still equals what
 *   `read` returned: the store's `updateNamed` compares and swaps, when the
 *   write begins and again at the commit. `updatedAt` moves to now, so
 *   recall's cache (keyed by it) reads the new status.
 * - **`openRoom`** names the open room: its session id, the named session it
 *   is saved as, and its title. A frame naming either id is the open room.
 */

import type { WorkshopTodoClosedBy, WorkshopTodoStatus, WorkshopTodoStatusWriteRefusal } from '@messages';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopStoredTodoItemV1 } from '@/application/services/workshop/WorkshopSessionStateV1';

/** Why a saved session could not be read for a change: the settlement's codes (`WorkshopTodoStatusDropCode`). */
export type WorkshopSavedTodoReadFault =
  | 'unknown-session'
  | 'unreadable-session'
  | 'session-needs-recovery'
  | 'store-unavailable'
  | 'workspace-changed';

export interface WorkshopSavedTodoReadOk {
  readonly kind: 'read';
  readonly sessionId: string;
  readonly title: string;
  readonly todos: readonly WorkshopStoredTodoItemV1[];
  /** What the write compares against. Never stored. */
  readonly session: WorkshopPersistedSessionV2;
}

export type WorkshopSavedTodoRead =
  | WorkshopSavedTodoReadOk
  | { readonly kind: 'refused'; readonly reason: WorkshopSavedTodoReadFault };

/** One to-do's new status; `closedBy` absent clears it (an Undo). */
export interface WorkshopSavedTodoChange {
  readonly todoId: string;
  readonly status: WorkshopTodoStatus;
  readonly closedBy?: WorkshopTodoClosedBy;
}

export type WorkshopSavedTodoWrite =
  | { readonly kind: 'written' }
  | { readonly kind: 'refused'; readonly reason: WorkshopTodoStatusWriteRefusal };

/** The open room, as a change names it. */
export interface WorkshopTodoStatusOpenRoom {
  readonly sessionId: string;
  readonly title: string;
  /** Every id that names it: its session id, and the named session it is saved as. */
  readonly ids: readonly string[];
}

export interface WorkshopSavedSessionTodos {
  /** The open room, or undefined before the store is ready. */
  openRoom(): WorkshopTodoStatusOpenRoom | undefined;
  /** One saved session as it stands, with its to-dos, or why not. */
  read(sessionId: string): Promise<WorkshopSavedTodoRead>;
  /** Write these status changes, only if the file still equals `read`. Never rejects. */
  write(read: WorkshopSavedTodoReadOk, changes: readonly WorkshopSavedTodoChange[]): Promise<WorkshopSavedTodoWrite>;
}
