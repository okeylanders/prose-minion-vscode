import type { OpenRouterMessage } from '@providers/OpenRouterChatContracts';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';

/** Prose-oriented estimate; byte and word checks keep long words/Unicode from disappearing. */
export function estimateTextTokens(text: string): number {
  const budgets = PROMPT_BUDGETS.inferenceContext;
  return Math.ceil(Math.max(
    Buffer.byteLength(text, 'utf8') / budgets.bytesPerToken,
    countWords(text) * budgets.tokensPerWord
  ));
}

export function estimateRequestTokens(messages: readonly OpenRouterMessage[], tools?: unknown): number {
  return messages.reduce((total, message) =>
    total + estimateTextTokens(message.content) + PROMPT_BUDGETS.inferenceContext.messageOverheadTokens, 0)
    + (tools ? estimateTextTokens(JSON.stringify(tools)) : 0);
}

/**
 * What `messages` leave of a model's window, by the rule
 * assertRequestFitsContext applies: the window, less the request, the
 * reserved output, and the safety headroom. Evidence up to
 * `freeInputTokens` added to these messages still passes the preflight.
 */
export function measureContextWindow(
  messages: readonly OpenRouterMessage[], contextLength: number, outputTokens?: number, tools?: unknown
): CapabilityContextWindow {
  const requestTokens = estimateRequestTokens(messages, tools);
  const output = outputTokens ?? PROMPT_BUDGETS.inferenceContext.defaultOutputTokens;
  const headroomTokens = Math.ceil(contextLength * PROMPT_BUDGETS.inferenceContext.headroomFraction);
  return {
    contextLength,
    requestTokens,
    outputTokens: output,
    headroomTokens,
    freeInputTokens: Math.max(0, contextLength - requestTokens - output - headroomTokens)
  };
}

export class AgentContextWindowExceededError extends Error {
  constructor(readonly inputTokens: number, readonly outputTokens: number, readonly contextLength: number) {
    super(`This request is estimated at ${inputTokens.toLocaleString('en-US')} input tokens plus ` +
      `${outputTokens.toLocaleString('en-US')} reserved output tokens, exceeding the selected model's ` +
      `${contextLength.toLocaleString('en-US')}-token window with safety headroom. ` +
      'Reduce standing context or the excerpt, or switch to a model with a larger window. ' +
      'For a long conversation, start a fresh room with fewer inputs. This inference was not sent.');
    this.name = 'AgentContextWindowExceededError';
  }
}

export function assertRequestFitsContext(
  messages: readonly OpenRouterMessage[], contextLength: number, outputTokens?: number, tools?: unknown
): void {
  const window = measureContextWindow(messages, contextLength, outputTokens, tools);
  if (window.requestTokens + window.outputTokens + window.headroomTokens > contextLength) {
    throw new AgentContextWindowExceededError(window.requestTokens, window.outputTokens, contextLength);
  }
}
