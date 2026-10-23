/**
 * Group F's wire vocabulary (ADR 2026-10-19 D6, D7 addendum; Slice 4D):
 * the Opinion's keys and shapes as a response gives them (unverified, still
 * the model's word). Beside `LightboxReadingWire`, which holds the frame
 * and the other groups' shapes. The ceilings are `PROMPT_BUDGETS.lightbox`.
 */

import type { LightboxOpinionViewId, LightboxOpinionWeight } from '@messages';

/** An observation's key, unique in its block: the shared grammar (Slice 4H). */
export { LIGHTBOX_OPINION_OBSERVATION_ID } from '@shared/constants/lightboxOpinion';

/** The fewest observations an Opinion gives (the prompt asks for at most `opinionObservations`). */
export const LIGHTBOX_OPINION_MINIMUM_OBSERVATIONS = 2;

/** A cite as written: a tile by its host id (maybe one of its quotes, by index), or a measured figure by its ref. */
export type LightboxDecodedOpinionCite =
  | { tile: string; quote?: number }
  | { measured: string };

export interface LightboxDecodedObservation {
  id: string;
  text: string;
  cites: LightboxDecodedOpinionCite[];
}

export interface LightboxDecodedWhy {
  weight: LightboxOpinionWeight;
  text: string;
  observations: string[];
}

export interface LightboxDecodedOpinionView {
  headline: string;
  body: string;
  why: LightboxDecodedWhy[];
}

export interface LightboxDecodedOpinionBlock {
  lens: 'opinion';
  observations: LightboxDecodedObservation[];
  /** Observations that broke the format, by their id where they gave a well-formed one, else by position. */
  malformed: Array<{ id: string; reason: string }>;
  /** Each view decoded on its own: its value, or its fault in host words (which withholds it alone). */
  views: Record<LightboxOpinionViewId, { value: LightboxDecodedOpinionView } | { fault: string }>;
  friction: string;
}
