/**
 * `transcript.bookmarks` over one opened corpus (ADR 2026-11-05 D1, D2,
 * D7): the service opens the scope and hands over its listing and reads;
 * this module decides what the call shows.
 *
 * - **Sources.** `<scope>` picks the open room, saved sessions, or both,
 *   the open room first. The open room comes only through its read-only
 *   port, filtered there by what the reader could see; saved sessions come
 *   from the listing (no file read to choose them) and the shared reads.
 * - **Order of work,** as `transcript.todos` does it: choose sessions, cap
 *   them at `<recent>` (else `bookmarkSessions`), read them within
 *   `searchSourceBytes`, then filter the bookmarks and bound them at
 *   `bookmarkItems`.
 * - **One bookmark** by its qualified ref, its source checked: an open-room
 *   ref names the room open now or is stale; a saved ref names a saved
 *   session that is not the open room, or is stale. Never retargeted.
 * - **Publication.** A result holding an open-room row the whole room
 *   could not see is stamped withheld, with the reason and the bookmark
 *   ids; it never filters rows to make itself publishable.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopRecallBookmarkRef } from '@shared/types/workshopCapabilities';
import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallLoadedDocuments } from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
import type {
  WorkshopLiveRoomBookmarkRow,
  WorkshopLiveRoomBookmarks
} from '@/application/services/workshop/recall/WorkshopLiveRoomBookmarks';
import {
  bookmarkCandidates,
  selectWorkshopRecallBookmarks,
  WorkshopRecallBookmarkPool
} from '@/application/services/workshop/recall/WorkshopRecallCorpusSelection';
import type {
  WorkshopRecallBookmarkListRequest,
  WorkshopRecallBookmarkReadRequest,
  WorkshopRecallBookmarkSource,
  WorkshopRecallBookmarksResult,
  WorkshopRecallBookmarksWithheld,
  WorkshopRecallListedBookmark,
  WorkshopRecallOpenRoomRead
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** What the service hands over: one opened scope's listing, reads, and the open room. */
export interface WorkshopRecallBookmarkCorpus {
  readonly liveSessionId: string;
  /** Recallable saved sessions, newest first, the open room excluded. */
  readonly sessions: readonly WorkshopRecallSessionSummary[];
  readonly listingTruncated: boolean;
  /** The shared cold reads, within `searchSourceBytes`, under the opened scope. */
  load(sessions: readonly WorkshopRecallSessionSummary[]): Promise<WorkshopRecallLoadedDocuments>;
  /** Absent where the host wired no open room. */
  readonly liveRoom?: WorkshopLiveRoomBookmarks;
  readonly reader?: WorkshopCapabilityPrincipal;
}

type Listed = Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmarks' }>;

const EMPTY_COST = { parsedBytes: 0, unreadableSessions: 0, unreadableBytesCharged: 0, cacheHits: 0 } as const;

export async function listWorkshopRecallBookmarks(
  corpus: WorkshopRecallBookmarkCorpus,
  request: WorkshopRecallBookmarkListRequest
): Promise<WorkshopRecallBookmarksResult> {
  const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
  const scope = request.scope ?? 'all';
  const savedAsked = scope !== 'current';
  const chosen = savedAsked
    ? bookmarkCandidates(corpus.sessions, request, corpus.liveSessionId, budgets.bookmarkSessions)
    : { candidates: [], scanned: [], sessionLimit: budgets.bookmarkSessions };
  if ('unknown' in chosen) {
    return chosen.unknown;
  }
  const pools: Array<WorkshopRecallBookmarkPool<WorkshopRecallBookmark & { roomVisible?: boolean }, WorkshopRecallBookmarkSource>> = [];
  let openRoom: WorkshopRecallOpenRoomRead = 'not-asked';
  if (scope !== 'saved') {
    const live = corpus.liveRoom?.readLiveRoomBookmarks(corpus.reader);
    openRoom = live ? 'read' : 'unavailable';
    if (live) {
      pools.push({ source: currentSource(corpus.liveSessionId, live), timezone: live.timezone, bookmarks: live.bookmarks });
    }
  }
  const loaded = chosen.scanned.length > 0 ? await corpus.load(chosen.scanned) : undefined;
  for (const document of loaded?.documents ?? []) {
    pools.push({ source: { kind: 'saved', header: document.header }, timezone: document.header.timezone, bookmarks: document.bookmarks });
  }
  const selected = selectWorkshopRecallBookmarks(pools, request, budgets.bookmarkItems);
  const groups = selected.groups.map(({ source, bookmarks }) => ({ source, bookmarks: bookmarks.map((bookmark) => listed(source, bookmark)) }));
  const withheld = withheldFor(selected.groups.flatMap(({ bookmarks }) => bookmarks));
  const result: Listed = {
    available: true,
    outcome: 'bookmarks',
    scope,
    filters: {
      ...(request.query !== undefined ? { query: request.query } : {}),
      ...(request.speaker !== undefined ? { speaker: request.speaker } : {}),
      ...(request.since !== undefined ? { since: request.since } : {}),
      ...(request.until !== undefined ? { until: request.until } : {})
    },
    ...(request.recent !== undefined ? { recent: request.recent } : {}),
    ...(request.sessionIds !== undefined ? { sessionIds: request.sessionIds } : {}),
    ...(chosen.match ? { match: chosen.match } : {}),
    ...(request.personaId ? { personaId: request.personaId } : {}),
    groups,
    bounds: {
      openRoom,
      corpusSessions: chosen.candidates.length,
      sessionLimit: chosen.sessionLimit,
      sessionsScanned: loaded?.documents.length ?? 0,
      notScannedBySessionLimit: chosen.candidates.length - chosen.scanned.length,
      notScannedByByteBudget: loaded?.notReadByByteBudget ?? 0,
      listingTruncated: savedAsked && corpus.listingTruncated,
      bookmarksSeen: selected.seen,
      notShownByFilters: selected.notShownByFilters,
      omittedByItemLimit: selected.omittedByItemLimit,
      ...(loaded?.cost ?? EMPTY_COST)
    },
    ...(withheld ? { withheld } : {})
  };
  return result;
}

export async function readWorkshopRecallBookmark(
  corpus: WorkshopRecallBookmarkCorpus,
  request: WorkshopRecallBookmarkReadRequest
): Promise<WorkshopRecallBookmarksResult> {
  const ref = request.bookmark;
  const from = request.from ?? 0;
  if (ref.source === 'current') {
    if (ref.liveSessionId !== corpus.liveSessionId) {
      return { available: true, outcome: 'stale-bookmark-ref', ref, why: 'room-replaced' };
    }
    const live = corpus.liveRoom?.readLiveRoomBookmarks(corpus.reader);
    const row = live?.bookmarks.find((bookmark) => bookmark.id === ref.bookmarkId);
    if (!live || !row) {
      return { available: true, outcome: 'unknown-bookmark', ref };
    }
    const source = currentSource(corpus.liveSessionId, live);
    const withheld = withheldFor([row]);
    return { available: true, outcome: 'bookmark', source, bookmark: listed(source, row), from, ...(withheld ? { withheld } : {}) };
  }
  if (ref.sessionId === corpus.liveSessionId) {
    return { available: true, outcome: 'stale-bookmark-ref', ref, why: 'now-open' };
  }
  const summary = corpus.sessions.find((session) => session.sessionId === ref.sessionId);
  if (!summary) {
    return { available: true, outcome: 'stale-bookmark-ref', ref, why: 'no-session' };
  }
  const document = (await corpus.load([summary])).documents[0];
  if (!document) {
    return { available: true, outcome: 'unreadable-session', ref };
  }
  const bookmark = document.bookmarks.find((candidate) => candidate.id === ref.bookmarkId);
  if (!bookmark) {
    return { available: true, outcome: 'unknown-bookmark', ref };
  }
  const source: WorkshopRecallBookmarkSource = { kind: 'saved', header: document.header };
  return { available: true, outcome: 'bookmark', source, bookmark: listed(source, bookmark), from };
}

/** Counts and ids only, never a label or a message. */
export function workshopRecallBookmarksLogLine(result: WorkshopRecallBookmarksResult): string {
  if (!result.available) {
    return `bookmarks unavailable=${result.reason}`;
  }
  switch (result.outcome) {
    case 'bookmarks': {
      const { bounds } = result;
      return `bookmarks scope=${result.scope} openRoom=${bounds.openRoom} ` +
        `sessions=${bounds.sessionsScanned}/${bounds.corpusSessions} ` +
        `notScanned=${bounds.notScannedBySessionLimit}+${bounds.notScannedByByteBudget} ` +
        `unreadable=${bounds.unreadableSessions} parsedBytes=${bounds.parsedBytes} cacheHits=${bounds.cacheHits} ` +
        `seen=${bounds.bookmarksSeen} filtered=${bounds.notShownByFilters} omitted=${bounds.omittedByItemLimit} ` +
        `shown=${result.groups.reduce((sum, group) => sum + group.bookmarks.length, 0)}` +
        withheldWords(result.withheld);
    }
    case 'bookmark':
      return `bookmark source=${result.source.kind} id=${result.bookmark.id} from=${result.from}${withheldWords(result.withheld)}`;
    case 'stale-bookmark-ref':
      return `bookmark refused=stale-bookmark-ref why=${result.why} id=${result.ref.bookmarkId}`;
    case 'unknown-bookmark':
    case 'unreadable-session':
      return `bookmark outcome=${result.outcome} id=${result.ref.bookmarkId}`;
    case 'unknown-session':
      return `bookmarks outcome=unknown-session liveSession=${result.liveSession}`;
    default:
      return assertNever(result);
  }
}

function withheldWords(withheld: WorkshopRecallBookmarksWithheld | undefined): string {
  return withheld ? ` withheld=${withheld.reason} bookmarks=${withheld.bookmarkIds.join(',')}` : '';
}

function currentSource(
  liveSessionId: string,
  live: { readonly timezone: string; readonly turnCount: number }
): WorkshopRecallBookmarkSource {
  return { kind: 'current', liveSessionId, timezone: live.timezone, turnCount: live.turnCount };
}

/** A row as results hold it: the ref beside it, and nothing about who may see it. */
function listed(
  source: WorkshopRecallBookmarkSource,
  bookmark: WorkshopRecallBookmark | WorkshopLiveRoomBookmarkRow
): WorkshopRecallListedBookmark {
  const { roomVisible: _roomVisible, ...row } = bookmark as WorkshopRecallBookmark & { roomVisible?: boolean };
  const ref: WorkshopRecallBookmarkRef = source.kind === 'current'
    ? { source: 'current', liveSessionId: source.liveSessionId, bookmarkId: bookmark.id }
    : { source: 'saved', sessionId: source.header.sessionId, bookmarkId: bookmark.id };
  return { ...row, ref };
}

/** D7: any open-room row the whole room could not see withholds the whole result. */
function withheldFor(rows: ReadonlyArray<{ readonly id: string; readonly roomVisible?: boolean }>): WorkshopRecallBookmarksWithheld | undefined {
  const privateRows = rows.filter((row) => row.roomVisible === false);
  return privateRows.length > 0
    ? { reason: 'open-room-private-turn', bookmarkIds: privateRows.map((row) => row.id) }
    : undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
