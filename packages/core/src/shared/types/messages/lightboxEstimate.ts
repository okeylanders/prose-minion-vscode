/**
 * The Lightbox run estimate (ADR 2026-10-19 D8; Slice 2B): fit and cost
 * before the press. Apart from the reading contract so that module stays
 * within its size (Slice 4); still exported from the `@messages` barrel.
 */

import type { LightboxLensId, LightboxReadingGroupId } from './lightboxReadings';

/** Whether a request fits the model's window: known yes, known no, or unknown (no live catalog). */
export type LightboxFit = 'fits' | 'too-large' | 'unknown';

/** One prospective call: a group with its lenses, or a single-lens re-read. */
export interface LightboxCallEstimate {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
  /** The engine's own estimate of the request (system and user messages). */
  inputTokens: number;
  /** What the reply typically runs to; prices the call. */
  expectedOutputTokens: number;
  /** What the engine reserves for the reply in its fit check (the call's output ceiling). */
  reservedOutputTokens: number;
  /**
   * Group F (Slice 4D): the call's input is priced at its bound, "up to".
   * The Opinion reads the board's digest, which is built only when the call
   * starts, after the other groups land; `inputTokens` reserves the
   * digest's whole bound (`PROMPT_BUDGETS.lightbox.opinionDigestTokens`).
   */
  inputBound?: 'digest';
  fit: LightboxFit;
  /** Absent when the catalog has no live pricing. */
  costUsd?: number;
}

export interface LightboxRunEstimate {
  boardId: string;
  /**
   * The identity of every input this estimate priced: the board and its
   * text, the lenses that are on, the context files, and the assistant model
   * with its window and prices (PR #149 F-02). Host-computed and opaque. A
   * press names the key of the estimate it was shown, and the host runs it
   * only while that key is still the current one, so a press never inherits
   * another model's price or another input's call count.
   */
  key: string;
  /** The assistant model the press would use. */
  model?: string;
  /** The model's live context length; absent when unknown. */
  contextLength?: number;
  /**
   * One per group with a lens on, in group order: what "Run AI analyses"
   * sends, and each call's own price (Slice 4I). A call run on its own (a
   * widget's Analyze, a call's Run) reads exactly these lenses when the lens
   * pressed is on, so its button shows this entry; the host fit-checks the
   * exact call again at the press.
   */
  groups: LightboxCallEstimate[];
  /** One per lens that is on: what "Re-read this tile" would send. */
  rereads: LightboxCallEstimate[];
  /** The worst fit across `groups`. */
  fit: LightboxFit;
  /** The groups' summed cost; absent when unavailable. */
  costUsd?: number;
  /** The source is over `PROMPT_BUDGETS.lightbox.chapterWords` (a warning, not a refusal). */
  bookSized: boolean;
  sourceWords: number;
  contextWords: number;
  /** When too large: about how many chapter words would fit with these lenses and this context. */
  largestFittingWords?: number;
  /** Writer-facing, when too large. */
  reason?: string;
}
