/**
 * The organizing pass's seam (ADR 2026-11-20 D12, D12a, D13). The pass is
 * one call over a run's checked instances, never the text; Slice 3 builds
 * it. This module is only the port the service calls and the "no organizer"
 * it holds until then, which makes no call and leaves `analysis` absent.
 *
 * The service decides when the pass may start (D12a): inside a run only when
 * the reads ended `complete` or `instance-limit` with an instance and the
 * caller has not stopped; afterwards only on the caller's explicit
 * `planOrganize` and `organize`. An organizer never decides that itself.
 */

import type { TokenUsage } from '@messages';
import type {
  PassageSearchAnalysis,
  PassageSearchAnalysisMissing,
  PassageSearchResult
} from '@services/search/passage/PassageSearchContracts';

/** A pass over an existing result, priced exactly: its instances exist (D12a). */
export interface PassageSearchOrganizePlan {
  /** A digest of what was shown and what would be sent, as a search plan's is. */
  readonly planKey: string;
  readonly model: string;
  readonly estimate: {
    readonly model: string;
    readonly calls: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly usd?: number;
  };
  /** How many instances the pass would be shown, of how many the result holds. */
  readonly instances: { readonly read: number; readonly of: number };
}

export type PassageSearchOrganizePlanOutcome =
  | { readonly kind: 'planned'; readonly plan: PassageSearchOrganizePlan }
  /** No pass can be made of this result; `message` is host words. */
  | { readonly kind: 'unavailable'; readonly message: string };

/** What a pass that was started came to. */
export type PassageSearchOrganized =
  | { readonly kind: 'analysis'; readonly analysis: PassageSearchAnalysis; readonly usage?: TokenUsage }
  | { readonly kind: 'missing'; readonly reason: PassageSearchAnalysisMissing; readonly usage?: TokenUsage };

export interface PassageSearchOrganizer {
  /** Price a pass over `result`. Sends nothing to a model. */
  plan(result: PassageSearchResult): Promise<PassageSearchOrganizePlanOutcome>;
  /**
   * Make the pass: one call on the result's model. `plan` is present when
   * the caller priced it first; inside a run it is absent, the pass having
   * been priced as an allowance. Undefined when no pass was made.
   */
  organize(
    result: PassageSearchResult,
    options: { readonly plan?: PassageSearchOrganizePlan; readonly signal?: AbortSignal }
  ): Promise<PassageSearchOrganized | undefined>;
}

/** Until the pass is built: nothing is sent, and a result keeps no analysis. */
export const NO_PASSAGE_SEARCH_ORGANIZER: PassageSearchOrganizer = {
  plan: async () => ({ kind: 'unavailable', message: 'Organizing the results is not available yet.' }),
  organize: async () => undefined
};
