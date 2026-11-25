/**
 * The room a retained conversation's next request would have, by the
 * context preflight's own rule (`measureContextWindow`): the model's live
 * window, less the held history, one more user message, the reserved output
 * and the safety headroom.
 *
 * A read for a caller that must size what it is about to add to that
 * message. It sends nothing, changes nothing and names no caller. Undefined
 * when the model's window is not known, or the conversation is not held.
 */

import type { OpenRouterMessage } from '@providers/OpenRouterChatContracts';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import { measureContextWindow } from '@orchestration/RequestContextPreflight';

export interface ConversationWindowRequest {
  /** The model the next request goes to. */
  readonly model: string;
  /** What the next user message holds before anything is added to it. */
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly tools?: unknown;
}

export function measureConversationWindow(
  history: () => readonly OpenRouterMessage[],
  request: ConversationWindowRequest
): CapabilityContextWindow | undefined {
  const contextLength = OpenRouterModels.getCachedContextLength(request.model);
  if (contextLength === undefined) {
    return undefined;
  }
  let messages: readonly OpenRouterMessage[];
  try {
    messages = history();
  } catch {
    return undefined;
  }
  return measureContextWindow([...messages, { role: 'user', content: request.userMessage }], contextLength, request.maxTokens, request.tools);
}
