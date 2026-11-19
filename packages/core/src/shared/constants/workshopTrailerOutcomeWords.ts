/**
 * The host's words for what became of a reply's memory-note, file-edit and
 * to-do status trailers (ADR 2026-11-17 D14; ADR 2026-11-19 D7): one fixed phrase per recorded reason, and
 * the one renderer that turns a turn's `trailerOutcomes` into the lines a
 * persona reads with its next message.
 *
 * - **Fixed words only.** A phrase never holds a title, a quote, a path, a
 *   note's id or anything a model wrote. A reason with no phrase does not
 *   compile.
 * - **Counts, then why.** A line names how many frames became cards, how
 *   many file-edit cards were refused (the count only: Q5), and how many
 *   were dropped for each reason.
 * - **It names no one by pronoun** but the persona it addresses, and no
 *   note, file or writer decision.
 */

import type { WorkshopTrailerDropReason, WorkshopTrailerOutcomes } from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopTodoStatusChange, WorkshopTodoStatusWriteRefusal } from '@shared/types/messages/workshop/todoStatus';

/** The frame's tag: reserved, so quoted text cannot forge one (`workshopPromptFrames`). */
export const WORKSHOP_TRAILER_OUTCOMES_FRAME_TAG = 'workshop-trailer-outcomes';

/** The frame's own account of itself: no prompt file teaches it. */
export const WORKSHOP_TRAILER_OUTCOMES_FRAME_NOTE = 'From the host: what became of the trailers in your last reply. Counts only.';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the recorded reasons' kebab-case words. */
export const WORKSHOP_TRAILER_DROP_REASON_WORDS: Readonly<Record<WorkshopTrailerDropReason, string>> = Object.freeze({
  malformed: 'malformed',
  misplaced: 'not at the end of the reply',
  duplicate: 'a repeat of another in the same reply',
  'over-cap': 'past the number one reply may carry',
  off: 'not open in this conversation just then',
  oversized: 'too long',
  'not-staged': 'the host could not prepare it',
  'notes-unreadable': 'the notes could not be read just then',
  'target-not-found': 'no readable note has the id it named',
  'target-not-in-effect': 'the note it named is archived or replaced',
  'target-busy': 'the note it named was being saved',
  'find-not-found': 'its find text is not in the note',
  'find-ambiguous': 'its find text is in the note more than once',
  'edits-conflict': 'its changes overlap or contradict each other',
  'result-invalid': 'the note it would leave breaks the note format',
  'no-change': 'it would change nothing',
  'pinned-budget': 'the note is loaded in full, and the change would pass that budget',
  'session-not-found': 'no saved session has the id it named',
  'session-unreadable': 'the session it named could not be read, or must be opened first',
  'sessions-unavailable': 'saved sessions could not be reached just then',
  'todo-not-found': 'no to-do in that session has the id it named',
  'todo-not-open': 'the to-do it named is not open',
  'nothing-kept': 'no pattern it proposed was safe and found a file',
  'workspace-unavailable': 'the project\'s folders could not be checked just then'
});

/** Why a saved session's change was not written (ADR 2026-11-19 D7): the row's reason, after the record. */
export const WORKSHOP_TODO_STATUS_WRITE_REFUSAL_WORDS: Readonly<Record<WorkshopTodoStatusWriteRefusal, string>> = Object.freeze({
  'session-changed': 'the session changed since it was read',
  'room-changed': 'the reply left the room before it was saved',
  'session-not-found': 'the session is gone',
  'session-busy': 'another window was writing the session',
  'sessions-unavailable': 'saved sessions could not be reached just then',
  'write-failed': 'the session could not be saved',
  'receipt-not-saved': 'this conversation could not be saved first, so the session was left as it was'
});

/** A row left `saving` across a restart, with no stamp in the file (D8a): counted as not written. */
const INTERRUPTED_WORDS = 'Prose Minion closed before it was saved';
/* eslint-enable @typescript-eslint/naming-convention */

const shownAsCards = (count: number): string => `${count} shown as ${count === 1 ? 'a card' : 'cards'}`;
const refusedCards = (count: number): string => `${count} refused before the writer could apply ${count === 1 ? 'it' : 'them'}`;
const droppedFor = (drop: { reason: WorkshopTrailerDropReason; count: number }): string =>
  `${drop.count} dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS[drop.reason]})`;

/**
 * A to-do side's parts (ADR 2026-11-19 D7): what the record counted at
 * commit, with each saved row's later state read from the receipt beside
 * it. A row still `saving` is "being saved"; one `refused` is "not written",
 * by its reason. An Undo is the writer's answer and is never told: an undone
 * row counts as it settled.
 */
function todoParts(changes: number, rows: readonly Pick<WorkshopTodoStatusChange, 'state' | 'reason'>[]): string[] {
  const saving = rows.filter((row) => row.state === 'saving').length;
  // D8b: a row whose target could not be read is not yet confirmed, apart from not written.
  const unconfirmed = rows.filter((row) => row.state === 'unverified').length;
  const refused = new Map<string, number>();
  for (const row of rows) {
    if (row.state === 'refused' || row.state === 'interrupted') {
      const words = row.state === 'interrupted' ? INTERRUPTED_WORDS : WORKSHOP_TODO_STATUS_WRITE_REFUSAL_WORDS[row.reason ?? 'write-failed'];
      refused.set(words, (refused.get(words) ?? 0) + 1);
    }
  }
  const notWritten = [...refused.values()].reduce((sum, count) => sum + count, 0);
  const made = Math.max(0, changes - saving - unconfirmed - notWritten);
  return [
    ...(made > 0 ? [`${made} made`] : []),
    ...(saving > 0 ? [`${saving} being saved`] : []),
    ...(unconfirmed > 0 ? [`${unconfirmed} not yet confirmed (the session could not be read to check)`] : []),
    ...[...refused.entries()].map(([words, count]) => `${count} not written (${words})`)
  ];
}

/**
 * The lines for one reply's outcomes: one per side that has something to
 * say, notes first. Empty when there is nothing to write.
 */
export function workshopTrailerOutcomeLines(
  outcomes: WorkshopTrailerOutcomes,
  todoRows: readonly Pick<WorkshopTodoStatusChange, 'state' | 'reason'>[] = []
): string[] {
  const lines: string[] = [];
  if (outcomes.memory) {
    const parts = [
      ...(outcomes.memory.cards > 0 ? [shownAsCards(outcomes.memory.cards)] : []),
      ...outcomes.memory.dropped.map(droppedFor)
    ];
    if (parts.length > 0) {
      lines.push(`Your last reply's notes: ${parts.join(', ')}.`);
    }
  }
  if (outcomes.fileEdits) {
    const parts = [
      ...(outcomes.fileEdits.cards > 0 ? [shownAsCards(outcomes.fileEdits.cards)] : []),
      ...(outcomes.fileEdits.refused > 0 ? [refusedCards(outcomes.fileEdits.refused)] : []),
      ...outcomes.fileEdits.dropped.map(droppedFor)
    ];
    if (parts.length > 0) {
      lines.push(`Your last reply's file edits: ${parts.join(', ')}.`);
    }
  }
  if (outcomes.locations) {
    const { patterns } = outcomes.locations;
    const parts = [
      ...(outcomes.locations.cards > 0
        ? [`shown as a card for the writer to review, with ${patterns.kept} ${patterns.kept === 1 ? 'pattern' : 'patterns'} kept`
          + `, ${patterns.unmatched} matching no file, ${patterns.incomplete} not checked completely and ${patterns.refused} refused`]
        : []),
      ...outcomes.locations.dropped.map(droppedFor)
    ];
    if (parts.length > 0) {
      lines.push(`Your last reply's context-paths proposal: ${parts.join(', ')}.`);
    }
  }
  if (outcomes.todos) {
    const parts = [...todoParts(outcomes.todos.changes, todoRows), ...outcomes.todos.dropped.map(droppedFor)];
    if (parts.length > 0) {
      lines.push(`Your last reply's to-do changes: ${parts.join(', ')}.`);
    }
  }
  return lines;
}
