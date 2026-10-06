/**
 * Session recall's document reads (ADR 2026-10-05 §5). Cached documents are
 * free. A cold read goes through the store's exact read and spends the
 * call's byte budget whether or not it produces a document (PR 126 review
 * F-02). No read starts, and no document is kept, under a scope that has
 * stopped holding (F-04). A read that fails while its call is cancelled is a
 * cancellation, not an unreadable session.
 *
 * The service owns the scope and the cache's generations; this module only
 * reads through them.
 */

import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import {
  buildWorkshopRecallDocument,
  WorkshopRecallDocument
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type { WorkshopRecallDocumentCache } from '@/application/services/workshop/recall/WorkshopRecallDocumentCache';
import type { WorkshopRecallScanBounds } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type {
  WorkshopRecallCorpusPort,
  WorkshopRecallSessionSummary
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** The scope a call opened, as its reads need it. */
export interface WorkshopRecallReadScope {
  /** The cache generation when the call opened: what it reads is stored under it. */
  readonly generation: number;
  /** Throws when the scope the call opened no longer holds. */
  assertHolds(): void;
}

/** What became of one session the loader was given. */
export type WorkshopRecallLoadOutcome =
  | { readonly kind: 'loaded'; readonly document: WorkshopRecallDocument; readonly cacheHit: boolean }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'not-read-by-byte-budget' };

export interface WorkshopRecallLoadedDocuments {
  /** One per session given, in the same order. */
  readonly outcomes: readonly WorkshopRecallLoadOutcome[];
  /** The documents among them, in the same order. */
  readonly documents: WorkshopRecallDocument[];
  readonly notReadByByteBudget: number;
  /** What the reads cost, as every multi-session result reports it. */
  readonly cost: Omit<WorkshopRecallScanBounds, 'listingTruncated'>;
}

type LoadedDocument =
  | { readonly document: WorkshopRecallDocument; readonly cacheHit: boolean; readonly parsedBytes: number }
  | { readonly document?: undefined };

export class WorkshopRecallDocumentLoader {
  constructor(
    private readonly corpus: Pick<WorkshopRecallCorpusPort, 'readNamed'>,
    private readonly cache: WorkshopRecallDocumentCache,
    /** What a cold read that produced no document is charged against the byte budget. */
    private readonly unreadableSessionBytes: number,
    private readonly log: (line: string) => void
  ) {}

  /**
   * In the order given. Cached documents are free; a cold read spends the
   * byte budget whether or not it produces a document.
   */
  async loadAll(
    sessions: readonly WorkshopRecallSessionSummary[],
    byteBudget: number,
    scope: WorkshopRecallReadScope,
    signal?: AbortSignal
  ): Promise<WorkshopRecallLoadedDocuments> {
    const outcomes: WorkshopRecallLoadOutcome[] = [];
    const documents: WorkshopRecallDocument[] = [];
    let notReadByByteBudget = 0;
    let unreadableSessions = 0;
    let parsedBytes = 0;
    let unreadableBytesCharged = 0;
    let cacheHits = 0;
    for (const summary of sessions) {
      throwIfRecallAborted(signal);
      const cached = this.cache.get(summary.sessionId, summary.updatedAt);
      if (cached) {
        outcomes.push({ kind: 'loaded', document: cached, cacheHit: true });
        documents.push(cached);
        cacheHits += 1;
        continue;
      }
      if (parsedBytes + unreadableBytesCharged >= byteBudget) {
        outcomes.push({ kind: 'not-read-by-byte-budget' });
        notReadByByteBudget += 1;
        continue;
      }
      const loaded = await this.load(summary, scope, signal);
      if (!loaded.document) {
        outcomes.push({ kind: 'unreadable' });
        unreadableSessions += 1;
        unreadableBytesCharged += this.unreadableSessionBytes;
        continue;
      }
      outcomes.push({ kind: 'loaded', document: loaded.document, cacheHit: false });
      parsedBytes += loaded.parsedBytes;
      documents.push(loaded.document);
    }
    return {
      outcomes,
      documents,
      notReadByByteBudget,
      cost: { unreadableSessions, parsedBytes, unreadableBytesCharged, cacheHits }
    };
  }

  private async load(
    summary: WorkshopRecallSessionSummary,
    scope: WorkshopRecallReadScope,
    signal?: AbortSignal
  ): Promise<LoadedDocument> {
    const cached = this.cache.get(summary.sessionId, summary.updatedAt);
    if (cached) {
      return { document: cached, cacheHit: true, parsedBytes: 0 };
    }
    // Never read under a scope that no longer holds, nor keep what such a read returned.
    scope.assertHolds();
    let session: WorkshopPersistedSessionV2 | undefined;
    try {
      session = await this.corpus.readNamed(summary.sessionId);
    } catch (error) {
      // A read that failed because the call was cancelled is a cancellation.
      throwIfRecallAborted(signal);
      this.log(`Skipped unreadable session ${summary.sessionId}: ${errorMessage(error)}`);
      return {};
    }
    throwIfRecallAborted(signal);
    scope.assertHolds();
    if (!session || session.sessionId !== summary.sessionId) {
      this.log(`Skipped session ${summary.sessionId}: it was not found where the listing put it`);
      return {};
    }
    const document = buildWorkshopRecallDocument(session);
    this.cache.remember(document, scope.generation);
    return { document, cacheHit: false, parsedBytes: estimatedSourceBytes(session) };
  }
}

export function throwIfRecallAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Session recall was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
