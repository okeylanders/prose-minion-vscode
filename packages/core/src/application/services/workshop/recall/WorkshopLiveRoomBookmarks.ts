/**
 * The one way session recall reaches the open room (ADR 2026-11-05 D1, Q1):
 * a read-only port over its bookmarks. Recall still never lists, searches or
 * reads the open room's turns; only `transcript.bookmarks` takes this port.
 *
 * - The host implements it (WorkshopLiveRoomBookmarkReader) over the live
 *   bookmark ledger and the full room ledger, never the snapshot window, so
 *   a bookmark on a turn outside the window reads whole (PR #214 F-03).
 * - It returns only the bookmarks on turns the reader could see, by the
 *   room's own audience rule (WorkshopRoomAudience). With no reader, only
 *   turns the whole room sees.
 * - Each row says whether the whole room could see its turn: what decides
 *   whether a result may be published (D7, PR #214 F-05).
 * - Reading never writes, flushes, or changes what any persona is sent.
 */

import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';

export interface WorkshopLiveRoomBookmarkRow extends WorkshopRecallBookmark {
  /** Whether every participant in the room could see the bookmarked turn. */
  readonly roomVisible: boolean;
}

export interface WorkshopLiveRoomBookmarkRead {
  /** The open room's own IANA timezone: what its dates are days in. */
  readonly timezone: string;
  /** The room's ledger length: the last position "turn N" can name. */
  readonly turnCount: number;
  /** Thread order; only what the reader could see. */
  readonly bookmarks: readonly WorkshopLiveRoomBookmarkRow[];
}

export interface WorkshopLiveRoomBookmarks {
  readLiveRoomBookmarks(reader: WorkshopCapabilityPrincipal | undefined): WorkshopLiveRoomBookmarkRead;
}
