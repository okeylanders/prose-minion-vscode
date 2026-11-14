/**
 * Fitting a read to the model's context window (ADR 2026-10-05 D11; ADR
 * 2026-11-14 D1): the largest read whose evidence, measured with the
 * context preflight's own estimator, costs at most half the room the
 * window has left. Pure; the caller renders. Session recall measures a
 * read's size in characters and a file read in bytes; the search is the
 * same.
 *
 * A first guess at four characters a token, then one proportional step,
 * fit most reads. Text of mixed density can defeat a proportional step:
 * fair shares move text between sections as the limit shrinks, so one
 * dense section can stay whole while a plain one gives up text. When the
 * step misses, the third render is the minimum, which settles whether any
 * read fits; the rest narrow between the largest fit and the smallest miss
 * by their measured costs, keeping the largest fit measured. Running out
 * of renders never refuses a read that fit; only a minimum that does not
 * fit does (PR 130 review F-01).
 */

import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';

/** Renders one read may take to find the largest that fits the window. */
export const WORKSHOP_READ_FIT_RENDERS = 6;
/**
 * Close enough: the search stops once the largest fit uses all but this
 * share of half the window, or is within it of the smallest miss.
 */
const FIT_TOLERANCE = 0.02;

/** One rendering of a read under a size limit (characters or bytes), and what it costs as evidence. */
export interface WorkshopMeasuredRead {
  readonly size: number;
  readonly outcome: WorkshopCapabilityResult;
  readonly tokens: number;
}

/** The largest read that fit, if any, and the minimum read when the search measured it. */
export interface WorkshopReadWindowFit {
  readonly fit?: WorkshopMeasuredRead;
  readonly minimum?: WorkshopMeasuredRead;
  readonly renders: number;
}

/**
 * Search limits from `first` down to `minimum` for the largest read whose
 * measured cost is at most `half` tokens, rendering at most
 * WORKSHOP_READ_FIT_RENDERS times.
 */
export function fitWorkshopReadToWindow(
  render: (size: number) => WorkshopMeasuredRead,
  first: number,
  half: number,
  minimum: number
): WorkshopReadWindowFit {
  let fit: WorkshopMeasuredRead | undefined;
  let miss: WorkshopMeasuredRead | undefined;
  let measuredMinimum: WorkshopMeasuredRead | undefined;
  let next: number | undefined = first;
  let renders = 0;
  while (next !== undefined && renders < WORKSHOP_READ_FIT_RENDERS) {
    const measured = render(next);
    renders += 1;
    if (next === minimum) {
      measuredMinimum = measured;
    }
    if (measured.tokens <= half) {
      fit = fit && fit.size >= measured.size ? fit : measured;
    } else {
      miss = miss && miss.size <= measured.size ? miss : measured;
    }
    next = nextCandidate(fit, miss, half, minimum, renders, measuredMinimum !== undefined);
  }
  return { ...(fit ? { fit } : {}), ...(measuredMinimum ? { minimum: measuredMinimum } : {}), renders };
}

/** What a result costs as evidence: its text and metadata, escaped as formatEvidence escapes them. */
export function workshopReadEvidenceTokens(result: WorkshopCapabilityResult): number {
  const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return estimateTextTokens(escaped(result.content ?? '')) + estimateTextTokens(escaped(JSON.stringify(result.metadata ?? {})));
}

/**
 * The next limit to render, or none when the search is done: the largest
 * fit is the first guess, or close enough to the smallest miss, or the
 * minimum itself did not fit.
 */
function nextCandidate(
  fit: WorkshopMeasuredRead | undefined,
  miss: WorkshopMeasuredRead | undefined,
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
    const step = Math.min(Math.floor(miss.size * (half / miss.tokens) * 0.98), miss.size - 1);
    if (renders === 1 && step >= minimum) {
      return step;
    }
    return minimumMeasured || miss.size <= minimum ? undefined : minimum;
  }
  if (
    fit.tokens >= half * (1 - FIT_TOLERANCE) ||
    miss.size - fit.size <= Math.max(1, Math.floor(miss.size * FIT_TOLERANCE))
  ) {
    return undefined;
  }
  // Between the largest fit and the smallest miss, by their measured costs.
  const slope = (miss.tokens - fit.tokens) / (miss.size - fit.size);
  const guess = slope > 0 ? fit.size + Math.floor(((half - fit.tokens) / slope) * 0.98) : fit.size + 1;
  return Math.min(Math.max(guess, fit.size + 1), miss.size - 1);
}
