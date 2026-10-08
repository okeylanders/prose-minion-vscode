/**
 * Fitting a session-recall read to the model's context window (ADR
 * 2026-10-05 D11): the largest read whose evidence, measured with the
 * context preflight's own estimator, costs at most half the room the
 * window has left. Pure; the caller renders.
 *
 * A first guess at four characters a token, then one proportional step,
 * fit most reads. Text of mixed density can defeat a proportional step:
 * fair shares move text between sessions as the limit shrinks, so one
 * dense session can stay whole while a plain one gives up text. When the
 * step misses, the third render is the minimum, which settles whether any
 * read fits; the rest narrow between the largest fit and the smallest miss
 * by their measured costs, keeping the largest fit measured. Running out
 * of renders never refuses a read that fit; only a minimum that does not
 * fit does (PR 130 review F-01).
 */

import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';

/** Renders one read may take to find the largest that fits the window. */
export const WORKSHOP_RECALL_CLAMP_RENDERS = 6;
/**
 * Close enough: the search stops once the largest fit uses all but this
 * share of half the window, or is within it of the smallest miss.
 */
const CLAMP_TOLERANCE = 0.02;

/** One rendering of a read under a character limit, and what it costs as evidence. */
export interface WorkshopRecallMeasuredRead {
  readonly characters: number;
  readonly outcome: WorkshopCapabilityResult;
  readonly tokens: number;
}

/** The largest read that fit, if any, and the minimum read when the search measured it. */
export interface WorkshopRecallWindowFit {
  readonly fit?: WorkshopRecallMeasuredRead;
  readonly minimum?: WorkshopRecallMeasuredRead;
  readonly renders: number;
}

/**
 * Search limits from `first` down to `minimum` for the largest read whose
 * measured cost is at most `half` tokens, rendering at most
 * WORKSHOP_RECALL_CLAMP_RENDERS times.
 */
export function fitWorkshopRecallReadToWindow(
  render: (characters: number) => WorkshopRecallMeasuredRead,
  first: number,
  half: number,
  minimum: number
): WorkshopRecallWindowFit {
  let fit: WorkshopRecallMeasuredRead | undefined;
  let miss: WorkshopRecallMeasuredRead | undefined;
  let measuredMinimum: WorkshopRecallMeasuredRead | undefined;
  let next: number | undefined = first;
  let renders = 0;
  while (next !== undefined && renders < WORKSHOP_RECALL_CLAMP_RENDERS) {
    const measured = render(next);
    renders += 1;
    if (next === minimum) {
      measuredMinimum = measured;
    }
    if (measured.tokens <= half) {
      fit = fit && fit.characters >= measured.characters ? fit : measured;
    } else {
      miss = miss && miss.characters <= measured.characters ? miss : measured;
    }
    next = nextCandidate(fit, miss, half, minimum, renders, measuredMinimum !== undefined);
  }
  return { ...(fit ? { fit } : {}), ...(measuredMinimum ? { minimum: measuredMinimum } : {}), renders };
}

/** What a result costs as evidence: its text and metadata, escaped as formatEvidence escapes them. */
export function workshopRecallEvidenceTokens(result: WorkshopCapabilityResult): number {
  const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return estimateTextTokens(escaped(result.content ?? '')) + estimateTextTokens(escaped(JSON.stringify(result.metadata ?? {})));
}

/**
 * The next limit to render, or none when the search is done: the largest
 * fit is the first guess, or close enough to the smallest miss, or the
 * minimum itself did not fit.
 */
function nextCandidate(
  fit: WorkshopRecallMeasuredRead | undefined,
  miss: WorkshopRecallMeasuredRead | undefined,
  half: number,
  minimum: number,
  renders: number,
  minimumMeasured: boolean
): number | undefined {
  if (!miss) {
    return undefined;
  }
  if (!fit) {
    // One proportional step down from the first guess; after that, or below
    // it, the minimum itself, which settles whether any read fits.
    const step = Math.min(Math.floor(miss.characters * (half / miss.tokens) * 0.98), miss.characters - 1);
    if (renders === 1 && step >= minimum) {
      return step;
    }
    return minimumMeasured || miss.characters <= minimum ? undefined : minimum;
  }
  if (
    fit.tokens >= half * (1 - CLAMP_TOLERANCE) ||
    miss.characters - fit.characters <= Math.max(1, Math.floor(miss.characters * CLAMP_TOLERANCE))
  ) {
    return undefined;
  }
  // Between the largest fit and the smallest miss, by their measured costs.
  const slope = (miss.tokens - fit.tokens) / (miss.characters - fit.characters);
  const guess = slope > 0 ? fit.characters + Math.floor(((half - fit.tokens) / slope) * 0.98) : fit.characters + 1;
  return Math.min(Math.max(guess, fit.characters + 1), miss.characters - 1);
}
