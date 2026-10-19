/**
 * The Lightbox reading run's contracts (ADR 2026-10-19 D6): what a run reads
 * (host-private), how each group settles, what the listener hears, the
 * engine and catalog surfaces it uses, and how usage is summed. Shared by
 * the runner, the reading-state transitions and the handler.
 */

import type {
  LightboxActiveRun,
  LightboxReadingGroupId,
  LightboxLensFriction,
  LightboxLensQuoteChecks,
  LightboxReadingTile,
  LightboxWithheldBlock,
  LightboxWithheldClaim,
  TokenUsage
} from '@messages';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import type { LightboxGroupRequest, LightboxReadingMaterial } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import type { LightboxModelFacts, LightboxModelPricing } from '@/infrastructure/lightbox/LightboxRunEstimate';

/** The engine surface the runner uses. */
export interface LightboxReadingEngines {
  getEngine(scope: 'assistant'): Pick<AgentRunEngine, 'runInitial'> | undefined;
  getResolvedModel(scope: 'assistant'): string | undefined;
}

/** The live model catalog, as the estimate reads it. */
export interface LightboxModelCatalog {
  contextLength(model: string): number | undefined;
  pricing(model: string): LightboxModelPricing | undefined;
}

export const OPENROUTER_LIGHTBOX_CATALOG: LightboxModelCatalog = {
  contextLength: (model) => OpenRouterModels.getCachedContextLength(model),
  pricing: (model) => OpenRouterModels.getCachedPricing(model)
};

/** A board's text as a run reads it. Host-private: never posted. */
export interface LightboxRunSource {
  boardId: string;
  material: LightboxReadingMaterial;
  sourceWords: number;
  contextWords: number;
  /** Set beside the voice's sentence music. */
  averageWordsPerSentence: number;
}

/** How one group's call settled. Cancellation is not an outcome: a stopped group reports nothing. */
export interface LightboxGroupOutcome {
  group: LightboxReadingGroupId;
  lenses: LightboxGroupRequest['lenses'];
  status: 'ok' | 'failed';
  tiles: LightboxReadingTile[];
  withheldBlocks: LightboxWithheldBlock[];
  withheldClaims: LightboxWithheldClaim[];
  frictions: LightboxLensFriction[];
  /** Writer-facing, for a failed group. */
  error?: string;
  model?: string;
  usage?: TokenUsage;
  /** Per lens; empty for a failed call. */
  quoteChecks: LightboxLensQuoteChecks[];
}

export interface LightboxRunSummary {
  outcomes: LightboxGroupOutcome[];
  /** Every settled call's usage, summed; absent when no call reported any. */
  usage?: TokenUsage;
}

export interface LightboxRunListener {
  /** A group settled while its run is still the board's active one. */
  onGroup(outcome: LightboxGroupOutcome): void;
  /** Throttled: the run's streamed characters so far. */
  onProgress(outputCharacters: number): void;
  /** Every group settled, and the run was not stopped. */
  onFinished(summary: LightboxRunSummary): void;
}

export type LightboxRunStart =
  | { started: true; run: LightboxActiveRun; done: Promise<void> }
  | { started: false; message: string };

/**
 * A press's hold on its board, from before its prompt files load until its
 * run ends (PR #149 F-02). Opaque: compared by identity, so it cannot be
 * forged.
 */
export interface LightboxRunReservation {
  readonly run: LightboxActiveRun;
}

export type LightboxRunReserve =
  | { reserved: true; reservation: LightboxRunReservation }
  | { reserved: false; message: string };

/** What an estimate priced: the model facts it read, and the key naming every priced input. */
export interface LightboxPricedSnapshot {
  facts: LightboxModelFacts;
  key: string;
}


/** Sum usage the way the Dictionary's fan-out does; an unreported cache count makes the total unknown. */
export function sumUsage(usages: ReadonlyArray<TokenUsage | undefined>): TokenUsage | undefined {
  const reported = usages.filter((usage): usage is TokenUsage => usage !== undefined);
  if (reported.length === 0) {
    return undefined;
  }
  const optionalSum = (pick: (usage: TokenUsage) => number | undefined): number | undefined =>
    reported.every((usage) => pick(usage) !== undefined)
      ? reported.reduce((sum, usage) => sum + (pick(usage) as number), 0)
      : undefined;
  const cachedTokens = optionalSum((usage) => usage.cachedTokens);
  const cacheWriteTokens = optionalSum((usage) => usage.cacheWriteTokens);
  return {
    promptTokens: reported.reduce((sum, usage) => sum + usage.promptTokens, 0),
    completionTokens: reported.reduce((sum, usage) => sum + usage.completionTokens, 0),
    totalTokens: reported.reduce((sum, usage) => sum + usage.totalTokens, 0),
    costUsd: reported.reduce((sum, usage) => sum + (usage.costUsd ?? 0), 0),
    requestCount: reported.reduce((sum, usage) => sum + (usage.requestCount ?? 1), 0),
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {})
  };
}
