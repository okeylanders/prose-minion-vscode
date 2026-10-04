import type { OpenRouterMessage } from '@providers/OpenRouterChatContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';

/** Prose-oriented estimate; byte and word checks keep long words/Unicode from disappearing. */
export function estimateRequestTokens(messages: readonly OpenRouterMessage[], tools?: unknown): number {
  const budgets = PROMPT_BUDGETS.inferenceContext;
  const estimate = (text: string): number => Math.ceil(Math.max(
    Buffer.byteLength(text, 'utf8') / budgets.bytesPerToken,
    countWords(text) * budgets.tokensPerWord
  ));
  return messages.reduce((total, message) =>
    total + estimate(message.content) + budgets.messageOverheadTokens, 0)
    + (tools ? estimate(JSON.stringify(tools)) : 0);
}

export class AgentContextWindowExceededError extends Error {
  constructor(readonly inputTokens: number, readonly outputTokens: number, readonly contextLength: number) {
    super(`This request is estimated at ${inputTokens.toLocaleString('en-US')} input tokens plus ` +
      `${outputTokens.toLocaleString('en-US')} reserved output tokens, exceeding the selected model's ` +
      `${contextLength.toLocaleString('en-US')}-token window with safety headroom. ` +
      'Shorten new inputs, start a fresh room, or switch to a model with a larger window. This inference was not sent.');
    this.name = 'AgentContextWindowExceededError';
  }
}

export function assertRequestFitsContext(
  messages: readonly OpenRouterMessage[], contextLength: number, outputTokens?: number, tools?: unknown
): void {
  const input = estimateRequestTokens(messages, tools);
  const output = outputTokens ?? PROMPT_BUDGETS.inferenceContext.defaultOutputTokens;
  const headroom = Math.ceil(contextLength * PROMPT_BUDGETS.inferenceContext.headroomFraction);
  if (input + output + headroom > contextLength) {
    throw new AgentContextWindowExceededError(input, output, contextLength);
  }
}
