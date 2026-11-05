/**
 * What `transcript.bookmarks` returns (ADR 2026-11-05 D2, D7): plain data
 * for the renderer, and later for the writer's Bookmarks screen. Nothing
 * here is prose.
 */

import type { WorkshopPersonaId } from '@messages';
import type {
  WorkshopCapabilityPrincipal,
  WorkshopRecallBookmarkRef,
  WorkshopRecallBookmarkScope,
  WorkshopRecallBookmarkSpeakerId
} from '@shared/types/workshopCapabilities';
import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallHeader } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type {
  WorkshopRecallScanBounds,
  WorkshopRecallSessionMatchResult,
  WorkshopRecallUnavailable,
  WorkshopRecallUnknownSession
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The filters that pick bookmarks, in every scope; dates are `YYYY-MM-DD` days in the holding session's zone. */
export interface WorkshopRecallBookmarkFilters {
  /** Every word, at the start of a word of the label or the message. */
  readonly query?: string;
  readonly speaker?: WorkshopRecallBookmarkSpeakerId;
  readonly since?: string;
  /** Inclusive: the whole day. */
  readonly until?: string;
}

/** A list: where bookmarks come from, and which. `<recent>` and `<session>` are exclusive. */
export type WorkshopRecallBookmarkListRequest = WorkshopRecallBookmarkFilters & {
  readonly bookmark?: undefined;
  /** Defaults to `all`: the open room first, then saved sessions. */
  readonly scope?: WorkshopRecallBookmarkScope;
  /** Saved sessions whose title or excerpt label match (D8 of 2026-10-06). */
  readonly match?: string;
  /** Saved sessions this persona took part in. */
  readonly personaId?: WorkshopPersonaId;
} & (
  | { readonly recent?: number; readonly sessionIds?: undefined }
  | { readonly sessionIds: readonly string[]; readonly recent?: undefined }
);

/** One bookmark's message, from a character offset. */
export interface WorkshopRecallBookmarkReadRequest {
  readonly bookmark: WorkshopRecallBookmarkRef;
  readonly from?: number;
}

/**
 * `transcript.bookmarks`. `reader` is who asks: the open room's rows are
 * the bookmarks on turns it could see. Absent, only turns the whole room
 * sees qualify.
 */
export type WorkshopRecallBookmarksRequest =
  (WorkshopRecallBookmarkListRequest | WorkshopRecallBookmarkReadRequest) & {
    readonly reader?: WorkshopCapabilityPrincipal;
  };

/** Where a group of bookmarks lives. */
export type WorkshopRecallBookmarkSource =
  | {
      readonly kind: 'current';
      readonly liveSessionId: string;
      /** The open room's own IANA timezone. */
      readonly timezone: string;
      readonly turnCount: number;
    }
  | { readonly kind: 'saved'; readonly header: WorkshopRecallHeader };

/** One bookmark a result holds, with the ref `<bookmark>` takes. */
export interface WorkshopRecallListedBookmark extends WorkshopRecallBookmark {
  readonly ref: WorkshopRecallBookmarkRef;
}

export interface WorkshopRecallBookmarkGroup {
  readonly source: WorkshopRecallBookmarkSource;
  /** Thread order; never empty. */
  readonly bookmarks: readonly WorkshopRecallListedBookmark[];
}

/**
 * Why the host stamped a result unpublishable (D7): an open-room row
 * stands on a turn the whole room could not see. The ids say which, for the
 * log; the result stays with the persona that asked.
 */
export interface WorkshopRecallBookmarksWithheld {
  readonly reason: 'open-room-private-turn';
  readonly bookmarkIds: readonly string[];
}

/** Whether the open room was read for this call. */
export type WorkshopRecallOpenRoomRead = 'read' | 'not-asked' | 'unavailable';

export interface WorkshopRecallBookmarksBounds extends WorkshopRecallScanBounds {
  readonly openRoom: WorkshopRecallOpenRoomRead;
  /** Saved sessions `<session>`, `<persona>` and `<match>` admitted. */
  readonly corpusSessions: number;
  /** The most saved sessions this call reads: `recent`, else `bookmarkSessions`. */
  readonly sessionLimit: number;
  readonly sessionsScanned: number;
  readonly notScannedBySessionLimit: number;
  readonly notScannedByByteBudget: number;
  /** Bookmarks in the sources read, before any filter. */
  readonly bookmarksSeen: number;
  /** Bookmarks the filters left out. */
  readonly notShownByFilters: number;
  /** Bookmarks the filters admitted past `bookmarkItems`. */
  readonly omittedByItemLimit: number;
}

export type WorkshopRecallBookmarksResult =
  | WorkshopRecallUnavailable
  | WorkshopRecallUnknownSession
  | {
      readonly available: true;
      readonly outcome: 'bookmarks';
      readonly scope: WorkshopRecallBookmarkScope;
      readonly filters: WorkshopRecallBookmarkFilters;
      readonly recent?: number;
      readonly sessionIds?: readonly string[];
      readonly match?: WorkshopRecallSessionMatchResult;
      readonly personaId?: WorkshopPersonaId;
      /** The open room first, then saved sessions newest first. */
      readonly groups: readonly WorkshopRecallBookmarkGroup[];
      readonly bounds: WorkshopRecallBookmarksBounds;
      readonly withheld?: WorkshopRecallBookmarksWithheld;
    }
  | {
      readonly available: true;
      readonly outcome: 'bookmark';
      readonly source: WorkshopRecallBookmarkSource;
      readonly bookmark: WorkshopRecallListedBookmark;
      /** Where this window starts in the message. */
      readonly from: number;
      readonly withheld?: WorkshopRecallBookmarksWithheld;
    }
  /**
   * The ref's source is not one recall may read now: an open room that has
   * been replaced, a saved session that is now the open room, or no saved
   * session at all. Never retargeted.
   */
  | {
      readonly available: true;
      readonly outcome: 'stale-bookmark-ref';
      readonly ref: WorkshopRecallBookmarkRef;
      readonly why: 'room-replaced' | 'now-open' | 'no-session';
    }
  /** The source holds no such bookmark, or none on a turn the reader could see. */
  | { readonly available: true; readonly outcome: 'unknown-bookmark'; readonly ref: WorkshopRecallBookmarkRef }
  /** A saved source that could not be read now. */
  | { readonly available: true; readonly outcome: 'unreadable-session'; readonly ref: WorkshopRecallBookmarkRef };
