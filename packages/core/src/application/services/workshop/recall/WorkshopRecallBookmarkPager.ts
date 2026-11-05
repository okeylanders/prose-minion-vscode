/**
 * The Bookmarks screen's pager (ADR 2026-11-05 D8; PR #216 F-01, F-03): one
 * page of saved sessions, read within the store's page budget, with the ids
 * its walk met on earlier pages so a repeat is reported, never resolved.
 *
 * - **Its own reads.** A page reads each session from the file its own
 *   entry names (`readPagedSession`), never through the store's exact-read
 *   path cache.
 * - **Its own documents.** It keeps them in a cache of its own, never the
 *   shared one a persona's recall reads, so a document read from one of two
 *   files claiming an id can never answer anyone else. That cache is
 *   forgotten whenever the recall scope moves on.
 * - **Its walks.** WorkshopRecallBookmarkWalks remembers each walk's ids; the
 *   cursor the screen echoes names the walk, and a forgotten walk is refused.
 *
 * It runs inside the service's scope gate: the caller opens the scope and
 * lists the page, then hands both here.
 */

import {
  WorkshopRecallDocumentCache,
  WorkshopRecallDocumentCacheLimits
} from '@/application/services/workshop/recall/WorkshopRecallDocumentCache';
import { WorkshopRecallDocumentLoader } from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
import type { WorkshopRecallOpenScope } from '@/application/services/workshop/recall/WorkshopRecallScopeGate';
import {
  WorkshopRecallBookmarkWalk,
  WorkshopRecallBookmarkWalks,
  WorkshopRecallBookmarkWalkStart
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkWalks';
import {
  WorkshopRecallBookmarkPage,
  workshopRecallBookmarkPage,
  workshopRecallBookmarkPageLogLine,
  WorkshopRecallSessionPage
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkPage';
import type { WorkshopRecallCorpusPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

export class WorkshopRecallBookmarkPager {
  private readonly walks = new WorkshopRecallBookmarkWalks();
  private readonly documents: WorkshopRecallDocumentCache;
  /** The scope generation the page cache's documents were read under. */
  private documentsFor = 0;

  constructor(
    private readonly corpus: Pick<WorkshopRecallCorpusPort, 'readPagedSession'>,
    limits: WorkshopRecallDocumentCacheLimits,
    private readonly unreadableSessionBytes: number,
    private readonly log: (line: string) => void
  ) {
    this.documents = new WorkshopRecallDocumentCache(limits);
  }

  /** Start or continue a walk from the screen's cursor. */
  open(after: string | undefined): WorkshopRecallBookmarkWalkStart {
    return this.walks.open(after);
  }

  /** Read one listed page of `walk` under `scope`. */
  async read(
    walk: WorkshopRecallBookmarkWalk,
    page: WorkshopRecallSessionPage,
    scope: WorkshopRecallOpenScope,
    signal?: AbortSignal
  ): Promise<WorkshopRecallBookmarkPage> {
    if (this.documentsFor !== scope.generation) {
      this.documents.invalidate();
      this.documentsFor = scope.generation;
    }
    const files = new Map(page.entries.flatMap((entry) => (entry.summary ? [[entry.summary.sessionId, entry.cursor] as const] : [])));
    const loader = new WorkshopRecallDocumentLoader(
      { readNamed: (sessionId) => this.corpus.readPagedSession(files.get(sessionId) ?? '', sessionId) },
      this.documents,
      this.unreadableSessionBytes,
      this.log
    );
    const pageScope = { ...scope, generation: this.documents.generation };
    const read = await workshopRecallBookmarkPage(page, scope.liveSessionId, walk.seen, (sessions) =>
      loader.loadAll(sessions, Number.POSITIVE_INFINITY, pageScope, signal));
    this.walks.remember(walk.walkId, read.metSessionIds);
    this.log(workshopRecallBookmarkPageLogLine(read));
    return read.next === undefined ? read : { ...read, next: WorkshopRecallBookmarkWalks.cursor(walk.walkId, read.next) };
  }
}
