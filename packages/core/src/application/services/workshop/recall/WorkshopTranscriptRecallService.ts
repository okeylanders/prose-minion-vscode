/**
 * Session recall's engine (ADR 2026-10-05 §2, §4–§5, D6): catalog, search,
 * read, and to-dos over the writer's other saved Workshop sessions. It returns data,
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
import {
  throwIfRecallAborted,
  WorkshopRecallDocumentLoader,
  WorkshopRecallReadScope
} from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
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
  WorkshopRecallCatalogResult,
  WorkshopRecallReadRequest,
  WorkshopRecallReadResult,
  WorkshopRecallSearchBounds,
  WorkshopRecallSessionRead,
  WorkshopRecallSearchResult,
  WorkshopRecallTodosBounds,
  WorkshopRecallTodosRequest,
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

/** Satisfied by WorkshopSessionStore: three read methods and nothing else. */
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
}

export interface WorkshopTranscriptRecallServiceOptions {
  now?: () => number;
  limits?: Partial<WorkshopTranscriptRecallLimits>;
}

/** The scope a call opened: who the live room was, and the cache generation then. */
interface OpenScope extends WorkshopRecallReadScope {
  readonly liveSessionId: string;
}

interface RecallCorpus {
  readonly scope: OpenScope;
  readonly sessions: readonly WorkshopRecallSessionSummary[];
  readonly listingTruncated: boolean;
}

/** The scope a call opened stopped holding before the call finished. */
class RecallScopeChangedError extends Error {
  constructor(readonly unavailable: WorkshopRecallUnavailable) {
    super(`Session recall scope changed (${unavailable.reason}).`);
    this.name = 'RecallScopeChangedError';
  }
}

export class WorkshopTranscriptRecallService {
  private readonly now: () => number;
  private readonly limits: WorkshopTranscriptRecallLimits;
  private readonly cache: WorkshopRecallDocumentCache;
  private readonly loader: WorkshopRecallDocumentLoader;

  constructor(
    private readonly corpus: WorkshopRecallCorpusPort,
    private readonly scope: WorkshopRecallScopePort,
    private readonly outputChannel: LogSink,
    options: WorkshopTranscriptRecallServiceOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.limits = { ...WORKSHOP_TRANSCRIPT_RECALL_LIMITS, ...options.limits };
    this.cache = new WorkshopRecallDocumentCache(this.limits);
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
   * Open the scope, list the corpus, and run `work` over it. The scope is
   * checked again after the listing, around every cold read, and before the
   * result is returned: the store resolves the workspace on every call, so
   * a check at the entry alone would not bound what a call reads (PR 126
   * review F-04). A call whose scope changed returns only the refusal.
   */
  private async withCorpus<T>(
    signal: AbortSignal | undefined,
    work: (corpus: RecallCorpus) => Promise<T>
  ): Promise<T | WorkshopRecallUnavailable> {
    throwIfRecallAborted(signal);
    const current = this.currentScope();
    if ('reason' in current) {
      return current;
    }
    const opened = { liveSessionId: current.liveSessionId, generation: this.cache.generation };
    const scope: OpenScope = { ...opened, assertHolds: () => this.assertScope(opened) };
    try {
      const listing = await this.corpus.list(undefined, signal);
      throwIfRecallAborted(signal);
      this.assertScope(scope);
      const result = await work({
        scope,
        sessions: recallableSessions(listing.sessions, scope.liveSessionId),
        listingTruncated: listing.truncated
      });
      this.assertScope(scope);
      return result;
    } catch (error) {
      if (error instanceof RecallScopeChangedError) {
        return error.unavailable;
      }
      throw error;
    }
  }

  /** The coordinator's scope, confirmed by the store's own availability. */
  private currentScope(): { liveSessionId: string } | WorkshopRecallUnavailable {
    const scope = this.scope.recallScope();
    if (!scope.available) {
      return { available: false, reason: scope.reason };
    }
    const availability = this.corpus.availability();
    if (!availability.available) {
      return { available: false, reason: availability.reason };
    }
    return { liveSessionId: scope.liveSessionId };
  }

  /**
   * Throw when the scope a call opened no longer holds. Whatever the call
   * already read is suspect, so the cache is emptied and its generation
   * advanced: reads still in flight cannot repopulate it.
   */
  private assertScope(scope: { readonly liveSessionId: string }): void {
    const current = this.currentScope();
    if (!('reason' in current) && current.liveSessionId === scope.liveSessionId) {
      return;
    }
    this.cache.invalidate();
    this.log('Recall scope changed during a call; its results and the document cache were discarded');
    // A different live room under the same workspace: the room is changing.
    throw new RecallScopeChangedError('reason' in current ? current : { available: false, reason: 'not-ready' });
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`[WorkshopTranscriptRecall] ${line}`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
