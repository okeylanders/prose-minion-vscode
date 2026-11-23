/**
 * From a stored card to the engine's request, and from the engine's plan to
 * what the card shows (ADR 2026-11-20 D20). Pure.
 *
 * - **Only three kinds of scope leave the Workshop:** a context group, a
 *   configured file by catalog key, and the room's excerpt by value. A path
 *   or pattern the writer never typed is never built here: a persona's
 *   words can only name what the project's context paths already hold.
 * - **The excerpt is read when the plan is made,** so the plan prices the
 *   passage the room holds now.
 * - **The search organizes its results** when the engine can: the price the
 *   card shows says so.
 */

import type { WorkshopPassageSearchEstimateView, WorkshopPassageSearchRequest } from '@messages';
import type { PassageSearchRequest, PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';
import type { PassageSearchPlan } from '@services/search/passage/PassageSearchContracts';
import { describePassageSearchLeftOut } from '@services/search/passage/PassageSearchRefusals';

/** What a search's results call the room's excerpt. */
export const WORKSHOP_PASSAGE_SEARCH_EXCERPT_LABEL = 'Excerpt';

/** The engine's request for a card; `no-excerpt` when the card names the excerpt and the room has none now. */
export function workshopPassageSearchEngineRequest(
  card: Pick<WorkshopPassageSearchRequest, 'question' | 'scopes'>,
  excerptText: string | undefined
): PassageSearchRequest | 'no-excerpt' {
  const scopes: PassageSearchScope[] = [];
  for (const scope of card.scopes) {
    if (scope.kind === 'group') {
      scopes.push({ kind: 'group', group: scope.group });
    } else if (scope.kind === 'file') {
      scopes.push({ kind: 'file', file: { group: scope.group, path: scope.path } });
    } else if (excerptText !== undefined && excerptText.trim().length > 0) {
      scopes.push({ kind: 'text', label: WORKSHOP_PASSAGE_SEARCH_EXCERPT_LABEL, text: excerptText });
    } else {
      return 'no-excerpt';
    }
  }
  return { question: card.question, scopes, organize: true };
}

/** A plan as the card shows it: the key, the counts, the price when one is known, and the model. */
export function workshopPassageSearchEstimateView(plan: PassageSearchPlan): WorkshopPassageSearchEstimateView {
  const { estimate } = plan;
  const leftOut = describePassageSearchLeftOut(estimate.leftOut);
  return {
    planKey: plan.planKey,
    calls: estimate.calls,
    files: estimate.files,
    model: estimate.model,
    ...(estimate.usd !== undefined ? { usd: estimate.usd } : {}),
    ...(leftOut ? { leftOut } : {}),
    organizes: estimate.organize !== undefined
  };
}
