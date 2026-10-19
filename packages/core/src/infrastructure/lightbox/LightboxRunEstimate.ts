/**
 * Fit and cost before the press (ADR 2026-10-19 D8). Pure: no host, no I/O.
 *
 * Each prospective call is measured with the engine's own estimator
 * (`measureContextWindow` over the exact system and user messages the call
 * would send) against the assistant model's cached context length, reserving
 * the call's output ceiling and the preflight's headroom, so "fits" here
 * means the engine's per-call preflight would pass. An unknown context length
 * (no live catalog) is `unknown`, and the press stays allowed, matching the
 * engine's own rule. Cost is estimated input tokens times the catalog's
 * prompt price plus typical output tokens times its completion price, or
 * absent when the catalog has no live pricing.
 */

import type {
  LightboxCallEstimate,
  LightboxFit,
  LightboxLensId,
  LightboxReadingGroupId,
  LightboxRunEstimate
} from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { estimateRequestTokens, measureContextWindow } from '@orchestration/RequestContextPreflight';

/** What a model costs per token, from the live catalog. */
export interface LightboxModelPricing {
  promptUsdPerToken: number;
  completionUsdPerToken: number;
}

export interface LightboxModelFacts {
  model?: string;
  contextLength?: number;
  pricing?: LightboxModelPricing;
}

/** One call's exact messages, ready to measure (and to send). */
export interface LightboxPreparedCall {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
  systemMessage: string;
  userMessage: string;
  /** The estimator's tokens for the chapter section alone. */
  chapterTokens: number;
}

/** Everything an estimate prices, and so everything a press must still find unchanged (PR #149 F-02). */
export interface LightboxPricedInputs {
  boardId: string;
  contentHash: string;
  lensesOff: readonly LightboxLensId[];
  /** `LightboxContextShelf.revision()`. */
  contextRevision: number;
  facts: LightboxModelFacts;
}

/**
 * The estimate's key: one string that changes whenever any priced input
 * does. Deterministic, so the host can recompute it at a press and again
 * just before the engine starts, and compare.
 */
export function lightboxEstimateKey(inputs: LightboxPricedInputs): string {
  const lensesOn = LIGHTBOX_LENSES.map((lens) => lens.id).filter((lens) => !inputs.lensesOff.includes(lens));
  return JSON.stringify([
    inputs.boardId,
    inputs.contentHash,
    lensesOn,
    inputs.contextRevision,
    inputs.facts.model ?? null,
    inputs.facts.contextLength ?? null,
    inputs.facts.pricing?.promptUsdPerToken ?? null,
    inputs.facts.pricing?.completionUsdPerToken ?? null
  ]);
}

export interface LightboxEstimateInput {
  boardId: string;
  /** `lightboxEstimateKey` of the inputs this estimate prices. */
  key: string;
  sourceWords: number;
  contextWords: number;
  columnCount: number;
  groups: readonly LightboxPreparedCall[];
  rereads: readonly LightboxPreparedCall[];
  facts: LightboxModelFacts;
}

/**
 * What each lens's reply typically runs to, in tokens, before the tension
 * arc's per-column scores. Estimator inputs that price a call, not limits:
 * a reply may run to the call's output ceiling. To be recalibrated against
 * the processed chip in the live pass (Slice 6).
 */
export const LIGHTBOX_TYPICAL_OUTPUT_TOKENS: Readonly<Record<LightboxLensId, number>> = {
  headline: 180,
  motif: 900,
  tension: 260,
  palette: 760,
  gravity: 1_500,
  characters: 1_000,
  voice: 420,
  genre: 820
};

/** Each tension score and its comma. */
const TENSION_TOKENS_PER_COLUMN = 2;
/** The sentinels and the JSON root. */
const FRAME_TOKENS = 40;

export function lightboxExpectedOutputTokens(lenses: readonly LightboxLensId[], columnCount: number): number {
  return lenses.reduce(
    (sum, lens) => sum + LIGHTBOX_TYPICAL_OUTPUT_TOKENS[lens] + (lens === 'tension' ? TENSION_TOKENS_PER_COLUMN * columnCount : 0),
    FRAME_TOKENS
  );
}

interface MeasuredCall {
  estimate: LightboxCallEstimate;
  /** Tokens the chapter could grow to and still fit, when the window is known. */
  chapterRoomTokens?: number;
  chapterTokens: number;
}

function measureCall(call: LightboxPreparedCall, facts: LightboxModelFacts, columnCount: number): MeasuredCall {
  const reserved = PROMPT_BUDGETS.lightbox.groupOutputTokens;
  const expected = lightboxExpectedOutputTokens(call.lenses, columnCount);
  const messages = [
    { role: 'system' as const, content: call.systemMessage },
    { role: 'user' as const, content: call.userMessage }
  ];
  let fit: LightboxFit = 'unknown';
  let inputTokens: number;
  let chapterRoomTokens: number | undefined;
  if (facts.contextLength !== undefined) {
    const window = measureContextWindow(messages, facts.contextLength, reserved);
    inputTokens = window.requestTokens;
    fit = window.requestTokens + window.outputTokens + window.headroomTokens <= facts.contextLength ? 'fits' : 'too-large';
    chapterRoomTokens = facts.contextLength - window.headroomTokens - window.outputTokens - (inputTokens - call.chapterTokens);
  } else {
    inputTokens = estimateRequestTokens(messages);
  }
  const costUsd = facts.pricing
    ? inputTokens * facts.pricing.promptUsdPerToken + expected * facts.pricing.completionUsdPerToken
    : undefined;
  return {
    estimate: {
      group: call.group,
      lenses: [...call.lenses],
      inputTokens,
      expectedOutputTokens: expected,
      reservedOutputTokens: reserved,
      fit,
      ...(costUsd !== undefined ? { costUsd } : {})
    },
    chapterRoomTokens,
    chapterTokens: call.chapterTokens
  };
}

export function estimateLightboxRun(input: LightboxEstimateInput): LightboxRunEstimate {
  const groups = input.groups.map((call) => measureCall(call, input.facts, input.columnCount));
  const rereads = input.rereads.map((call) => measureCall(call, input.facts, input.columnCount).estimate);
  const fits = groups.map((measured) => measured.estimate.fit);
  const fit: LightboxFit = fits.includes('too-large') ? 'too-large' : fits.includes('unknown') ? 'unknown' : 'fits';
  const costs = groups.map((measured) => measured.estimate.costUsd);
  const costUsd = costs.length > 0 && costs.every((cost) => cost !== undefined)
    ? costs.reduce<number>((sum, cost) => sum + (cost as number), 0)
    : undefined;

  const estimate: LightboxRunEstimate = {
    boardId: input.boardId,
    key: input.key,
    ...(input.facts.model ? { model: input.facts.model } : {}),
    ...(input.facts.contextLength !== undefined ? { contextLength: input.facts.contextLength } : {}),
    groups: groups.map((measured) => measured.estimate),
    rereads,
    fit,
    ...(costUsd !== undefined ? { costUsd } : {}),
    bookSized: input.sourceWords > PROMPT_BUDGETS.lightbox.chapterWords,
    sourceWords: input.sourceWords,
    contextWords: input.contextWords
  };
  if (fit === 'too-large') {
    const worst = groups
      .filter((measured) => measured.estimate.fit === 'too-large')
      .sort((a, b) => (a.chapterRoomTokens ?? 0) - (b.chapterRoomTokens ?? 0))[0];
    estimate.largestFittingWords = largestFittingWords(worst, input.sourceWords);
    estimate.reason = tooLargeReason(worst.estimate, input.facts, estimate.largestFittingWords, input.contextWords);
  }
  return estimate;
}

/** About how many chapter words fit beside this call's lenses and context, rounded down to a hundred. */
function largestFittingWords(measured: MeasuredCall, sourceWords: number): number {
  const room = measured.chapterRoomTokens ?? 0;
  if (room <= 0 || measured.chapterTokens <= 0 || sourceWords <= 0) {
    return 0;
  }
  const tokensPerWord = measured.chapterTokens / sourceWords;
  return Math.max(0, Math.floor(room / tokensPerWord / 100) * 100);
}

function tooLargeReason(
  call: LightboxCallEstimate,
  facts: LightboxModelFacts,
  largestWords: number,
  contextWords: number
): string {
  const model = facts.model ?? 'the assistant model';
  const window = (facts.contextLength ?? 0).toLocaleString('en-US');
  const sent = `Group ${call.group} would send about ${call.inputTokens.toLocaleString('en-US')} tokens and ` +
    `reserve ${call.reservedOutputTokens.toLocaleString('en-US')} for the reply, more than ${model}'s ` +
    `${window}-token window allows.`;
  if (largestWords <= 0) {
    return contextWords > 0
      ? `${sent} The context files alone fill the window: remove some, or choose a model with a larger window.`
      : `${sent} Choose a model with a larger window.`;
  }
  return `${sent} With these lenses${contextWords > 0 ? ' and this context' : ''}, about ` +
    `${largestWords.toLocaleString('en-US')} words of chapter would fit. Choose a shorter passage, ` +
    'turn off lenses, or choose a model with a larger window.';
}
