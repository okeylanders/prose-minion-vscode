/**
 * Session recall's scope rule (ADR 2026-10-05 §2, PR 126 review F-04), one
 * place for every call: open the scope, list (or read) what the call needs,
 * run its work, and check the scope again after the listing, around every
 * cold read (through `assertHolds`) and before the result is returned. The
 * store resolves the workspace on every call, so a check at the entry alone
 * would not bound what a call reads. A call whose scope changed returns only
 * the refusal, and the cache is emptied under a new generation so reads
 * still in flight cannot repopulate it.
 */

import type { WorkshopRecallDocumentCache } from '@/application/services/workshop/recall/WorkshopRecallDocumentCache';
import {
  throwIfRecallAborted,
  WorkshopRecallReadScope
} from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
import type { WorkshopRecallUnavailable } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type {
  WorkshopRecallCorpusPort,
  WorkshopRecallScopePort
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** The scope a call opened: who the live room was, and the cache generation then. */
export interface WorkshopRecallOpenScope extends WorkshopRecallReadScope {
  readonly liveSessionId: string;
}

/** The scope a call opened stopped holding before the call finished. */
class RecallScopeChangedError extends Error {
  constructor(readonly unavailable: WorkshopRecallUnavailable) {
    super(`Session recall scope changed (${unavailable.reason}).`);
    this.name = 'RecallScopeChangedError';
  }
}

export class WorkshopRecallScopeGate {
  constructor(
    private readonly corpus: Pick<WorkshopRecallCorpusPort, 'availability'>,
    private readonly scope: WorkshopRecallScopePort,
    private readonly cache: WorkshopRecallDocumentCache,
    private readonly log: (line: string) => void
  ) {}

  /**
   * Open the scope, run `list`, then `work` over what it returned. Either
   * may throw an AbortError, which passes through.
   */
  async open<L, T>(
    signal: AbortSignal | undefined,
    list: (signal?: AbortSignal) => Promise<L>,
    work: (scope: WorkshopRecallOpenScope, listing: L) => Promise<T>
  ): Promise<T | WorkshopRecallUnavailable> {
    throwIfRecallAborted(signal);
    const current = this.currentScope();
    if ('reason' in current) {
      return current;
    }
    const opened = { liveSessionId: current.liveSessionId, generation: this.cache.generation };
    const scope: WorkshopRecallOpenScope = { ...opened, assertHolds: () => this.assertScope(opened) };
    try {
      const listing = await list(signal);
      throwIfRecallAborted(signal);
      this.assertScope(scope);
      const result = await work(scope, listing);
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
}
