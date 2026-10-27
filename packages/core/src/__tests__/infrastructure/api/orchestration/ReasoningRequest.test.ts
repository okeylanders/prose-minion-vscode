/**
 * A reasoning level as a request (ADR 2026-10-21, Amendment 2026-10-27):
 * the reply keeps its own ceiling and thinking gets its budget on top.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { REASONING_LEVELS } from '@/domain/models/ReasoningLevel';
import { reasoningBudget, reasoningRequest } from '@orchestration/ReasoningRequest';

describe('reasoningRequest', () => {
  it('turns thinking off with effort none, and leaves the reply its ceiling alone', () => {
    expect(reasoningRequest('off', 4_000)).toEqual({ maxTokens: 4_000, reasoning: { effort: 'none' } });
    expect(reasoningBudget('off')).toBe(0);
  });

  it('gives every other level its budget as reasoning.max_tokens, and adds it to the reply\'s ceiling', () => {
    expect(reasoningRequest('light', 4_000)).toEqual({ maxTokens: 5_024, reasoning: { maxTokens: 1_024 } });
    expect(reasoningRequest('standard', 8_000)).toEqual({ maxTokens: 12_000, reasoning: { maxTokens: 4_000 } });
    expect(reasoningRequest('deep', 8_000)).toEqual({ maxTokens: 20_000, reasoning: { maxTokens: 12_000 } });
  });

  it('names budgets that grow with the level, the lightest the smallest Anthropic accepts', () => {
    const budgets = REASONING_LEVELS.map(reasoningBudget);
    expect(budgets).toEqual([0, PROMPT_BUDGETS.reasoning.light, PROMPT_BUDGETS.reasoning.standard, PROMPT_BUDGETS.reasoning.deep]);
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets);
    expect(PROMPT_BUDGETS.reasoning.light).toBe(1_024);
  });
});
