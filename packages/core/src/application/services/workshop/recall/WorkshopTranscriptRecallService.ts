/**
 * Session recall's engine (ADR 2026-10-05 §2, §4–§5): catalog, search, and
 * read over the writer's other saved Workshop sessions. It returns data,
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
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import {
  buildWorkshopRecallDocument,
  WorkshopRecallDocument
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  WorkshopRecallDocumentCache,
  WorkshopRecallDocumentCacheLimits
} from '@/application/services/workshop/recall/WorkshopRecallDocumentCache';
import {
  parseWorkshopRecallQuery,
  searchWorkshopRecallDocuments
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import type {
  WorkshopRecallCatalogResult,
  WorkshopRecallCatalogSession,
  WorkshopRecallReadRange,
  WorkshopRecallReadResult,
  WorkshopRecallSearchBounds,
  WorkshopRecallSearchResult,
  WorkshopRecallTurnRange,
  WorkshopRecallUnavailable,
  WorkshopRecallUnavailableReason,
  WorkshopRecallUnknownSession
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

interface RecallCorpus {
  readonly liveSessionId: string;
  readonly sessions: readonly WorkshopRecallSessionSummary[];
  readonly listingTruncated: boolean;
}

interface LoadedDocuments {
  readonly documents: WorkshopRecallDocument[];
  readonly notSearchedByByteBudget: number;
  readonly unreadableSessions: number;
  readonly parsedBytes: number;
  readonly unreadableBytesCharged: number;
  readonly cacheHits: number;
}

type LoadedDocument =
  | { readonly document: WorkshopRecallDocument; readonly cacheHit: boolean; readonly parsedBytes: number }
  | { readonly document?: undefined };

export class WorkshopTranscriptRecallService {
  private readonly now: () => number;
  private readonly limits: WorkshopTranscriptRecallLimits;
  private readonly cache: WorkshopRecallDocumentCache;

  constructor(
    private readonly corpus: WorkshopRecallCorpusPort,
    private readonly scope: WorkshopRecallScopePort,
    private readonly outputChannel: LogSink,
    options: WorkshopTranscriptRecallServiceOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.limits = { ...WORKSHOP_TRANSCRIPT_RECALL_LIMITS, ...options.limits };
    this.cache = new WorkshopRecallDocumentCache(this.limits);
  }

  async catalog(
    request: { personaId?: WorkshopPersonaId },
    signal?: AbortSignal
  ): Promise<WorkshopRecallCatalogResult> {
    const corpus = await this.recallCorpus(signal);
    if ('reason' in corpus) {
      return corpus;
    }
    const matching = withParticipant(corpus.sessions, request.personaId);
    return {
      available: true,
      outcome: 'catalog',
      ...(request.personaId ? { personaId: request.personaId } : {}),
      sessions: matching
        .slice(0, PROMPT_BUDGETS.workshopTranscriptRecall.catalogSessions)
        .map(catalogSession),
      matchingSessions: matching.length,
      listingTruncated: corpus.listingTruncated
    };
  }

  async search(
    request: { query: string; sessionId?: string; personaId?: WorkshopPersonaId },
    signal?: AbortSignal
  ): Promise<WorkshopRecallSearchResult> {
    const started = this.now();
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    const corpus = await this.recallCorpus(signal);
    if ('reason' in corpus) {
      return corpus;
    }
    let candidates = withParticipant(corpus.sessions, request.personaId);
    if (request.sessionId !== undefined) {
      const named = corpus.sessions.find((session) => session.sessionId === request.sessionId);
      if (!named) {
        return unknownSession(request.sessionId, corpus.liveSessionId);
      }
      candidates = candidates.filter((session) => session === named);
    }
    const scanned = candidates.slice(0, budgets.searchSessions);
    const loaded = await this.loadDocuments(scanned, budgets.searchSourceBytes, signal);
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
      notSearchedByByteBudget: loaded.notSearchedByByteBudget,
      unreadableSessions: loaded.unreadableSessions,
      listingTruncated: corpus.listingTruncated,
      parsedBytes: loaded.parsedBytes,
      unreadableBytesCharged: loaded.unreadableBytesCharged,
      cacheHits: loaded.cacheHits
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
  }

  /**
   * Resolve the requested turn ranges, or the whole transcript from turn 1
   * when none are given. Packing into the read budget is the renderer's
   * job, because only it knows what the text costs.
   */
  async read(
    request: { sessionId: string; turns?: readonly WorkshopRecallTurnRange[] },
    signal?: AbortSignal
  ): Promise<WorkshopRecallReadResult> {
    const corpus = await this.recallCorpus(signal);
    if ('reason' in corpus) {
      return corpus;
    }
    const summary = corpus.sessions.find((session) => session.sessionId === request.sessionId);
    if (!summary) {
      return unknownSession(request.sessionId, corpus.liveSessionId);
    }
    const loaded = await this.loadDocument(summary, signal);
    if (!loaded.document) {
      return {
        available: true,
        outcome: 'unreadable',
        sessionId: summary.sessionId,
        title: summary.title
      };
    }
    const { document } = loaded;
    const fromStart = request.turns === undefined || request.turns.length === 0;
    const ranges = fromStart
      ? [{ from: 1, to: Math.max(1, document.header.turnCount) }]
      : normalizeTurnRanges(request.turns!);
    this.log(
      `read ranges=${ranges.length} cacheHit=${loaded.cacheHit} parsedBytes=${loaded.parsedBytes}`
    );
    return {
      available: true,
      outcome: 'read',
      header: document.header,
      fromStart,
      ranges: ranges.map((range) => resolveRange(document, range)),
      cacheHit: loaded.cacheHit
    };
  }

  private async recallCorpus(signal?: AbortSignal): Promise<RecallCorpus | WorkshopRecallUnavailable> {
    throwIfAborted(signal);
    const scope = this.scope.recallScope();
    if (!scope.available) {
      return { available: false, reason: scope.reason };
    }
    const availability = this.corpus.availability();
    if (!availability.available) {
      return { available: false, reason: availability.reason };
    }
    const listing = await this.corpus.list(undefined, signal);
    throwIfAborted(signal);
    const seen = new Set<string>();
    const sessions = [...listing.sessions]
      .sort(newestFirst)
      .filter((session) => {
        // The live room never recalls itself, and a duplicated id names one session.
        if (session.sessionId === scope.liveSessionId || seen.has(session.sessionId)) {
          return false;
        }
        seen.add(session.sessionId);
        return true;
      });
    return { liveSessionId: scope.liveSessionId, sessions, listingTruncated: listing.truncated };
  }

  /**
   * Newest first. Cached documents are free; a cold read spends the byte
   * budget whether or not it produces a document.
   */
  private async loadDocuments(
    sessions: readonly WorkshopRecallSessionSummary[],
    byteBudget: number,
    signal?: AbortSignal
  ): Promise<LoadedDocuments> {
    const documents: WorkshopRecallDocument[] = [];
    let notSearchedByByteBudget = 0;
    let unreadableSessions = 0;
    let parsedBytes = 0;
    let unreadableBytesCharged = 0;
    let cacheHits = 0;
    for (const summary of sessions) {
      throwIfAborted(signal);
      const cached = this.cache.get(summary.sessionId, summary.updatedAt);
      if (cached) {
        documents.push(cached);
        cacheHits += 1;
        continue;
      }
      if (parsedBytes + unreadableBytesCharged >= byteBudget) {
        notSearchedByByteBudget += 1;
        continue;
      }
      const loaded = await this.loadDocument(summary, signal);
      if (!loaded.document) {
        unreadableSessions += 1;
        unreadableBytesCharged += this.limits.unreadableSessionBytes;
        continue;
      }
      parsedBytes += loaded.parsedBytes;
      documents.push(loaded.document);
    }
    return { documents, notSearchedByByteBudget, unreadableSessions, parsedBytes, unreadableBytesCharged, cacheHits };
  }

  private async loadDocument(
    summary: WorkshopRecallSessionSummary,
    signal?: AbortSignal
  ): Promise<LoadedDocument> {
    const cached = this.cache.get(summary.sessionId, summary.updatedAt);
    if (cached) {
      return { document: cached, cacheHit: true, parsedBytes: 0 };
    }
    let session: WorkshopPersistedSessionV2 | undefined;
    try {
      session = await this.corpus.readNamed(summary.sessionId);
    } catch (error) {
      this.log(`Skipped unreadable session ${summary.sessionId}: ${errorMessage(error)}`);
      return {};
    }
    throwIfAborted(signal);
    if (!session || session.sessionId !== summary.sessionId) {
      this.log(`Skipped session ${summary.sessionId}: it was not found where the listing put it`);
      return {};
    }
    const document = buildWorkshopRecallDocument(session);
    this.cache.remember(document);
    return { document, cacheHit: false, parsedBytes: estimatedSourceBytes(session) };
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`[WorkshopTranscriptRecall] ${line}`);
  }
}

function withParticipant(
  sessions: readonly WorkshopRecallSessionSummary[],
  personaId: WorkshopPersonaId | undefined
): readonly WorkshopRecallSessionSummary[] {
  return personaId === undefined
    ? sessions
    : sessions.filter((session) => session.participantPersonaIds.includes(personaId));
}

function catalogSession(summary: WorkshopRecallSessionSummary): WorkshopRecallCatalogSession {
  return {
    sessionId: summary.sessionId,
    title: summary.title,
    savedAt: summary.savedAt ?? summary.updatedAt,
    timezone: summary.timezone,
    hostPersonaId: summary.hostPersonaId,
    host: workshopPersonaLabel(summary.hostPersonaId),
    participantPersonaIds: [...summary.participantPersonaIds],
    participants: summary.participantPersonaIds.map(workshopPersonaLabel),
    ...(summary.scope !== undefined ? { scope: summary.scope } : {}),
    ...(summary.excerptLabel ? { excerptLabel: summary.excerptLabel } : {}),
    lastTurn: summary.turnCount
  };
}

function unknownSession(sessionId: string, liveSessionId: string): WorkshopRecallUnknownSession {
  return {
    available: true,
    outcome: 'unknown-session',
    sessionId,
    liveSession: sessionId === liveSessionId
  };
}

/** Sort ascending and merge overlapping or adjacent ranges. */
function normalizeTurnRanges(ranges: readonly WorkshopRecallTurnRange[]): WorkshopRecallTurnRange[] {
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

function newestFirst(left: WorkshopRecallSessionSummary, right: WorkshopRecallSessionSummary): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.sessionId.localeCompare(right.sessionId);
}

/**
 * The bytes a cold parse cost, estimated by serializing the session the way
 * the store writes it. The store reports no size, and the ADR leaves it
 * unchanged. Decoding normalizes a few fields, so this lands within a few
 * percent of the file for sessions the current build wrote.
 */
function estimatedSourceBytes(session: WorkshopPersistedSessionV2): number {
  return Buffer.byteLength(JSON.stringify(session, undefined, 2), 'utf8');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Session recall was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
