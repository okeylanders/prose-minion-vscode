/**
 * What one session-recall call selects: the recallable sessions in a
 * listing, the catalog rows, a read's sessions and their turn ranges
 * resolved against each document, the to-dos a filter admits, and the
 * bookmarks a `transcript.bookmarks` call reads and admits (ADR 2026-11-05
 * D2). Pure; the service owns scope, reads, and the cache.
 */

import type { WorkshopPersonaId } from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import {
  normalizeWorkshopRecallText,
  workshopRecallEntryText,
  WorkshopRecallDocument,
  WorkshopRecallTodo
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallBookmarkFilters } from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import { WorkshopRecallClock } from '@/application/services/workshop/recall/WorkshopRecallTime';
import {
  matchWorkshopRecallSessions,
  parseWorkshopRecallQuery
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import type {
  WorkshopRecallCatalogSession,
  WorkshopRecallReadRange,
  WorkshopRecallReadRequest,
  WorkshopRecallSessionRead,
  WorkshopRecallSessionMatchResult,
  WorkshopRecallTodoSession,
  WorkshopRecallTodosBounds,
  WorkshopRecallTodosRequest,
  WorkshopRecallTurnRange,
  WorkshopRecallUnknownSession
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type { WorkshopRecallTodoSourceId, WorkshopRecallTodoStatusFilter } from '@shared/types/workshopCapabilities';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** Newest first, the live room excluded, and one session per id. */
export function recallableSessions(
  listed: readonly WorkshopRecallSessionSummary[],
  liveSessionId: string
): WorkshopRecallSessionSummary[] {
  const seen = new Set<string>();
  return [...listed]
    .sort(newestFirst)
    .filter((session) => {
      if (session.sessionId === liveSessionId || seen.has(session.sessionId)) {
        return false;
      }
      seen.add(session.sessionId);
      return true;
    });
}

/**
 * The sessions a call may read: those that include `personaId`, narrowed to
 * the one `sessionId` names. An id outside the corpus is refused, never
 * resolved as a path; the live room's id is refused as such.
 */
export function narrowedSessions(
  sessions: readonly WorkshopRecallSessionSummary[],
  filters: { readonly sessionId?: string; readonly personaId?: WorkshopPersonaId },
  liveSessionId: string
): { readonly sessions: readonly WorkshopRecallSessionSummary[] } | { readonly unknown: WorkshopRecallUnknownSession } {
  const candidates = withParticipant(sessions, filters.personaId);
  if (filters.sessionId === undefined) {
    return { sessions: candidates };
  }
  const named = sessions.find((session) => session.sessionId === filters.sessionId);
  return named
    ? { sessions: candidates.filter((session) => session === named) }
    : { unknown: unknownSession(filters.sessionId, liveSessionId) };
}

/** The sessions `<match>` admits (D8), and how they matched; all of them without one. */
export function matchedSessions(
  sessions: readonly WorkshopRecallSessionSummary[],
  text: string | undefined
): { readonly sessions: readonly WorkshopRecallSessionSummary[]; readonly match?: WorkshopRecallSessionMatchResult } {
  if (text === undefined) {
    return { sessions };
  }
  const query = parseWorkshopRecallQuery(text);
  const matched = matchWorkshopRecallSessions(sessions, query);
  return {
    sessions: matched.sessions,
    match: { text, query, ...(matched.mode ? { mode: matched.mode } : {}) }
  };
}

export function withParticipant(
  sessions: readonly WorkshopRecallSessionSummary[],
  personaId: WorkshopPersonaId | undefined
): readonly WorkshopRecallSessionSummary[] {
  return personaId === undefined
    ? sessions
    : sessions.filter((session) => session.participantPersonaIds.includes(personaId));
}

export function catalogSession(summary: WorkshopRecallSessionSummary): WorkshopRecallCatalogSession {
  // A saved file may repeat a participant; the codec accepts that (PR 126 re-review F-01).
  const participantPersonaIds = [...new Set(summary.participantPersonaIds)];
  return {
    sessionId: summary.sessionId,
    title: summary.title,
    savedAt: summary.savedAt ?? summary.updatedAt,
    timezone: summary.timezone,
    hostPersonaId: summary.hostPersonaId,
    host: workshopPersonaLabel(summary.hostPersonaId),
    participantPersonaIds,
    participants: participantPersonaIds.map(workshopPersonaLabel),
    ...(summary.scope !== undefined ? { scope: summary.scope } : {}),
    ...(summary.excerptLabel ? { excerptLabel: summary.excerptLabel } : {}),
    lastTurn: summary.turnCount
  };
}

export function unknownSession(sessionId: string, liveSessionId: string): WorkshopRecallUnknownSession {
  return {
    available: true,
    outcome: 'unknown-session',
    sessionId,
    liveSession: sessionId === liveSessionId
  };
}

/** Sort ascending and merge overlapping or adjacent ranges. */
export function normalizeTurnRanges(ranges: readonly WorkshopRecallTurnRange[]): WorkshopRecallTurnRange[] {
  for (const range of ranges) {
    if (!Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 1 || range.to < range.from) {
      throw new Error(`Invalid session-recall turn range ${range.from}-${range.to}.`);
    }
  }
  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to);
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.from <= last.to + 1) {
      last.to = Math.max(last.to, range.to);
    } else {
      merged.push({ from: range.from, to: range.to });
    }
  }
  return merged;
}

/** One session a read will look up: its id, and its ranges sorted and merged (none: from turn 1). */
export interface WorkshopRecallPlannedRead {
  readonly sessionId: string;
  readonly ranges?: readonly WorkshopRecallTurnRange[];
}

/**
 * A read request's sessions, in the order asked, each with its ranges
 * normalized (D9). Throws on no session, more than `readSessions`, a session
 * named twice, or an invalid range: the Slice 3 codec refuses each of these
 * first, so any of them is a programming error here.
 */
export function plannedReads(request: WorkshopRecallReadRequest, readSessions: number): WorkshopRecallPlannedRead[] {
  const count = request.sessions.length;
  if (count < 1 || count > readSessions) {
    throw new Error(`A session-recall read names 1-${readSessions} sessions; got ${count}.`);
  }
  const named = new Set<string>();
  return request.sessions.map(({ sessionId, turns }) => {
    if (named.has(sessionId)) {
      throw new Error(`A session-recall read names session ${sessionId} twice.`);
    }
    named.add(sessionId);
    return turns === undefined || turns.length === 0 ? { sessionId } : { sessionId, ranges: normalizeTurnRanges(turns) };
  });
}

/** One session's read: its ranges resolved against its document, or the whole transcript from turn 1. */
export function readOfDocument(
  document: WorkshopRecallDocument,
  planned: WorkshopRecallPlannedRead,
  cacheHit: boolean
): Extract<WorkshopRecallSessionRead, { outcome: 'read' }> {
  const ranges = planned.ranges ?? [{ from: 1, to: Math.max(1, document.header.turnCount) }];
  return {
    outcome: 'read',
    header: document.header,
    fromStart: planned.ranges === undefined,
    ranges: ranges.map((range) => resolveRange(document, range)),
    bookmarks: document.bookmarks,
    cacheHit
  };
}

function resolveRange(
  document: WorkshopRecallDocument,
  range: WorkshopRecallTurnRange
): WorkshopRecallReadRange {
  const entries = document.entries.filter(
    (entry) => entry.position >= range.from && entry.position <= range.to
  );
  return {
    from: range.from,
    to: range.to,
    entries,
    ...(entries.length > 0
      ? { firstTurnId: entries[0].turnId, lastTurnId: entries[entries.length - 1].turnId }
      : {})
  };
}

/** The sessions a `transcript.todos` call reads, chosen from the listing alone. */
export interface WorkshopRecallTodoCandidates {
  /** What `<session>`, `<persona>`, and `<match>` admitted, newest first. */
  readonly candidates: readonly WorkshopRecallSessionSummary[];
  /** The newest `sessionLimit` of them. */
  readonly scanned: readonly WorkshopRecallSessionSummary[];
  /** `<recent>`, else `todoSessions`. */
  readonly sessionLimit: number;
  readonly match?: WorkshopRecallSessionMatchResult;
}

/**
 * Choose a to-do call's sessions (D6). Throws on a `<recent>` outside
 * 1–`todoSessions`, or on both `<recent>` and `<session>`: the codec
 * refuses both first, so either is a programming error here.
 */
export function todoCandidates(
  sessions: readonly WorkshopRecallSessionSummary[],
  request: WorkshopRecallTodosRequest,
  liveSessionId: string,
  todoSessions: number
): WorkshopRecallTodoCandidates | { readonly unknown: WorkshopRecallUnknownSession } {
  const { recent } = request;
  if (recent !== undefined && (request.sessionId !== undefined || !Number.isSafeInteger(recent) || recent < 1 || recent > todoSessions)) {
    throw new Error(`Invalid session-recall recent count ${recent}; it must be 1-${todoSessions}, without a session.`);
  }
  const narrowed = narrowedSessions(sessions, request, liveSessionId);
  if ('unknown' in narrowed) {
    return narrowed;
  }
  const { sessions: candidates, match } = matchedSessions(narrowed.sessions, request.match);
  const sessionLimit = recent ?? todoSessions;
  return { candidates, scanned: candidates.slice(0, sessionLimit), sessionLimit, ...(match ? { match } : {}) };
}

export interface WorkshopRecallTodoSelection {
  readonly sessions: WorkshopRecallTodoSession[];
  /** To-dos in `sessions`. */
  readonly kept: number;
  /** Each to-do left out, counted by the rule that left it out. */
  readonly omitted: Pick<
    WorkshopRecallTodosBounds,
    'omittedByItemLimit' | 'notShownByStatus' | 'notShownBySource' | 'sessionsWithoutMatchingTodos'
  >;
}

/**
 * Each document's to-dos, filtered by source and then by status, until
 * `itemLimit` are kept; documents come newest first, and every to-do left
 * out is counted by the rule that left it out. A session counts as without
 * matching to-dos only when the filters, not the item limit, emptied it.
 */
export function selectWorkshopRecallTodos(
  documents: readonly WorkshopRecallDocument[],
  filters: { readonly status: WorkshopRecallTodoStatusFilter; readonly source?: WorkshopRecallTodoSourceId },
  itemLimit: number
): WorkshopRecallTodoSelection {
  const notShownByStatus = { open: 0, completed: 0, dismissed: 0 };
  let notShownBySource = 0;
  let omittedByItemLimit = 0;
  let sessionsWithoutMatchingTodos = 0;
  let kept = 0;
  const sessions: WorkshopRecallTodoSession[] = [];
  for (const document of documents) {
    const todos: WorkshopRecallTodo[] = [];
    let matching = 0;
    for (const todo of document.todos) {
      if (filters.source !== undefined && todoSourceId(todo) !== filters.source) {
        notShownBySource += 1;
        continue;
      }
      if (filters.status !== 'all' && todo.status !== filters.status) {
        notShownByStatus[todo.status] += 1;
        continue;
      }
      matching += 1;
      if (kept >= itemLimit) {
        omittedByItemLimit += 1;
      } else {
        todos.push(todo);
        kept += 1;
      }
    }
    if (matching === 0) {
      sessionsWithoutMatchingTodos += 1;
    }
    if (todos.length > 0) {
      sessions.push({ header: document.header, todos });
    }
  }
  return {
    sessions,
    kept,
    omitted: { omittedByItemLimit, notShownByStatus, notShownBySource, sessionsWithoutMatchingTodos }
  };
}

/** The saved sessions a `transcript.bookmarks` list reads, chosen from the listing alone. */
export type WorkshopRecallBookmarkCandidates = WorkshopRecallTodoCandidates;

/**
 * Choose a bookmark list's saved sessions (ADR 2026-11-05 D2): the ones
 * `<session>` names, else every recallable one, kept by `<persona>` and
 * `<match>`, newest first, at most `<recent>` (else `bookmarkSessions`) of
 * them read. An id outside the corpus is refused, as everywhere in recall.
 * Throws on what the codec refuses first: a `<recent>` outside
 * 1–`bookmarkSessions`, or both `<recent>` and `<session>`.
 */
export function bookmarkCandidates(
  sessions: readonly WorkshopRecallSessionSummary[],
  request: {
    readonly sessionIds?: readonly string[];
    readonly recent?: number;
    readonly personaId?: WorkshopPersonaId;
    readonly match?: string;
  },
  liveSessionId: string,
  bookmarkSessions: number
): WorkshopRecallBookmarkCandidates | { readonly unknown: WorkshopRecallUnknownSession } {
  const { recent, sessionIds } = request;
  if (recent !== undefined && (sessionIds !== undefined || !Number.isSafeInteger(recent) || recent < 1 || recent > bookmarkSessions)) {
    throw new Error(`Invalid session-recall recent count ${recent}; it must be 1-${bookmarkSessions}, without a session.`);
  }
  let named = sessions;
  if (sessionIds !== undefined) {
    const unknown = sessionIds.find((sessionId) => !sessions.some((session) => session.sessionId === sessionId));
    if (unknown !== undefined) {
      return { unknown: unknownSession(unknown, liveSessionId) };
    }
    named = sessions.filter((session) => sessionIds.includes(session.sessionId));
  }
  const { sessions: candidates, match } = matchedSessions(withParticipant(named, request.personaId), request.match);
  const sessionLimit = recent ?? bookmarkSessions;
  return { candidates, scanned: candidates.slice(0, sessionLimit), sessionLimit, ...(match ? { match } : {}) };
}

/** One source's bookmarks, as a list call reads them: where they are, and the zone their days are in. */
export interface WorkshopRecallBookmarkPool<T extends WorkshopRecallBookmark, S> {
  readonly source: S;
  readonly timezone: string;
  readonly bookmarks: readonly T[];
}

export interface WorkshopRecallBookmarkSelection<T extends WorkshopRecallBookmark, S> {
  /** Only pools with a bookmark to show, in the order given. */
  readonly groups: Array<{ readonly source: S; readonly bookmarks: T[] }>;
  readonly kept: number;
  readonly seen: number;
  readonly notShownByFilters: number;
  readonly omittedByItemLimit: number;
}

/**
 * Each pool's bookmarks the filters admit, in the order given, until
 * `itemLimit` are kept: filtered, then bounded, so every one left out is
 * counted by the rule that left it out.
 */
export function selectWorkshopRecallBookmarks<T extends WorkshopRecallBookmark, S>(
  pools: ReadonlyArray<WorkshopRecallBookmarkPool<T, S>>,
  filters: WorkshopRecallBookmarkFilters,
  itemLimit: number
): WorkshopRecallBookmarkSelection<T, S> {
  const terms = filters.query === undefined ? undefined : normalizeWorkshopRecallText(filters.query).split(' ').filter(Boolean);
  const groups: Array<{ source: S; bookmarks: T[] }> = [];
  let kept = 0;
  let seen = 0;
  let notShownByFilters = 0;
  let omittedByItemLimit = 0;
  for (const pool of pools) {
    const clock = new WorkshopRecallClock(pool.timezone);
    const shown: T[] = [];
    for (const bookmark of pool.bookmarks) {
      seen += 1;
      if (!bookmarkAdmitted(bookmark, filters, terms, clock)) {
        notShownByFilters += 1;
      } else if (kept >= itemLimit) {
        omittedByItemLimit += 1;
      } else {
        shown.push(bookmark);
        kept += 1;
      }
    }
    if (shown.length > 0) {
      groups.push({ source: pool.source, bookmarks: shown });
    }
  }
  return { groups, kept, seen, notShownByFilters, omittedByItemLimit };
}

/**
 * `<speaker>` by id; `<since>` and `<until>` by the calendar day the
 * bookmark was made in its session's zone, `<until>` whole; `<query>`'s
 * every word at the start of a word of the label or the message, as search
 * matches. A query with no words admits nothing.
 */
function bookmarkAdmitted(
  bookmark: WorkshopRecallBookmark,
  filters: WorkshopRecallBookmarkFilters,
  terms: readonly string[] | undefined,
  clock: WorkshopRecallClock
): boolean {
  if (filters.speaker !== undefined && bookmark.speaker.id !== filters.speaker) {
    return false;
  }
  if (filters.since !== undefined || filters.until !== undefined) {
    const day = clock.day(bookmark.createdAt);
    if (day === 'unknown' || (filters.since !== undefined && day < filters.since) || (filters.until !== undefined && day > filters.until)) {
      return false;
    }
  }
  if (terms !== undefined) {
    const text = normalizeWorkshopRecallText(
      [bookmark.displayLabel, bookmark.entry ? workshopRecallEntryText(bookmark.entry) : ''].join('\n')
    ).split(' ');
    return terms.length > 0 && terms.every((term) => text.some((word) => word.startsWith(term)));
  }
  return true;
}

/** The tool or persona a to-do came from. */
function todoSourceId(todo: WorkshopRecallTodo): WorkshopRecallTodoSourceId {
  return todo.source.kind === 'tool_report' ? todo.source.toolId : todo.source.personaId;
}

function newestFirst(left: WorkshopRecallSessionSummary, right: WorkshopRecallSessionSummary): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.sessionId.localeCompare(right.sessionId);
}
