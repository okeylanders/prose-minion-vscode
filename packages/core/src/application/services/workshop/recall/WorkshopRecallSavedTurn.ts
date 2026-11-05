/**
 * One saved turn for the Bookmarks screen's preview (ADR 2026-11-05 D8):
 * read from the saved session's recall document, never from the live
 * ledger, and given as the transcript projects it (the entry recall's reads
 * and export use), so no host-private body is ever in reach.
 *
 * The session is read by id through the store's exact read, not looked up
 * in the 200-file listing, because the screen reaches sessions page by page
 * past it. An id is only ever matched, never resolved as a path. The open
 * room is refused: its turns preview through the room's own route.
 */

import type { WorkshopTranscriptEntry } from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopRecallLoadedDocument } from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';

export type WorkshopRecallSavedTurn =
  | {
      readonly kind: 'turn';
      readonly sessionId: string;
      readonly title: string;
      readonly turnId: string;
      /** The turn's 1-based ledger position in that session. */
      readonly position: number;
      readonly entry: WorkshopTranscriptEntry;
      /** The original turn is one a bookmark may mark: what "Remember this" checks, never the entry's kind (PR #219 F-01). */
      readonly bookmarkable: boolean;
    }
  /** `ambiguous-session`: more than one file claims the id, so the store refused to choose (PR #216 F-04). */
  | { readonly kind: 'live-session' | 'unknown-session' | 'ambiguous-session' | 'unreadable' | 'unknown-turn' };

/**
 * `turnId` of `sessionId`, read by `read` (the loader's cold read). A
 * session the store does not find is unknown; one it cannot read is
 * unreadable; a turn the projection omits is unknown too, since it has
 * nothing to show.
 */
export async function workshopRecallSavedTurn(
  sessionId: string,
  turnId: string,
  liveSessionId: string,
  read: (sessionId: string) => Promise<WorkshopRecallLoadedDocument>
): Promise<WorkshopRecallSavedTurn> {
  if (sessionId === liveSessionId) {
    return { kind: 'live-session' };
  }
  const loaded = await read(sessionId);
  if (!loaded.document) {
    return {
      kind: loaded.reason === 'missing' ? 'unknown-session' : loaded.reason === 'conflict' ? 'ambiguous-session' : 'unreadable'
    };
  }
  const found = loaded.document.entries.find((entry) => entry.turnId === turnId);
  if (!found) {
    return { kind: 'unknown-turn' };
  }
  return {
    kind: 'turn',
    sessionId,
    title: loaded.document.header.title,
    turnId,
    position: found.position,
    entry: found.entry,
    bookmarkable: found.bookmarkable
  };
}
