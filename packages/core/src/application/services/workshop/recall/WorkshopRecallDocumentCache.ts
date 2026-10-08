/**
 * Session recall's in-memory document cache (ADR 2026-10-05 §5). Least
 * recently used first, bounded by document count and retained characters,
 * and trusted for a session only while its listing's `updatedAt` matches.
 * Its bounds are module-local memory limits no prompt sees.
 *
 * Generations keep a changed scope out: `invalidate()` empties the cache
 * and starts a new generation, and a document read under an older one is
 * never stored.
 */

import type { WorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';

export interface WorkshopRecallDocumentCacheLimits {
  readonly maximumCachedDocuments: number;
  /** Retained text, in UTF-16 code units. */
  readonly maximumCachedCharacters: number;
}

export class WorkshopRecallDocumentCache {
  /** Insertion order is recency of use: the first key is evicted first. */
  private readonly documents = new Map<string, WorkshopRecallDocument>();
  private characters = 0;
  private currentGeneration = 0;

  constructor(private readonly limits: WorkshopRecallDocumentCacheLimits) {}

  /** Stamp a call with this at its start, and store what it reads under it. */
  get generation(): number {
    return this.currentGeneration;
  }

  /** Forget everything, and refuse documents read before now. */
  invalidate(): void {
    this.documents.clear();
    this.characters = 0;
    this.currentGeneration += 1;
  }

  /** This session's document at this version, or nothing; an older version is dropped. */
  get(sessionId: string, updatedAt: string): WorkshopRecallDocument | undefined {
    const cached = this.documents.get(sessionId);
    if (!cached) {
      return undefined;
    }
    this.forget(sessionId);
    if (cached.updatedAt !== updatedAt) {
      return undefined;
    }
    this.remember(cached);
    return cached;
  }

  /**
   * Keep a document read under `generation`, evicting past either bound. A
   * document from an older generation, or larger than the whole cache, is
   * not kept.
   */
  remember(document: WorkshopRecallDocument, generation = this.currentGeneration): void {
    if (generation !== this.currentGeneration) {
      return;
    }
    this.forget(document.header.sessionId);
    if (document.characters > this.limits.maximumCachedCharacters) {
      return;
    }
    this.documents.set(document.header.sessionId, document);
    this.characters += document.characters;
    for (const [sessionId] of this.documents) {
      if (
        this.documents.size <= this.limits.maximumCachedDocuments &&
        this.characters <= this.limits.maximumCachedCharacters
      ) {
        break;
      }
      this.forget(sessionId);
    }
  }

  private forget(sessionId: string): void {
    const cached = this.documents.get(sessionId);
    if (cached) {
      this.documents.delete(sessionId);
      this.characters -= cached.characters;
    }
  }
}
