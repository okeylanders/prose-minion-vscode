/**
 * The Bookmarks screen's walks (ADR 2026-11-05 D8; PR #216 F-01, F-03): the
 * session ids each walk of the saved-session pages has met, so a page can
 * report an id an earlier page already read as ambiguous without reading
 * anything outside its own budget.
 *
 * - **A walk** starts with a first page and is named by an id this module
 *   mints. The cursor the screen echoes carries it beside the store's own
 *   (`{walkId}|{storeCursor}`); both are opaque to the webview.
 * - **Page-local memory.** The ids live here, in memory, keyed by walk. They
 *   are never the store's exact-read path cache, and never decide what an
 *   exact action opens: they only mark rows the screen won't offer to open.
 * - **Bounded.** At most `maximumWalks` walks are kept, the oldest forgotten
 *   first. A page whose walk was forgotten is refused (`expired`), so a
 *   check never silently restarts partway.
 */

const SEPARATOR = '|';

export interface WorkshopRecallBookmarkWalk {
  readonly walkId: string;
  /** Ids met on earlier pages of this walk. */
  readonly seen: ReadonlySet<string>;
  /** The store's cursor to continue after; absent on a first page. */
  readonly storeCursor?: string;
}

export type WorkshopRecallBookmarkWalkStart =
  | { readonly kind: 'walk'; readonly walk: WorkshopRecallBookmarkWalk }
  | { readonly kind: 'expired' };

export class WorkshopRecallBookmarkWalks {
  private readonly walks = new Map<string, Set<string>>();
  private count = 0;

  constructor(private readonly maximumWalks = 16) {}

  /** A first page (`after` absent) starts a walk; a later one continues its own. */
  open(after: string | undefined): WorkshopRecallBookmarkWalkStart {
    if (after === undefined) {
      this.count += 1;
      const walkId = `walk-${this.count}`;
      this.walks.set(walkId, new Set());
      for (const [oldest] of this.walks) {
        if (this.walks.size <= this.maximumWalks) {
          break;
        }
        this.walks.delete(oldest);
      }
      return { kind: 'walk', walk: { walkId, seen: new Set() } };
    }
    const split = after.indexOf(SEPARATOR);
    const walkId = split > 0 ? after.slice(0, split) : '';
    const seen = this.walks.get(walkId);
    if (!seen) {
      return { kind: 'expired' };
    }
    return { kind: 'walk', walk: { walkId, seen: new Set(seen), storeCursor: after.slice(split + 1) } };
  }

  /** What this page met joins its walk. */
  remember(walkId: string, ids: Iterable<string>): void {
    const seen = this.walks.get(walkId);
    if (seen) {
      for (const id of ids) {
        seen.add(id);
      }
    }
  }

  /** The cursor the screen echoes for the next page. */
  static cursor(walkId: string, storeCursor: string): string {
    return `${walkId}${SEPARATOR}${storeCursor}`;
  }
}
