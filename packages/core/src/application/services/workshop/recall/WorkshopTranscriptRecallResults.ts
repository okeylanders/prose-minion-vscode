/**
 * What session recall returns (ADR 2026-10-05 §4): plain data for any
 * consumer — the persona capability's renderer today, a writer-facing panel
 * or a memory feature later. Nothing here is prose.
 */

import type { WorkshopPersonaId, WorkshopSessionScope } from '@messages';
import type {
  WorkshopRecallEntry,
  WorkshopRecallHeader
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type {
  WorkshopRecallQuery,
  WorkshopRecallSearchOutcome
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';

export type WorkshopRecallUnavailableReason =
  | 'no-workspace'
  | 'multi-root'
  | 'workspace-changed'
  | 'not-ready';

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
      /** Newest first, at most `catalogSessions`. */
      readonly sessions: readonly WorkshopRecallCatalogSession[];
      /** Recallable sessions matching the filter, shown or not. */
      readonly matchingSessions: number;
      /** The store's directory listing stopped at its own file bound. */
      readonly listingTruncated: boolean;
    };

export interface WorkshopRecallSearchBounds {
  /** Recallable sessions the filters admitted. */
  readonly corpusSessions: number;
  readonly sessionsSearched: number;
  readonly notSearchedBySessionLimit: number;
  readonly notSearchedByByteBudget: number;
  readonly unreadableSessions: number;
  readonly listingTruncated: boolean;
  /** Source bytes parsed by this call; cached documents cost nothing. */
  readonly parsedBytes: number;
  readonly cacheHits: number;
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
