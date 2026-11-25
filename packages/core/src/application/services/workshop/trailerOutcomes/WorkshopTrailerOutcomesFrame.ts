/**
 * The `<workshop-trailer-outcomes>` frame (ADR 2026-11-17 D14, D15): one
 * host frame in a persona's next user message, saying what became of the
 * memory-note and file-edit trailers in its last reply. Pure.
 *
 * - **Derived from the ledger, with no delivery record.** The frame is
 *   about the participant's *latest* reply. Once it replies again its
 *   latest reply is the new one, so the line is not repeated; a cut that
 *   removes the reply removes the line; a cut that removes the message that
 *   carried it makes the same reply the latest again, so it goes out again.
 * - **Each participant hears only of its own reply:** the host of the
 *   host's, a guest of that guest's.
 * - **Two messages carry it** (Okey, 2026-11-17): the writer's next message
 *   to that participant, and the request that asks the host to synthesize a
 *   tool run. Without the second, the synthesis would become the latest
 *   reply and the earlier reply's outcomes would never be told. Never a
 *   tool sidecar's message or a pressed edit offer's request.
 * - **Owed by the ledger, not the provider conversation** (PR #276 F-01).
 *   When a retained conversation is lost, the reply and its record are
 *   still the room's, so the fresh conversation's first message carries the
 *   line. A participant with no reply in the ledger is told nothing.
 * - **Nothing earlier changes.** The frame rides the new message only.
 * - **Fixed words and counts.** The lines are `workshopTrailerOutcomeLines`',
 *   so the frame holds no title, quote, path, find text or note id.
 */

import type { WorkshopPersonaId, WorkshopTurn } from '@messages';
import type { WorkshopTrailerOutcomes } from '@shared/types/workshopTrailerOutcomes';
import {
  WORKSHOP_TRAILER_OUTCOMES_FRAME_NOTE,
  WORKSHOP_TRAILER_OUTCOMES_FRAME_TAG,
  workshopTrailerOutcomeLines
} from '@shared/constants/workshopTrailerOutcomeWords';

/** Whose next message it is: the room's host, or one guest. */
export type WorkshopTrailerOutcomesReader =
  | { readonly kind: 'host' }
  | { readonly kind: 'personaGuest'; readonly personaId: WorkshopPersonaId };

/** The frame for one record; undefined when it has no line to write. */
export function renderWorkshopTrailerOutcomesFrame(
  outcomes: WorkshopTrailerOutcomes,
  todoRows: WorkshopTurn['todoStatusChanges'] = []
): string | undefined {
  const lines = workshopTrailerOutcomeLines(outcomes, todoRows);
  if (lines.length === 0) {
    return undefined;
  }
  return [
    `<${WORKSHOP_TRAILER_OUTCOMES_FRAME_TAG} note="${WORKSHOP_TRAILER_OUTCOMES_FRAME_NOTE}">`,
    ...lines,
    `</${WORKSHOP_TRAILER_OUTCOMES_FRAME_TAG}>`
  ].join('\n');
}

/** The reader's most recent reply in the ledger, whatever it holds. */
export function workshopLatestReplyOf(
  ledger: readonly WorkshopTurn[],
  reader: WorkshopTrailerOutcomesReader
): WorkshopTurn | undefined {
  for (let index = ledger.length - 1; index >= 0; index -= 1) {
    const turn = ledger[index];
    if (turn.role !== 'assistant') {
      continue;
    }
    if (reader.kind === 'host' ? turn.participant === 'host' : turn.participant === 'guest' && turn.personaId === reader.personaId) {
      return turn;
    }
  }
  return undefined;
}

/**
 * The frame for the reader's next message: its latest reply's outcomes, or
 * nothing when that reply carried no such trailer (or there is no reply).
 */
export function workshopTrailerOutcomesFrameFor(
  ledger: readonly WorkshopTurn[],
  reader: WorkshopTrailerOutcomesReader
): string | undefined {
  const latest = workshopLatestReplyOf(ledger, reader);
  // A saved row's later state is read from the receipt beside the record (ADR 2026-11-19 D7).
  return latest?.trailerOutcomes ? renderWorkshopTrailerOutcomesFrame(latest.trailerOutcomes, latest.todoStatusChanges) : undefined;
}

/**
 * The frames a message carries, as the room handler and the tool side-pass add them: none without
 * a reader (a tool sidecar, a pressed edit offer), and
 * otherwise the reader's frame, if its latest reply left one. The ledger is
 * read only for a reader. Logged without text.
 */
export function workshopTrailerOutcomeFrames(
  reader: WorkshopTrailerOutcomesReader | undefined,
  ledger: () => readonly WorkshopTurn[],
  log: (line: string) => void
): string[] {
  const frame = reader ? workshopTrailerOutcomesFrameFor(ledger(), reader) : undefined;
  if (!frame) {
    return [];
  }
  log('Trailer outcomes added');
  return [frame];
}
