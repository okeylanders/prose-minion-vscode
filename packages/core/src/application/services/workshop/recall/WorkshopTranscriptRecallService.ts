/**
 * Session recall's engine (ADR 2026-10-05 §2, §4–§5, D6): catalog, search,
 * read, to-dos and bookmarks over the writer's other saved Workshop
 * sessions. Bookmarks alone also read the open room, through its read-only
 * port (ADR 2026-11-05 D1). It returns data,
 * never prose; the renderer writes the model-facing text, and a persona
 * capability is one consumer among several to come.
 *
 * Corpus rules, all here:
 * - Named sessions only. The live room is excluded by the coordinator's
 *   `recallScope()`, which also refuses a changed workspace (F4, F7).
 * - Read-only, through consumer-owned ports. The corpus port has no writer,
 *   and its `list` takes no query: the store's content search walks private
 *   bodies (F1). Nothing here initializes, flushes, or touches current.json.
 * - Every bound is disclosed: sessions searched and not searched (by the
 *   session cap or the byte budget), unreadable files, and the listing cap.
 *   One unreadable file is counted, never fatal.
 *
 * Documents are cached by session id and trusted only while the listing's
 * `updatedAt` matches. The cache's memory bounds are module-local limits no
 * prompt sees, like WORKSHOP_SESSION_STORE_LIMITS.
 */

import type { WorkshopPersonaId, WorkshopSessionScope } from '@messages';
import type { LogSink } from '@/platform';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WorkshopRecallDocumentCache,
  WorkshopRecallDocumentCacheLimits
} from '@/application/services/workshop/recall/WorkshopRecallDocumentCache';
import { WorkshopRecallDocumentLoader } from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
import { WorkshopRecallOpenScope, WorkshopRecallScopeGate } from '@/application/services/workshop/recall/WorkshopRecallScopeGate';
import { WorkshopRecallBookmarkPager } from '@/application/services/workshop/recall/WorkshopRecallBookmarkPager';
import type {
  WorkshopRecallBookmarkPage,
  WorkshopRecallBookmarkWalkExpired,
  WorkshopRecallSessionPage
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkPage';
import { WorkshopRecallSavedTurn, workshopRecallSavedTurn } from '@/application/services/workshop/recall/WorkshopRecallSavedTurn';
import { WORKSHOP_BOOKMARK_BROWSER_LIMITS } from '@shared/constants/workshopBookmarkBrowser';
import {
  parseWorkshopRecallQuery,
  searchWorkshopRecallDocuments
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import {
  catalogSession,
  matchedSessions,
  narrowedSessions,
  plannedReads,
  readOfDocument,
  recallableSessions,
  selectWorkshopRecallTodos,
  todoCandidates,
  withParticipant
} from '@/application/services/workshop/recall/WorkshopRecallCorpusSelection';
import type {
  WorkshopLiveRoomBookmarkRead,
  WorkshopLiveRoomBookmarks
} from '@/application/services/workshop/recall/WorkshopLiveRoomBookmarks';
import {
  listWorkshopRecallBookmarks,
  readWorkshopRecallBookmark,
  workshopRecallBookmarksLogLine
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkQuery';
import type {
  WorkshopRecallBookmarksRequest,
  WorkshopRecallBookmarksResult
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import type {
  WorkshopRecallCatalogResult,
  WorkshopRecallReadRequest,
  WorkshopRecallReadResult,
  WorkshopRecallSearchBounds,
  WorkshopRecallSessionRead,
  WorkshopRecallSearchResult,
  WorkshopRecallTodosBounds,
  WorkshopRecallTodosRequest,
  WorkshopRecallPositions,
  WorkshopRecallTodosResult,
  WorkshopRecallUnavailable,
  WorkshopRecallUnavailableReason
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

export const WORKSHOP_TRANSCRIPT_RECALL_LIMITS = Object.freeze({
  /** Documents kept warm between calls: one full newest-first scan and some reads. */
  maximumCachedDocuments: 64,
  /** Cached text, in UTF-16 code units (about 64 MB). */
  maximumCachedCharacters: 32 * 1024 * 1024,
  /**
   * What a cold read that produced no document is charged against the search
   * budget. A failed read reports no size, so it is charged the most it can
   * have cost: the store's exact-read ceiling (a test pins the two together).
   */
  unreadableSessionBytes: 25 * 1024 * 1024
});

export interface WorkshopTranscriptRecallLimits extends WorkshopRecallDocumentCacheLimits {
  readonly unreadableSessionBytes: number;
}

export type WorkshopRecallScope =
  | { available: true; liveSessionId: string }
  | { available: false; reason: WorkshopRecallUnavailableReason };

/** Satisfied by WorkshopSessionPersistenceCoordinator. */
export interface WorkshopRecallScopePort {
  recallScope(): WorkshopRecallScope;
}

/**
 * The listing fields recall may read. `preview` and `excerptIdentity` are
 * deliberately absent, so no recall code can reach them (F6).
 */
export interface WorkshopRecallSessionSummary {
  readonly sessionId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly savedAt?: string;
  readonly timezone: string;
  readonly hostPersonaId: WorkshopPersonaId;
  readonly participantPersonaIds: readonly WorkshopPersonaId[];
  readonly turnCount: number;
  readonly scope?: WorkshopSessionScope;
  readonly excerptLabel?: string;
}

/** Satisfied by WorkshopSessionStore: four read methods and nothing else. */
export interface WorkshopRecallCorpusPort {
  availability():
    | { available: true }
    | { available: false; reason: 'no-workspace' | 'multi-root' };
  /** Always called without a query: content search reads private bodies (F1). */
  list(
    query: undefined,
    signal?: AbortSignal
  ): Promise<{ sessions: readonly WorkshopRecallSessionSummary[]; truncated: boolean }>;
  readNamed(sessionId: string): Promise<WorkshopPersistedSessionV2 | undefined>;
  /** Every session file, a bounded page at a time, uncapped by `list`'s 200 (ADR 2026-11-05 D8). */
  listPage(request: { after?: string; limit: number }, signal?: AbortSignal): Promise<WorkshopRecallSessionPage>;
  /** A page's session from the file its entry names, if that file holds it; page-local (PR #216 F-01). */
  readPagedSession(cursor: string, sessionId: string): Promise<WorkshopPersistedSessionV2 | undefined>;
}

export interface WorkshopTranscriptRecallServiceOptions {
  now?: () => number;
  limits?: Partial<WorkshopTranscriptRecallLimits>;
  /**
   * The open room's bookmarks (ADR 2026-11-05 D1): read only by
   * `bookmarks()`, never by the other operations. Without it, the open
   * room's bookmarks are reported unavailable.
   */
  liveRoom?: WorkshopLiveRoomBookmarks;
}

interface RecallCorpus {
  readonly scope: WorkshopRecallOpenScope;
  readonly sessions: readonly WorkshopRecallSessionSummary[];
  readonly listingTruncated: boolean;
}

export class WorkshopTranscriptRecallService {
  private readonly now: () => number;
  private readonly limits: WorkshopTranscriptRecallLimits;
  private readonly cache: WorkshopRecallDocumentCache;
  private readonly loader: WorkshopRecallDocumentLoader;
  private readonly gate: WorkshopRecallScopeGate;
  private readonly pager: WorkshopRecallBookmarkPager;
  private readonly liveRoom?: WorkshopLiveRoomBookmarks;

  constructor(
    private readonly corpus: WorkshopRecallCorpusPort,
    private readonly scope: WorkshopRecallScopePort,
    private readonly outputChannel: LogSink,
    options: WorkshopTranscriptRecallServiceOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.limits = { ...WORKSHOP_TRANSCRIPT_RECALL_LIMITS, ...options.limits };
    this.cache = new WorkshopRecallDocumentCache(this.limits);
    this.pager = new WorkshopRecallBookmarkPager(corpus, this.limits, this.limits.unreadableSessionBytes, (line) => this.log(line));
    this.liveRoom = options.liveRoom;
    this.gate = new WorkshopRecallScopeGate(corpus, scope, this.cache, (line) => this.log(line));
    this.loader = new WorkshopRecallDocumentLoader(
      corpus,
      this.cache,
      this.limits.unreadableSessionBytes,
      (line) => this.log(line)
    );
  }

  /**
   * Recallable sessions, newest first. `<persona>` and `<match>` (D8) filter
   * the listing alone, so a catalog reads no session file and spends no
   * byte budget, and its count covers every session that matched.
   */
  catalog(
    request: { personaId?: WorkshopPersonaId; match?: string },
    signal?: AbortSignal
  ): Promise<WorkshopRecallCatalogResult> {
    return this.withCorpus(signal, async (corpus) => {
      const { sessions: matching, match } = matchedSessions(
        withParticipant(corpus.sessions, request.personaId),
        request.match
      );
      return {
        available: true,
        outcome: 'catalog',
        ...(request.personaId ? { personaId: request.personaId } : {}),
        ...(match ? { match } : {}),
        sessions: matching
          .slice(0, PROMPT_BUDGETS.workshopTranscriptRecall.catalogSessions)
          .map(catalogSession),
        matchingSessions: matching.length,
        listingTruncated: corpus.listingTruncated
      };
    });
  }

  search(
    request: { query: string; sessionId?: string; personaId?: WorkshopPersonaId },
    signal?: AbortSignal
  ): Promise<WorkshopRecallSearchResult> {
    const started = this.now();
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    return this.withCorpus(signal, async (corpus): Promise<WorkshopRecallSearchResult> => {
      const narrowed = narrowedSessions(corpus.sessions, request, corpus.scope.liveSessionId);
      if ('unknown' in narrowed) {
        return narrowed.unknown;
      }
      const candidates = narrowed.sessions;
      const scanned = candidates.slice(0, budgets.searchSessions);
      const loaded = await this.loader.loadAll(scanned, budgets.searchSourceBytes, corpus.scope, signal);
      const query = parseWorkshopRecallQuery(request.query);
      const search = searchWorkshopRecallDocuments(loaded.documents, query, {
        hits: budgets.searchHits,
        hitsPerSession: budgets.searchHitsPerSession,
        snippetCharacters: budgets.snippetCharacters
      });
      const bounds: WorkshopRecallSearchBounds = {
        corpusSessions: candidates.length,
        sessionsSearched: loaded.documents.length,
        notSearchedBySessionLimit: candidates.length - scanned.length,
        notSearchedByByteBudget: loaded.notReadByByteBudget,
        listingTruncated: corpus.listingTruncated,
        ...loaded.cost
      };
      this.log(
        `search terms=${query.terms.length} mode=${search.mode ?? 'none'} ` +
        `sessions=${bounds.sessionsSearched}/${bounds.corpusSessions} ` +
        `notSearched=${bounds.notSearchedBySessionLimit}+${bounds.notSearchedByByteBudget} ` +
        `unreadable=${bounds.unreadableSessions} parsedBytes=${bounds.parsedBytes} ` +
        `unreadableCharge=${bounds.unreadableBytesCharged} ` +
        `cacheHits=${bounds.cacheHits} hits=${search.shownHits}/${search.matchedHits} ` +
        `durationMs=${this.now() - started}`
      );
      return {
        available: true,
        outcome: 'searched',
        queryText: request.query,
        query,
        ...(request.personaId ? { personaId: request.personaId } : {}),
        ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
        search,
        bounds
      };
    });
  }

  /**
   * Read one to `readSessions` sessions in the order asked (D9), each from
   * its own ranges or from turn 1. Packing into fair shares is the
   * renderer's job, because only it knows what the text costs. Cold reads
   * spend `searchSourceBytes` in request order, a failed one charged as in
   * search; an unknown, live, unreadable, or unaffordable session is
   * reported in its place. Throws on a request the codec would refuse.
   */
  async read(request: WorkshopRecallReadRequest, signal?: AbortSignal): Promise<WorkshopRecallReadResult> {
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    const planned = plannedReads(request, budgets.readSessions);
    const detail = request.detail ?? (planned.length > 1 ? 'discussion' : 'full');
    return this.withCorpus(signal, async (corpus): Promise<WorkshopRecallReadResult> => {
      // Each listed session keeps its place in the request, and its outcome pairs with it there.
      const listed = planned.flatMap(({ sessionId }, index) => {
        const summary = corpus.sessions.find((session) => session.sessionId === sessionId);
        return summary ? [{ index, summary }] : [];
      });
      const loaded = await this.loader.loadAll(listed.map(({ summary }) => summary), budgets.searchSourceBytes, corpus.scope, signal);
      const outcomes = new Map(listed.map(({ index, summary }, order) => [index, { summary, outcome: loaded.outcomes[order] }]));
      const sessions = planned.map((wanted, index): WorkshopRecallSessionRead => {
        const found = outcomes.get(index);
        if (!found) {
          return { outcome: 'unknown-session', sessionId: wanted.sessionId, liveSession: wanted.sessionId === corpus.scope.liveSessionId };
        }
        const { summary, outcome } = found;
        switch (outcome.kind) {
          case 'loaded':
            return readOfDocument(outcome.document, wanted, outcome.cacheHit);
          case 'unreadable':
          case 'not-read-by-byte-budget':
            return { outcome: outcome.kind, sessionId: summary.sessionId, title: summary.title };
          default:
            return assertNever(outcome);
        }
      });
      const bounds = { notReadByByteBudget: loaded.notReadByByteBudget, listingTruncated: corpus.listingTruncated, ...loaded.cost };
      this.log(
        `read sessions=${planned.length} read=${loaded.documents.length} unknown=${planned.length - listed.length} ` +
        `unreadable=${bounds.unreadableSessions} notRead=${bounds.notReadByByteBudget} detail=${detail} ` +
        `parsedBytes=${bounds.parsedBytes} cacheHits=${bounds.cacheHits}`
      );
      return { available: true, outcome: 'read', detail, sessions, bounds };
    });
  }

  /**
   * Where `turnIds` stand in a saved session now (ADR 2026-11-04 D3), from
   * the same documents and cache as a read: project memory's provenance.
   * Read-only, bounded by one session's read, and never of the live room.
   */
  async positionsOf(sessionId: string, turnIds: readonly string[], signal?: AbortSignal): Promise<WorkshopRecallPositions> {
    const result = await this.withCorpus(signal, async (corpus): Promise<WorkshopRecallPositions> => {
      if (sessionId === corpus.scope.liveSessionId) {
        return { kind: 'live-session' };
      }
      const summary = corpus.sessions.find((session) => session.sessionId === sessionId);
      if (!summary) {
        return { kind: 'unknown-session' };
      }
      const loaded = await this.loader.loadAll([summary], PROMPT_BUDGETS.workshopTranscriptRecall.searchSourceBytes, corpus.scope, signal);
      const document = loaded.documents[0];
      if (!document) {
        return { kind: 'unreadable' };
      }
      const wanted = new Set(turnIds);
      const positions = document.entries.filter((entry) => wanted.has(entry.turnId)).map((entry) => entry.position);
      this.log(`positions turns=${turnIds.length} found=${positions.length} cacheHits=${loaded.cost.cacheHits}`);
      return { kind: 'positions', sessionId, title: document.header.title, positions: positions.sort((left, right) => left - right) };
    });
    return 'available' in result && !result.available ? { kind: 'unavailable', ...result } : result as WorkshopRecallPositions;
  }

  /**
   * The writer's to-do lists (D6), newest session first. `<session>`,
   * `<persona>`, and `<match>` choose sessions from the listing, which reads
   * no file; `<recent>` (else `todoSessions`) caps how many are read. Status
   * and source then filter each list, and `todoItems` caps the whole.
   */
  todos(request: WorkshopRecallTodosRequest, signal?: AbortSignal): Promise<WorkshopRecallTodosResult> {
    const started = this.now();
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    return this.withCorpus(signal, async (corpus): Promise<WorkshopRecallTodosResult> => {
      const chosen = todoCandidates(corpus.sessions, request, corpus.scope.liveSessionId, budgets.todoSessions);
      if ('unknown' in chosen) {
        return chosen.unknown;
      }
      const { candidates, scanned } = chosen;
      const loaded = await this.loader.loadAll(scanned, budgets.searchSourceBytes, corpus.scope, signal);
      const status = request.status ?? 'open';
      const selected = selectWorkshopRecallTodos(loaded.documents, { status, source: request.source }, budgets.todoItems);
      const bounds: WorkshopRecallTodosBounds = {
        corpusSessions: candidates.length,
        sessionLimit: chosen.sessionLimit,
        sessionsScanned: loaded.documents.length,
        notScannedBySessionLimit: candidates.length - scanned.length,
        notScannedByByteBudget: loaded.notReadByByteBudget,
        listingTruncated: corpus.listingTruncated,
        ...selected.omitted,
        ...loaded.cost
      };
      this.log(
        `todos status=${status} sessions=${bounds.sessionsScanned}/${bounds.corpusSessions} ` +
        `notScanned=${bounds.notScannedBySessionLimit}+${bounds.notScannedByByteBudget} ` +
        `unreadable=${bounds.unreadableSessions} parsedBytes=${bounds.parsedBytes} cacheHits=${bounds.cacheHits} ` +
        `shown=${selected.kept} omitted=${bounds.omittedByItemLimit} durationMs=${this.now() - started}`
      );
      return {
        available: true,
        outcome: 'todos',
        status,
        ...(request.recent !== undefined ? { recent: request.recent } : {}),
        ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
        ...(chosen.match ? { match: chosen.match } : {}),
        ...(request.source ? { source: request.source } : {}),
        ...(request.personaId ? { personaId: request.personaId } : {}),
        sessions: selected.sessions,
        bounds
      };
    });
  }

  /**
   * The writer's bookmarks (ADR 2026-11-05 D2): a list from the open room
   * and saved sessions, or one bookmark's message by its qualified ref. Only
   * this operation reads the open room, through its port and filtered by
   * what `reader` could see; the rules are WorkshopRecallBookmarkQuery's.
   */
  bookmarks(request: WorkshopRecallBookmarksRequest, signal?: AbortSignal): Promise<WorkshopRecallBookmarksResult> {
    const started = this.now();
    return this.withCorpus(signal, async (corpus): Promise<WorkshopRecallBookmarksResult> => {
      const opened = {
        liveSessionId: corpus.scope.liveSessionId,
        sessions: corpus.sessions,
        listingTruncated: corpus.listingTruncated,
        load: (sessions: readonly WorkshopRecallSessionSummary[]) =>
          this.loader.loadAll(sessions, PROMPT_BUDGETS.workshopTranscriptRecall.searchSourceBytes, corpus.scope, signal),
        ...(this.liveRoom ? { liveRoom: this.liveRoom } : {}),
        ...(request.reader ? { reader: request.reader } : {})
      };
      const result = request.bookmark !== undefined
        ? await readWorkshopRecallBookmark(opened, request)
        : await listWorkshopRecallBookmarks(opened, request);
      this.log(`${workshopRecallBookmarksLogLine(result)} durationMs=${this.now() - started}`);
      return result;
    });
  }

  /**
   * The Bookmarks screen (ADR 2026-11-05 D8): one page of saved sessions'
   * bookmarks, after `after`. The writer's read, never a persona's; it reads
   * through the store's paged walk, never the 200-file listing, and never
   * initializes or flushes. The store bounds the page by files and bytes.
   */
  async bookmarkPage(
    request: { after?: string },
    signal?: AbortSignal
  ): Promise<WorkshopRecallBookmarkPage | WorkshopRecallBookmarkWalkExpired | WorkshopRecallUnavailable> {
    const limit = WORKSHOP_BOOKMARK_BROWSER_LIMITS.bookmarkBrowserSessions;
    // The walk remembers the ids earlier pages met, so a page checks duplicates within its own budget (PR #216 F-03).
    const opened = this.pager.open(request.after);
    if (opened.kind === 'expired') {
      return { available: true, outcome: 'walk-expired' };
    }
    const { walk } = opened;
    return this.gate.open(
      signal,
      (listSignal) => this.corpus.listPage({ ...(walk.storeCursor !== undefined ? { after: walk.storeCursor } : {}), limit }, listSignal),
      (scope, page) => this.pager.read(walk, page, scope, signal)
    );
  }

  /** Every bookmark in the open room, for the writer's screen (D8); undefined without the live port. */
  liveRoomBookmarks(): WorkshopLiveRoomBookmarkRead | undefined {
    return this.liveRoom?.readWriterBookmarks();
  }

  /** One saved turn as the transcript projects it, for the screen's preview (D8). */
  savedTurn(sessionId: string, turnId: string, signal?: AbortSignal): Promise<WorkshopRecallSavedTurn | WorkshopRecallUnavailable> {
    return this.gate.open(signal, async () => undefined, async (scope) => {
      const result = await workshopRecallSavedTurn(sessionId, turnId, scope.liveSessionId, (id) => this.loader.readDocument(id, scope, signal));
      this.log(`saved-turn outcome=${result.kind}`);
      return result;
    });
  }

  /** Open the scope, list the corpus, and run `work` over it (WorkshopRecallScopeGate's rule). */
  private withCorpus<T>(
    signal: AbortSignal | undefined,
    work: (corpus: RecallCorpus) => Promise<T>
  ): Promise<T | WorkshopRecallUnavailable> {
    return this.gate.open(signal, (listSignal) => this.corpus.list(undefined, listSignal), (scope, listing) => work({
      scope,
      sessions: recallableSessions(listing.sessions, scope.liveSessionId),
      listingTruncated: listing.truncated
    }));
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`[WorkshopTranscriptRecall] ${line}`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
