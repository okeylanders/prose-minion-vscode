/**
 * The host's and the receipt card's words for a persona's to-do changes
 * (ADR 2026-11-19 D8, D9). Fixed words only: a phrase never holds a to-do's
 * text, a note or a title; the card puts those beside it.
 */

import type {
  WorkshopTodoStatusChange,
  WorkshopTodoStatusSettable,
  WorkshopTodoStatusUndoRefusal,
  WorkshopTodoStatusWriteRefusal
} from '@shared/types/messages/workshop/todoStatus';

/** What Undo did not do, and why. */
export const WORKSHOP_TODO_STATUS_UNDO_REFUSAL_WORDS: Readonly<Record<WorkshopTodoStatusUndoRefusal, string>> = Object.freeze({
  'invalid-request': 'That Undo could not be read.',
  'room-changed': 'This room changed since; nothing was undone.',
  'session-operation': 'A session is being saved or opened. Try Undo again in a moment.',
  'no-row': 'That change is no longer in this room.',
  'not-undoable': 'That change cannot be undone now.',
  elsewhere: 'Undo is in the room that made this change.',
  'todo-changed': 'This to-do changed since; use its own control.',
  'session-changed': 'The saved session changed on disk; nothing was undone. Open it to change the to-do.',
  'session-not-found': 'The saved session is gone.',
  'sessions-unavailable': 'Saved sessions could not be reached just then.',
  failed: 'The change could not be undone.'
});

export const WORKSHOP_TODO_STATUS_UNDONE_WORDS = 'Undone: the to-do is open again.';

/** A row's refusal, as the card shows it. */
export const WORKSHOP_TODO_STATUS_ROW_REFUSAL_WORDS: Readonly<Record<WorkshopTodoStatusWriteRefusal, string>> = Object.freeze({
  'session-changed': 'Not saved: the session changed since it was read.',
  'room-changed': 'Not saved: the reply left the room first.',
  'session-not-found': 'Not saved: the session is gone.',
  'sessions-unavailable': 'Not saved: saved sessions could not be reached.',
  'write-failed': 'Not saved: the session could not be written.'
});

/** "Done" or "Dismissed". */
export function workshopTodoStatusWord(status: WorkshopTodoStatusSettable): string {
  return status === 'completed' ? 'Done' : 'Dismissed';
}

/** "Done · by Jill in Polish 6.11": a closed to-do's line (D9). */
export function workshopTodoClosedByLine(status: WorkshopTodoStatusSettable, personaLabel: string, sessionTitle: string): string {
  return sessionTitle ? `${workshopTodoStatusWord(status)} · by ${personaLabel} in ${sessionTitle}` : `${workshopTodoStatusWord(status)} · by ${personaLabel}`;
}

/** The card's heading: "Marked 3 to-dos" (counts only, also the transcript's line). */
export function workshopTodoReceiptHeading(rows: readonly Pick<WorkshopTodoStatusChange, 'status'>[]): string {
  const done = rows.filter((row) => row.status === 'completed').length;
  const dismissed = rows.length - done;
  const parts = [
    ...(done > 0 ? [`${done} done`] : []),
    ...(dismissed > 0 ? [`${dismissed} dismissed`] : [])
  ];
  return `Marked ${rows.length === 1 ? '1 to-do' : `${rows.length} to-dos`}: ${parts.join(', ')}`;
}
