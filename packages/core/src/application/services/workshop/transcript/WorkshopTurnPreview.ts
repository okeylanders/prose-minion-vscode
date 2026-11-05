/**
 * One turn as the read-only preview shows it (ADR 2026-11-03 D6): a turn
 * outside the snapshot's window, opened from a bookmark, a to-do's source or
 * a read-in card.
 *
 * It reads the turn only through `projectWorkshopTranscriptTurn`, the rule
 * export and recall use, and copies only the fields named here. So no
 * host-private body (attachment text, widget payloads, capability evidence,
 * context details) can reach the webview, and a new transcript field stays
 * out until it is named here on purpose.
 */

import type { WorkshopTurn, WorkshopTurnPreview } from '@messages';
import { projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';

/** What the thread calls the writer; the transcript's export label is for a shared page. */
const WRITER_SPEAKER = 'You';
/** What a one-line notice is attributed to. */
const EVENT_SPEAKER = 'Session';

/** The preview of `turn`, or undefined when the transcript omits it (a context change). */
export function workshopTurnPreview(turn: WorkshopTurn): WorkshopTurnPreview | undefined {
  const entry = projectWorkshopTranscriptTurn(turn);
  if (!entry) {
    return undefined;
  }
  switch (entry.kind) {
    case 'writer':
      return {
        kind: 'writer',
        speaker: WRITER_SPEAKER,
        content: entry.content,
        timestamp: entry.timestamp,
        ...(entry.privateWith ? { privateWith: entry.privateWith } : {})
      };
    case 'reply':
      return {
        kind: 'reply',
        speaker: entry.speaker,
        content: entry.content,
        timestamp: entry.timestamp,
        ...(entry.privateWith ? { privateWith: entry.privateWith } : {}),
        ...(entry.truncated ? { truncated: true as const } : {})
      };
    case 'event':
      return {
        kind: 'event',
        speaker: EVENT_SPEAKER,
        content: entry.text,
        timestamp: entry.timestamp
      };
    default: {
      const unreachable: never = entry;
      return unreachable;
    }
  }
}
