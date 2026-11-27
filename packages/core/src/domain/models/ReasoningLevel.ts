/**
 * How much a model may think before it answers (ADR 2026-10-21, Amendment
 * 2026-10-27: reasoning levels). Named, never counted: only some models
 * honor a token count, and a level reads sensibly on all of them. Each
 * level but `off` names a thinking budget in `PROMPT_BUDGETS.reasoning`,
 * sent on top of the reply's own ceiling. Proofread and Craft Flags each read
 * one at the gesture. Craft Flags uses Standard for a historical Off setting.
 * The helper asks for `off` (or `light` for a model that always reasons:
 * ADR 2026-11-05 D1, amended 2026-11-06).
 */

export const CRAFT_FLAGS_REASONING_LEVELS = ['light', 'standard', 'deep'] as const;
export const DEFAULT_CRAFT_FLAGS_REASONING = 'standard';
export const REASONING_LEVELS = ['off', ...CRAFT_FLAGS_REASONING_LEVELS] as const;

export type ReasoningLevel = typeof REASONING_LEVELS[number];

export function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return typeof value === 'string' && (REASONING_LEVELS as readonly string[]).includes(value);
}

/** A setting's value as a level; anything else, an unset setting included, reads as `fallback`. */
export function reasoningLevelOf(value: unknown, fallback: ReasoningLevel): ReasoningLevel {
  return isReasoningLevel(value) ? value : fallback;
}

export function craftFlagsReasoningLevelOf(value: unknown): typeof CRAFT_FLAGS_REASONING_LEVELS[number] {
  const level = reasoningLevelOf(value, DEFAULT_CRAFT_FLAGS_REASONING);
  return level === 'off' ? DEFAULT_CRAFT_FLAGS_REASONING : level;
}
