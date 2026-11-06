/**
 * Session recall's in-memory document cache (ADR 2026-10-05 §5). Least
 * recently used first, bounded by document count and retained characters,
 * and trusted for a session only while its listing's `updatedAt` matches.
 * Its bounds are module-local memory limits no prompt sees.
 *
 * An entry may name the file it was read from (`source`, the Bookmarks
 * screen's page cache, PR #216 F-05): a lookup naming another file misses,
 * so a document read from one of two files claiming an id is never served
 * for the other. The persona recall cache names none.
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
  /** The file each entry was read from, when the caller names one. */
  private readonly sources = new Map<string, string>();
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
    this.sources.clear();
    this.characters = 0;
    this.currentGeneration += 1;
  }

  /**
   * This session's document at this version, from this file when `source` is
   * named, or nothing; an older version, or one from another file, is dropped.
   */
  get(sessionId: string, updatedAt: string, source?: string): WorkshopRecallDocument | undefined {
    const cached = this.documents.get(sessionId);
    if (!cached) {
      return undefined;
    }
    const cachedSource = this.sources.get(sessionId);
    this.forget(sessionId);
    if (cached.updatedAt !== updatedAt || cachedSource !== source) {
      return undefined;
    }
    this.remember(cached, this.currentGeneration, source);
    return cached;
  }

  /** Forget this session's document, whatever file it came from (an id found ambiguous). */
  forgetSession(sessionId: string): void {
    this.forget(sessionId);
  }

  /**
   * Keep a document read under `generation`, evicting past either bound. A
   * document from an older generation, or larger than the whole cache, is
   * not kept.
   */
  remember(document: WorkshopRecallDocument, generation = this.currentGeneration, source?: string): void {
    if (generation !== this.currentGeneration) {
      return;
    }
    this.forget(document.header.sessionId);
    if (document.characters > this.limits.maximumCachedCharacters) {
      return;
    }
    this.documents.set(document.header.sessionId, document);
    if (source !== undefined) {
      this.sources.set(document.header.sessionId, source);
    }
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
      this.sources.delete(sessionId);
      this.characters -= cached.characters;
    }
  }
}
