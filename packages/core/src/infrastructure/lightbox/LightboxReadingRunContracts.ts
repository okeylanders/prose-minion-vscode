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
import type { LightboxOpinionDigest } from '@/infrastructure/lightbox/LightboxOpinionDigest';

/**
 * The engine surface the runner uses: the Lightbox's own model scope (Slice
 * 4L), never the assistant's, so a Lightbox model never moves the Workshop's.
 */
export interface LightboxReadingEngines {
  getEngine(scope: 'lightbox'): Pick<AgentRunEngine, 'runInitial'> | undefined;
  getResolvedModel(scope: 'lightbox'): string | undefined;
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
  /**
   * Group F (Slice 4D): the key of the digest the call read
   * (`LightboxOpinionDigest.key`), so its landing is correlated with the
   * board it weighed as well as the run that read it.
   */
  digestKey?: string;
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

/**
 * What group F reads (Slice 4D): the board's digest, built from the board as
 * it stands when F starts, after every other group of its run has settled.
 * Supplied by the press's owner, which holds the board; `refusal` is why
 * there is nothing to weigh (writer-facing), and nothing is sent then.
 */
export interface LightboxOpinionPort {
  digest(): LightboxOpinionDigest | { refusal: string };
}

/** What a run is started with beyond its calls. */
export interface LightboxRunOptions {
  /** Group F's board; without it, an F call fails with nothing sent. */
  opinion?: LightboxOpinionPort;
}

/**
 * A started run's `done` settles once every group has, and never rejects
 * (PR #149 F-10); the listener hears nothing before `start` returns.
 */
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

/** A group that failed, with the writer-facing reason, and the model and usage of a call that came back. */
export function failedLightboxGroup(
  call: Pick<LightboxGroupRequest, 'group' | 'lenses'>,
  error: string,
  result?: { modelId?: string; usage?: TokenUsage }
): LightboxGroupOutcome {
  return {
    group: call.group,
    lenses: call.lenses,
    status: 'failed',
    tiles: [],
    withheldBlocks: [],
    withheldClaims: [],
    frictions: [],
    error,
    ...(result?.modelId ? { model: result.modelId } : {}),
    ...(result?.usage ? { usage: result.usage } : {}),
    quoteChecks: []
  };
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
