/**
 * The host's words for what became of a reply's memory-note and file-edit
 * trailers (ADR 2026-11-17 D14): one fixed phrase per recorded reason, and
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
  'pinned-budget': 'the note is loaded in full, and the change would pass that budget'
});
/* eslint-enable @typescript-eslint/naming-convention */

const shownAsCards = (count: number): string => `${count} shown as ${count === 1 ? 'a card' : 'cards'}`;
const refusedCards = (count: number): string => `${count} refused before the writer could apply ${count === 1 ? 'it' : 'them'}`;
const droppedFor = (drop: { reason: WorkshopTrailerDropReason; count: number }): string =>
  `${drop.count} dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS[drop.reason]})`;

/**
 * The lines for one reply's outcomes: one per side that has something to
 * say, notes first. Empty when there is nothing to write.
 */
export function workshopTrailerOutcomeLines(outcomes: WorkshopTrailerOutcomes): string[] {
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
  return lines;
}
