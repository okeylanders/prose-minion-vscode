/**
 * A reply's edit offers (ADR 2026-11-10 D1, D2; epic Slice 1).
 *
 * A persona's reply that holds fixes or rewrites may end with one
 * `<prose-minion-edit-offer>` trailer per kind. Each frame that passes its
 * checks, and whose file the host resolved to one identity, becomes one
 * `WorkshopEditOffer` on the reply's turn (`WorkshopTurn.editOffers`), in
 * the order written: at most one per kind.
 *
 * - **`kind`** is the closed vocabulary `WORKSHOP_EDIT_OFFER_KINDS`.
 * - **`target`** is the host-owned identity the file resolved to when the
 *   reply was read (ADR 2026-11-05 D4.3): a `documentUri` the host wrote and
 *   the display `relativePath`. The webview's view omits `documentUri`
 *   (`workshopEditOfferForWebview`); host-side and on disk it is present.
 * - **`count`** is the persona's own, for a chip's label only. No check
 *   depends on it.
 *
 * An offer stores no state: whether it was used is read from the thread (D3).
 */

import type { WorkshopFileEditTarget } from './fileEdits';

/** What a reply may offer as edits: small fixes, or the rewrites it proposed. */
export const WORKSHOP_EDIT_OFFER_KINDS = ['fixes', 'rewrites'] as const;
export type WorkshopEditOfferKind = (typeof WORKSHOP_EDIT_OFFER_KINDS)[number];

export function isWorkshopEditOfferKind(value: unknown): value is WorkshopEditOfferKind {
  return WORKSHOP_EDIT_OFFER_KINDS.some((kind) => kind === value);
}

/** One declared, checked offer on a persona's reply. */
export interface WorkshopEditOffer {
  readonly kind: WorkshopEditOfferKind;
  /** The file, resolved once; `documentUri` is never in the webview's view. */
  readonly target: WorkshopFileEditTarget;
  /** The persona's own count, within `PROMPT_BUDGETS.workshopEditOffers.count`. */
  readonly count?: number;
}

/** An offer as the webview sees it: the display path, never the `documentUri` (ADR 2026-11-05 D4.3). */
export function workshopEditOfferForWebview(offer: WorkshopEditOffer): WorkshopEditOffer {
  return { ...offer, target: { kind: offer.target.kind, relativePath: offer.target.relativePath } };
}
