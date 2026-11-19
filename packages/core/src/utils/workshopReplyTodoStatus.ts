/**
 * A reply's to-do status frames, decoded and judged (ADR 2026-11-19 D2, D3).
 * Pure: the tail extractor (`workshopReplyControls`) finds the frames in its
 * one pass and hands this the ones tagged `<prose-minion-todo-status>`, each
 * with whether it stands at the tail.
 *
 * ```xml
 * <prose-minion-todo-status>
 *   <session>current</session>
 *   <todo>todo-3-1763500000000</todo>
 *   <status>completed</status>
 *   <note>Fixed in the polish pass.</note>
 * </prose-minion-todo-status>
 * ```
 *
 * - **One frame, one change.** `<session>` is `current` (the open room) or a
 *   saved session's id; an id that names the open room (`openRoomIds`) reads
 *   as `current`. `<todo>` is an id, copied. `<status>` is `completed` or
 *   `dismissed`, in any letter case. `<note>` is optional: one line, at most
 *   `noteCharacters`; empty reads as none.
 * - Each frame is judged on its own, in the order written: structure (as
 *   every trailer is), its inside (`malformed:<fault>`), a repeat of an
 *   earlier change's session and to-do (`duplicate`), then the bounds: past
 *   `changesPerReply` changes, or naming one saved session more than
 *   `savedSessionsPerReply`, is `over-cap`, dropped whole.
 * - Ids are never guessed here: whether they exist is the settlement's
 *   (`WorkshopReplyTodoStatus`). Reasons, never text: nothing logs a field.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  isWorkshopTodoStatusSettable,
  WORKSHOP_TODO_STATUS_CURRENT_SESSION,
  type WorkshopTodoStatusSettable
} from '@shared/types/messages/workshop/todoStatus';
import { readWorkshopTrailerElements, type WorkshopTrailerReadFault } from '@/utils/workshopTrailerElements';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_TODO_STATUS_TAG = 'prose-minion-todo-status';

export const WORKSHOP_TODO_STATUS_REDACTION = '[to-do status removed]';

export const WORKSHOP_TODO_STATUS_ELEMENTS = ['session', 'todo', 'status', 'note'] as const;

/** The longest id a frame may name: a session's or a to-do's. A codec bound, never taught. */
export const WORKSHOP_TODO_STATUS_ID_CHARACTERS = 200;

export type WorkshopTodoStatusFault =
  | WorkshopTrailerReadFault
  | 'repeated-element'
  | 'missing-session'
  | 'invalid-session'
  | 'missing-todo'
  | 'invalid-todo'
  | 'missing-status'
  | 'unknown-status'
  | 'invalid-note';

/** One change, as the frame named it. */
export interface WorkshopTodoStatusDraft {
  /** `current`, or a saved session's id. */
  readonly session: string;
  readonly todoId: string;
  readonly status: WorkshopTodoStatusSettable;
  readonly note?: string;
}

export type WorkshopReplyTodoStatusRejection =
  | WorkshopReplyTrailerStructureRejection
  | `malformed:${WorkshopTodoStatusFault}`
  | 'duplicate'
  | 'over-cap';

export interface WorkshopReplyTodoStatusControl {
  /** The changes kept, in the order written, within both bounds. */
  readonly changes: readonly WorkshopTodoStatusDraft[];
  /** One reason per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyTodoStatusRejection[];
}

export interface WorkshopReplyTodoStatusOptions {
  /** Every id that names the open room (its session id, and a named session it is saved as). */
  readonly openRoomIds?: readonly string[];
}

/** An id as a frame may write one: printable, no space, within the bound. */
const ID = /^[A-Za-z0-9._:-]+$/;
/** A line break or any other control character: a note is one line. */
const NOT_ONE_LINE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

const isId = (value: string): boolean => value.length >= 1 && value.length <= WORKSHOP_TODO_STATUS_ID_CHARACTERS && ID.test(value);

export type WorkshopTodoStatusDecode =
  | { readonly kind: 'change'; readonly change: WorkshopTodoStatusDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopTodoStatusFault };

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopTodoStatus(inner: string, options: WorkshopReplyTodoStatusOptions = {}): WorkshopTodoStatusDecode {
  const read = readWorkshopTrailerElements(inner, { elements: WORKSHOP_TODO_STATUS_ELEMENTS });
  if (read.kind === 'fault') {
    return reject(read.fault);
  }
  const seen = new Set<string>();
  for (const { name } of read.elements) {
    if (seen.has(name)) {
      return reject('repeated-element');
    }
    seen.add(name);
  }
  const field = (name: string): string | undefined => read.elements.find((element) => element.name === name)?.content.trim();
  const written = field('session');
  if (!written) {
    return reject('missing-session');
  }
  const session = written.toLowerCase() === WORKSHOP_TODO_STATUS_CURRENT_SESSION || options.openRoomIds?.includes(written)
    ? WORKSHOP_TODO_STATUS_CURRENT_SESSION
    : written;
  if (!isId(session)) {
    return reject('invalid-session');
  }
  const todoId = field('todo');
  if (!todoId) {
    return reject('missing-todo');
  }
  if (!isId(todoId)) {
    return reject('invalid-todo');
  }
  const status = field('status')?.toLowerCase();
  if (!status) {
    return reject('missing-status');
  }
  if (!isWorkshopTodoStatusSettable(status)) {
    return reject('unknown-status');
  }
  const note = field('note');
  if (note && (note.length > PROMPT_BUDGETS.workshopTodoStatus.noteCharacters || NOT_ONE_LINE.test(note))) {
    return reject('invalid-note');
  }
  return { kind: 'change', change: { session, todoId, status, ...(note ? { note } : {}) } };
}

export function judgeWorkshopReplyTodoStatus(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>,
  options: WorkshopReplyTodoStatusOptions = {}
): WorkshopReplyTodoStatusControl {
  const changes: WorkshopTodoStatusDraft[] = [];
  const rejections: WorkshopReplyTodoStatusRejection[] = [];
  const keys = new Set<string>();
  const savedSessions = new Set<string>();
  const bounds = PROMPT_BUDGETS.workshopTodoStatus;
  for (const { frame, atTail } of frames) {
    const structural = workshopReplyTrailerStructureRejection(frame, atTail);
    if (structural) {
      rejections.push(structural);
      continue;
    }
    const decoded = decodeWorkshopTodoStatus(frame.inner ?? '', options);
    if (decoded.kind === 'rejected') {
      rejections.push(`malformed:${decoded.fault}`);
      continue;
    }
    const { change } = decoded;
    const key = `${change.session}\u0000${change.todoId}`;
    const saved = change.session !== WORKSHOP_TODO_STATUS_CURRENT_SESSION;
    if (keys.has(key)) {
      rejections.push('duplicate');
    } else if (changes.length >= bounds.changesPerReply
      || (saved && !savedSessions.has(change.session) && savedSessions.size >= bounds.savedSessionsPerReply)) {
      rejections.push('over-cap');
    } else {
      keys.add(key);
      if (saved) {
        savedSessions.add(change.session);
      }
      changes.push(change);
    }
  }
  return { changes, rejections };
}

function reject(fault: WorkshopTodoStatusFault): Extract<WorkshopTodoStatusDecode, { kind: 'rejected' }> {
  return { kind: 'rejected', fault };
}
