/**
 * The one place the Workshop reads the engine's result (ADR 2026-11-20 D11,
 * D21). A card, a receipt, the directive and the report all take what this
 * module returns, so a change to the engine's result is a change here
 * alone.
 *
 * - **The view** is the sidebar's own display-safe projection
 *   (`passageSearchResultView`): display paths, lines, quotes, notes,
 *   labels and counts, never a host path or a file key. The shared report
 *   and the results directive both render it, so the persona and the writer
 *   read the same words.
 * - **Counts** for a card and a receipt are taken from that view: numbers
 *   and closed words only. A call stopped in flight is kept apart from one
 *   never made: it may still have been charged; one the engine's preflight
 *   refused before dispatch (`tooLarge`) used nothing. Files with an
 *   instance are kept apart from files searched and files planned (PR
 *   #296), as the shared report keeps them. `requests` is every call the
 *   result dispatched, reads and organizing passes (#295).
 * - **A persona's card offers no organize action** (D21): the view never
 *   says one may be offered.
 */

import type { PassageSearchResultView, WorkshopPassageSearchCounts } from '@messages';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { passageSearchResultView } from '@handlers/domain/PassageSearchViews';

/** The result as the report and the directive read it; `id` fills the view's own field and names nothing else. */
export function workshopPassageSearchView(result: PassageSearchResult, id: string): PassageSearchResultView {
  return passageSearchResultView(result, id, false);
}

/** A result in counts: what a card shows and a receipt keeps. Nothing of what was found. `requests` is the result's own. */
export function workshopPassageSearchCounts(view: PassageSearchResultView, requests: PassageSearchResult['requests']): WorkshopPassageSearchCounts {
  const { calls } = view;
  return {
    instances: view.instances.length,
    files: view.files.withInstances,
    searched: view.files.searched.full + view.files.searched.partial,
    filesPlanned: view.files.planned,
    labels: view.labels.length,
    dropped: Object.values(view.dropped).reduce((sum, count) => sum + count, 0),
    calls: {
      planned: calls.planned, answered: calls.answered, failed: calls.failed, cut: calls.cut, unsent: calls.unsent,
      cancelled: calls.cancelled, tooLarge: calls.tooLarge, dispatched: calls.dispatched
    },
    requests,
    ended: view.ended,
    organized: view.analysis !== undefined
  };
}
