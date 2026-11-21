/**
 * The organizing pass's seam (ADR 2026-11-20 D12, D12a, D13). The pass is
 * one call over a run's checked instances, never the text. This module is
 * only the port the service calls (`PassageSearchModelOrganizer` implements
 * it) and the "no organizer" a service built without one holds, which makes
 * no call and leaves `analysis` absent.
 *
 * The service decides when the pass may start (D12a): inside a run only when
 * the reads ended `complete` or `instance-limit` with an instance and the
 * caller has not stopped; afterwards only on the caller's explicit
 * `planOrganize` and `organize`. An organizer never decides that itself.
 */

import type { TokenUsage } from '@messages';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
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
  /**
   * Exactly what the pass sends, as priced: a pass made of this plan sends
   * these messages and renders nothing again. Host-side only; a caller
   * shows the estimate, never these.
   */
  readonly systemMessage: string;
  readonly userMessage: string;
  /** The numbers of the instances the request shows, ascending. */
  readonly shown: readonly number[];
  /** The output ceiling the pass is sent with: frozen in the plan and its key, as a search plan's are. */
  readonly ceilings: { readonly organizeOutputTokens: number };
}

export type PassageSearchOrganizePlanOutcome =
  | { readonly kind: 'planned'; readonly plan: PassageSearchOrganizePlan }
  /** No pass can be made of this result; `message` is host words. */
  | { readonly kind: 'unavailable'; readonly message: string };

/**
 * The pass's calls as a run's read stage records its own: one entry per
 * call that came back or was stopped in flight, `undefined` for one whose
 * usage is not known. Empty when nothing was dispatched. A total is summed
 * from these and the reads' entries together, so an unknown entry in either
 * stage withholds the combined cost and is still counted as a request.
 */
export type PassageSearchPassUsages = ReadonlyArray<TokenUsage | undefined>;

/** What a pass that was started came to. */
export type PassageSearchOrganized =
  | { readonly kind: 'analysis'; readonly analysis: PassageSearchAnalysis; readonly usages: PassageSearchPassUsages }
  | { readonly kind: 'missing'; readonly reason: PassageSearchAnalysisMissing; readonly usages: PassageSearchPassUsages };

/** The engine a pass is sent on: the one a run holds, and what says its credentials were retired. */
export type PassageSearchPassEngine = Pick<AgentRunEngine, 'runInitial' | 'isProviderAvailable'>;

export interface PassageSearchOrganizer {
  /**
   * Whether a pass can be made at all. False, a plan asked to organize plans
   * no organizing call and prices no allowance for one.
   */
  readonly available: boolean;
  /** Price a pass over `result`. Sends nothing to a model. */
  plan(result: PassageSearchResult): Promise<PassageSearchOrganizePlanOutcome>;
  /**
   * Make the pass: one call on the result's model. `plan` is present when
   * the caller priced it first; inside a run it is absent, the pass having
   * been priced as an allowance, and `outputTokens` is the ceiling the
   * run's own plan froze for it. Undefined when no pass was made.
   *
   * `engine` is the engine a run holds, the one its reads were sent on: a
   * pass inside a run is sent on that engine or not at all, and is never
   * sent on whichever engine is current by then. Absent (the caller's own
   * later action), the organizer takes the current engine, once.
   */
  organize(
    result: PassageSearchResult,
    options: {
      readonly plan?: PassageSearchOrganizePlan;
      readonly outputTokens?: number;
      readonly engine?: PassageSearchPassEngine;
      readonly signal?: AbortSignal;
    }
  ): Promise<PassageSearchOrganized | undefined>;
}

/** No pass at all: nothing is sent, and a result keeps no analysis. */
export const NO_PASSAGE_SEARCH_ORGANIZER: PassageSearchOrganizer = {
  available: false,
  plan: async () => ({ kind: 'unavailable', message: 'Organizing the results is not available.' }),
  organize: async () => undefined
};
