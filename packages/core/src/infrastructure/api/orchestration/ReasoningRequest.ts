/**
 * A reasoning level as a request (ADR 2026-10-21, Amendment 2026-10-27:
 * reasoning levels). The reply keeps its own ceiling and thinking gets its
 * budget on top: `off` sends `effort: 'none'` with the reply ceiling as
 * `max_tokens`; any other level sends its budget as `reasoning.max_tokens`
 * and the reply ceiling plus that budget as `max_tokens`. A level is a
 * request to the model, never a guarantee: some models take an effort only,
 * and some always reason.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ReasoningLevel } from '@/domain/models/ReasoningLevel';
import type { OpenRouterReasoningOptions } from '@providers/OpenRouterClient';

export interface ReasoningRequest {
  /** The request's whole output ceiling: the reply's, plus the thinking budget. */
  readonly maxTokens: number;
  readonly reasoning: OpenRouterReasoningOptions;
}

/** The thinking budget a level names: none for `off`. */
export function reasoningBudget(level: ReasoningLevel): number {
  return level === 'off' ? 0 : PROMPT_BUDGETS.reasoning[level];
}

export function reasoningRequest(level: ReasoningLevel, replyTokens: number): ReasoningRequest {
  const budget = reasoningBudget(level);
  return budget === 0
    ? { maxTokens: replyTokens, reasoning: { effort: 'none' } }
    : { maxTokens: replyTokens + budget, reasoning: { maxTokens: budget } };
}
