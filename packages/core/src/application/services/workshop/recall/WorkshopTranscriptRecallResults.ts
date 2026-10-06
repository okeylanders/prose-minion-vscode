/**
 * What session recall returns (ADR 2026-10-05 §4): plain data for any
 * consumer — the persona capability's renderer today, a writer-facing panel
 * or a memory feature later. Nothing here is prose.
 */

import type {
  WorkshopPersonaId,
  WorkshopSessionScope,
  WorkshopTodoStatus,
  WorkshopToolId
} from '@messages';
import type {
  WorkshopRecallEntry,
  WorkshopRecallHeader,
  WorkshopRecallTodo
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type {
  WorkshopRecallMatchMode,
  WorkshopRecallQuery,
  WorkshopRecallSearchOutcome
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';

/**
 * Why recall read nothing it could return. `not-ready` means the live room
 * has no settled identity yet (still hydrating), or it changed identity
 * while a call ran; `workspace-changed` holds until the host reloads.
 */
export type WorkshopRecallUnavailableReason =
  | 'no-workspace'
  | 'multi-root'
  | 'workspace-changed'
  | 'not-ready';

/**
 * How much of each turn a read shows (D10). `discussion` collapses each tool
 * report to one line and keeps everything else whole; `full` shows it all.
 */
export const WORKSHOP_RECALL_READ_DETAILS = ['full', 'discussion'] as const;
export type WorkshopRecallReadDetail = (typeof WORKSHOP_RECALL_READ_DETAILS)[number];

/** Inclusive, 1-based ledger positions. */
export interface WorkshopRecallTurnRange {
  readonly from: number;
  readonly to: number;
}

export interface WorkshopRecallUnavailable {
  readonly available: false;
  readonly reason: WorkshopRecallUnavailableReason;
}

/** A session id outside the corpus. Ids are checked against the listing, never resolved as paths. */
export interface WorkshopRecallUnknownSession {
  readonly available: true;
  readonly outcome: 'unknown-session';
  readonly sessionId: string;
  /** The id names the live room, which recall never reads. */
  readonly liveSession: boolean;
}

export interface WorkshopRecallCatalogSession {
  readonly sessionId: string;
  readonly title: string;
  /** `savedAt`, else the last activity. */
  readonly savedAt: string;
  readonly timezone: string;
  readonly hostPersonaId: WorkshopPersonaId;
  readonly host: string;
  readonly participantPersonaIds: readonly WorkshopPersonaId[];
  readonly participants: readonly string[];
  readonly scope?: WorkshopSessionScope;
  readonly excerptLabel?: string;
  /** The last position "turn N" can name. */
  readonly lastTurn: number;
}

export type WorkshopRecallCatalogResult =
  | WorkshopRecallUnavailable
  | {
      readonly available: true;
      readonly outcome: 'catalog';
      readonly personaId?: WorkshopPersonaId;
      /** `<match>` on title and excerpt label (D8), and how sessions matched. */
      readonly match?: WorkshopRecallSessionMatchResult;
      /** Newest first, at most `catalogSessions`. */
      readonly sessions: readonly WorkshopRecallCatalogSession[];
      /** Recallable sessions matching every filter, shown or not. */
      readonly matchingSessions: number;
      /** The store's directory listing stopped at its own file bound. */
      readonly listingTruncated: boolean;
    };

/** What reading many sessions cost a call, and what it could not read. */
export interface WorkshopRecallScanBounds {
  readonly unreadableSessions: number;
  readonly listingTruncated: boolean;
  /**
   * Source bytes this call parsed into documents, estimated from each
   * decoded session; cached documents cost nothing.
   */
  readonly parsedBytes: number;
  /**
   * Charged for cold reads that produced no document. A failed read reports
   * no size, so each is charged the most it can have cost. Together with
   * `parsedBytes` it spends `searchSourceBytes`.
   */
  readonly unreadableBytesCharged: number;
  readonly cacheHits: number;
}

export interface WorkshopRecallSearchBounds extends WorkshopRecallScanBounds {
  /** Recallable sessions the filters admitted. */
  readonly corpusSessions: number;
  readonly sessionsSearched: number;
  readonly notSearchedBySessionLimit: number;
  readonly notSearchedByByteBudget: number;
}

export type WorkshopRecallSearchResult =
  | WorkshopRecallUnavailable
  | WorkshopRecallUnknownSession
  | {
      readonly available: true;
      readonly outcome: 'searched';
      /** The query as the persona wrote it. */
      readonly queryText: string;
      readonly query: WorkshopRecallQuery;
      readonly personaId?: WorkshopPersonaId;
      readonly sessionId?: string;
      readonly search: WorkshopRecallSearchOutcome;
      readonly bounds: WorkshopRecallSearchBounds;
    };

/** One requested range, resolved against the document. */
export interface WorkshopRecallReadRange extends WorkshopRecallTurnRange {
  /** Visible entries in the range, in ledger order; positions skip omitted turns. */
  readonly entries: readonly WorkshopRecallEntry[];
  /** First and last turn id of the range's entries, for provenance. */
  readonly firstTurnId?: string;
  readonly lastTurnId?: string;
}

export type WorkshopRecallReadResult =
  | WorkshopRecallUnavailable
  | WorkshopRecallUnknownSession
  | {
      readonly available: true;
      readonly outcome: 'unreadable';
      readonly sessionId: string;
      readonly title: string;
    }
  | {
      readonly available: true;
      readonly outcome: 'read';
      readonly header: WorkshopRecallHeader;
      /** The writer asked for no turns: the window starts at turn 1. */
      readonly fromStart: boolean;
      /** Ascending and non-overlapping. */
      readonly ranges: readonly WorkshopRecallReadRange[];
      readonly cacheHit: boolean;
    };

/** `<status>` (D7). `open` includes stale to-dos, each marked. */
export type WorkshopRecallTodoStatusFilter = WorkshopTodoStatus | 'all';

/** `<source>`: a tool id or a persona id. The two closed lists share no id. */
export type WorkshopRecallTodoSourceId = WorkshopToolId | WorkshopPersonaId;

interface WorkshopRecallTodoFilters {
  /** Defaults to `open`. */
  readonly status?: WorkshopRecallTodoStatusFilter;
  /** Sessions whose title or excerpt label match (D8). */
  readonly match?: string;
  readonly source?: WorkshopRecallTodoSourceId;
  /** Sessions this persona took part in. */
  readonly personaId?: WorkshopPersonaId;
}

/**
 * `transcript.todos` (D6). `<recent>` (the newest N sessions, at most
 * `todoSessions`) and `<session>` are exclusive; with neither, the newest
 * `todoSessions` sessions are scanned.
 */
export type WorkshopRecallTodosRequest = WorkshopRecallTodoFilters & (
  | { readonly recent?: number; readonly sessionId?: undefined }
  | { readonly sessionId: string; readonly recent?: undefined }
);

/** `<match>` as written, its terms, and how sessions matched (`mode` is absent when none did). */
export interface WorkshopRecallSessionMatchResult {
  readonly text: string;
  readonly query: WorkshopRecallQuery;
  readonly mode?: WorkshopRecallMatchMode;
}

export interface WorkshopRecallTodoCounts {
  readonly open: number;
  readonly completed: number;
  readonly dismissed: number;
}

/** One session's to-dos that the filters admitted, in the session's own order. */
export interface WorkshopRecallTodoSession {
  readonly header: WorkshopRecallHeader;
  /** Never empty: a scanned session with nothing to show is left out. */
  readonly todos: readonly WorkshopRecallTodo[];
}

export interface WorkshopRecallTodosBounds extends WorkshopRecallScanBounds {
  /** Recallable sessions the session filters admitted: persona, match, or the one named. */
  readonly corpusSessions: number;
  /** The most sessions this call scans: `recent`, else `todoSessions`. */
  readonly sessionLimit: number;
  readonly sessionsScanned: number;
  /** Older admitted sessions past `sessionLimit`. */
  readonly notScannedBySessionLimit: number;
  readonly notScannedByByteBudget: number;
  /** To-dos the filters admitted past `todoItems`, newest session first. */
  readonly omittedByItemLimit: number;
  /** To-dos in scanned sessions the status filter left out, by their status. */
  readonly notShownByStatus: WorkshopRecallTodoCounts;
  /** To-dos in scanned sessions from another source than `<source>`. */
  readonly notShownBySource: number;
  /**
   * Scanned sessions none of whose to-dos the source and status filters
   * admitted. Counted before `todoItems`, so a session the item limit
   * emptied is not one of them (PR 127 review F-02).
   */
  readonly sessionsWithoutMatchingTodos: number;
}

export type WorkshopRecallTodosResult =
  | WorkshopRecallUnavailable
  | WorkshopRecallUnknownSession
  | {
      readonly available: true;
      readonly outcome: 'todos';
      readonly status: WorkshopRecallTodoStatusFilter;
      readonly recent?: number;
      readonly sessionId?: string;
      readonly match?: WorkshopRecallSessionMatchResult;
      readonly source?: WorkshopRecallTodoSourceId;
      readonly personaId?: WorkshopPersonaId;
      /** Newest first; only sessions with a to-do to show. */
      readonly sessions: readonly WorkshopRecallTodoSession[];
      readonly bounds: WorkshopRecallTodosBounds;
    };
