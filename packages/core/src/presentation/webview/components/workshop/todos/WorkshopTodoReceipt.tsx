/**
 * A persona reply's to-do receipt (ADR 2026-11-19 D8), rendered by
 * `WorkshopTurnBubble` under the reply beside its other cards: one row per
 * change, naming the to-do, its session and the new status, with Undo.
 *
 * - A saved session's row still being written says so, and offers no Undo
 *   until it lands; one refused says why. A saved row made in another room
 *   (a branch's copy) says Undo is in the room that made it.
 * - Undo posts ids only, through the controls; the host's refusal words
 *   stay beside the row.
 */

import * as React from 'react';
import type { WorkshopTodoStatusChange, WorkshopTurn } from '@messages';
import { Icon } from '@components/shared/Icon';
import {
  WORKSHOP_TODO_STATUS_INTERRUPTED_WORDS,
  WORKSHOP_TODO_STATUS_ROW_REFUSAL_WORDS,
  WORKSHOP_TODO_STATUS_UNDO_REFUSAL_WORDS,
  WORKSHOP_TODO_STATUS_UNVERIFIED_WORDS,
  workshopTodoReceiptHeading,
  workshopTodoStatusWord
} from '@shared/constants/workshopTodoStatusWords';
import { workshopTodoReceiptKey } from '@hooks/domain/workshop/useWorkshopTodoReceipt';

export interface WorkshopTodoReceiptControls {
  undoing: ReadonlySet<string>;
  feedback: ReadonlyMap<string, string>;
  /** True while the room's mutation lock is held. */
  locked: boolean;
  onUndo: (turnId: string, index: number) => void;
}

/** What a row says beside its status, and whether it offers Undo. */
export function workshopTodoReceiptRowState(row: WorkshopTodoStatusChange): { note?: string; undo: boolean } {
  switch (row.state) {
    case 'applied':
      return row.elsewhere ? { note: WORKSHOP_TODO_STATUS_UNDO_REFUSAL_WORDS.elsewhere, undo: false } : { undo: true };
    case 'saving':
      return { note: 'Saving…', undo: false };
    case 'refused':
      return { note: WORKSHOP_TODO_STATUS_ROW_REFUSAL_WORDS[row.reason ?? 'write-failed'], undo: false };
    case 'interrupted':
      return { note: WORKSHOP_TODO_STATUS_INTERRUPTED_WORDS, undo: false };
    case 'unverified':
      return { note: WORKSHOP_TODO_STATUS_UNVERIFIED_WORDS, undo: false };
    case 'undone':
      return { note: 'Undone', undo: false };
    default:
      return { undo: false };
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopTodoReceipt: React.FC<{ turn: WorkshopTurn; controls: WorkshopTodoReceiptControls }> = ({ turn, controls }) => {
  const rows = turn.todoStatusChanges ?? [];
  if (rows.length === 0) {
    return null;
  }
  const heading = workshopTodoReceiptHeading(rows);
  return (
    <div className="pm-ws-todo-receipt" role="group" aria-label={heading}>
      <div className="pm-ws-todo-receipt-head" aria-hidden="true">
        <Icon name="check" size={12} /> {heading}
      </div>
      <ul className="pm-ws-todo-receipt-rows">
        {rows.map((row, index) => {
          const key = workshopTodoReceiptKey(turn.id, index);
          const state = workshopTodoReceiptRowState(row);
          const busy = controls.undoing.has(key);
          const feedback = controls.feedback.get(key);
          const session = row.session === 'current' ? 'this session' : row.sessionTitle || 'a saved session';
          return (
            <li key={key} className={`pm-ws-todo-receipt-row pm-ws-todo-receipt-${row.state}`} aria-busy={busy || undefined}>
              <span className="pm-ws-todo-receipt-status">{workshopTodoStatusWord(row.status)}</span>
              <span className="pm-ws-todo-receipt-text">{row.todoText}</span>
              <span className="pm-ws-todo-receipt-session">in {session}</span>
              {row.note && <span className="pm-ws-todo-receipt-note">{row.note}</span>}
              {state.note && <span className="pm-ws-todo-receipt-state">{state.note}</span>}
              {state.undo && (
                <button
                  type="button"
                  className="pm-ws-todo-receipt-undo"
                  disabled={busy || controls.locked}
                  aria-label={`Undo: reopen "${row.todoText}"`}
                  onClick={() => controls.onUndo(turn.id, index)}
                >
                  <Icon name="repeat" size={11} /> {busy ? 'Undoing…' : 'Undo'}
                </button>
              )}
              {feedback && <span className="pm-ws-todo-receipt-feedback" role="status">{feedback}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
