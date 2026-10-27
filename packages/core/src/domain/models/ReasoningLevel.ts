/**
 * How much a model may think before it answers (ADR 2026-10-21, Amendment
 * 2026-10-27: reasoning levels). Named, never counted: only some models
 * honor a token count, and a level reads sensibly on all of them. Each
 * level but `off` names a thinking budget in `PROMPT_BUDGETS.reasoning`,
 * sent on top of the reply's own ceiling. Proofread and Craft Flags each read
 * one at the gesture; every other model scope sends none.
 */

export const REASONING_LEVELS = ['off', 'light', 'standard', 'deep'] as const;

export type ReasoningLevel = typeof REASONING_LEVELS[number];

export function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return typeof value === 'string' && (REASONING_LEVELS as readonly string[]).includes(value);
}

/** A setting's value as a level; anything else, an unset setting included, reads as `fallback`. */
export function reasoningLevelOf(value: unknown, fallback: ReasoningLevel): ReasoningLevel {
  return isReasoningLevel(value) ? value : fallback;
}
