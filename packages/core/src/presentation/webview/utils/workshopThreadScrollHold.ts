/**
 * Holding the writer's place when earlier turns land above it (ADR
 * 2026-11-17 D7): the bubble at the top of the view before the page lands is
 * at the same place after.
 *
 * The math is pure; `measureWorkshopThreadPlace` and
 * `restoreWorkshopThreadPlace` are the thin DOM readers around it.
 */

/** One bubble's vertical extent, measured from the scroller's top edge. */
export interface WorkshopThreadRow {
  readonly id: string;
  readonly top: number;
  readonly bottom: number;
}

export interface WorkshopThreadPlace {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  /** The first bubble still in view, and where its top stood. */
  readonly anchor?: { readonly id: string; readonly top: number };
}

/** The first row any part of which is at or below the view's top edge. */
export function workshopThreadAnchor(
  rows: readonly WorkshopThreadRow[]
): { id: string; top: number } | undefined {
  const row = rows.find((candidate) => candidate.bottom > 0);
  return row ? { id: row.id, top: row.top } : undefined;
}

/**
 * The scroll position that puts the anchor back where it stood. Without an
 * anchor (no bubble was in view, or it is gone), the content's growth is
 * taken to be above the view.
 */
export function workshopScrollTopHoldingPlace(
  before: WorkshopThreadPlace,
  after: { scrollTop: number; scrollHeight: number; anchorTop?: number }
): number {
  const shift = before.anchor !== undefined && after.anchorTop !== undefined
    ? after.anchorTop - before.anchor.top
    : after.scrollHeight - before.scrollHeight;
  return Math.max(0, after.scrollTop + shift);
}

const rowsOf = (scroller: HTMLElement, rowAttribute: string): WorkshopThreadRow[] => {
  const edge = scroller.getBoundingClientRect().top;
  return [...scroller.querySelectorAll<HTMLElement>(`[${rowAttribute}]`)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { id: element.getAttribute(rowAttribute) ?? '', top: rect.top - edge, bottom: rect.bottom - edge };
  });
};

export function measureWorkshopThreadPlace(scroller: HTMLElement, rowAttribute: string): WorkshopThreadPlace {
  const anchor = workshopThreadAnchor(rowsOf(scroller, rowAttribute));
  return {
    scrollTop: scroller.scrollTop,
    scrollHeight: scroller.scrollHeight,
    ...(anchor ? { anchor } : {})
  };
}

export function restoreWorkshopThreadPlace(
  scroller: HTMLElement,
  rowAttribute: string,
  before: WorkshopThreadPlace
): void {
  const anchorTop = before.anchor
    ? rowsOf(scroller, rowAttribute).find((row) => row.id === before.anchor?.id)?.top
    : undefined;
  const next = workshopScrollTopHoldingPlace(before, {
    scrollTop: scroller.scrollTop,
    scrollHeight: scroller.scrollHeight,
    ...(anchorTop !== undefined ? { anchorTop } : {})
  });
  if (next !== scroller.scrollTop) {
    scroller.scrollTop = next;
  }
}
