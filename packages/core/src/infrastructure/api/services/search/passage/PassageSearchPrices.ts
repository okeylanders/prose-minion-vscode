/**
 * What Passage Search asks the model catalog (ADR 2026-11-20 D5a, D14): a
 * model's live prices, for the estimate, and its context length, so every
 * read call fits half the window. A port of the engine's own: the live
 * catalog in the extension, a fake in tests, which never reach it.
 */

import { OpenRouterModels } from '@providers/OpenRouterModels';
import type { LogSink } from '@/platform';
import type { PassageSearchPricing } from '@services/search/passage/PassageSearchContracts';

export interface PassageSearchModelFacts {
  /** Absent when the catalog has no live price for the model (offline, or a model it does not list). */
  readonly pricing?: PassageSearchPricing;
  /** Absent when the catalog does not know the model's window; the chunk budget then stands as it is. */
  readonly contextLength?: number;
}

export interface PassageSearchPriceSource {
  facts(model: string): Promise<PassageSearchModelFacts>;
}

/** The live catalog, fetched once if nothing has fetched it yet (a free request, never billable). */
export function liveCatalogFacts(log: LogSink): PassageSearchPriceSource {
  return {
    async facts(model: string): Promise<PassageSearchModelFacts> {
      await OpenRouterModels.fetchModels(log);
      const pricing = OpenRouterModels.getCachedPricing(model);
      const contextLength = OpenRouterModels.getCachedContextLength(model);
      return { ...(pricing ? { pricing } : {}), ...(contextLength !== undefined ? { contextLength } : {}) };
    }
  };
}
