/**
 * The single Workshop run-completion decision tree, shared by the composer
 * path (WorkshopHandler.executeMessage) and the synthesis leg of the tool
 * side-pass (RunWorkshopToolSidePass).
 *
 * PR #72 review #7: the two inline copies of this four-branch machine had
 * already drifted (one sent a cancellation status, the other didn't; their
 * zombie-discard predicates disagreed). This is now the one implementation:
 * cancelled → api-key-missing → retention-failure → adopt, where a refused
 * (zombie) completion is discarded WITHOUT streaming its content to the
 * webview and always leaves a log trail (reviews #5/#10).
 */

import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { isApiKeyNotConfiguredWarning, TokenUsage, WorkshopTurn } from '@messages';

export interface WorkshopRunCompletionCopy {
  cancelledStatus: string;
  apiKeyMissingError: string;
  retentionFailedError: string;
}

/** Copy for the host-synthesis leg of a tool side-pass. */
export function workshopSynthesisCompletionCopy(
  personaLabel: string,
  toolLabel: string
): WorkshopRunCompletionCopy {
  return {
    cancelledStatus: `${personaLabel} synthesis cancelled; ${toolLabel}'s report remains available.`,
    apiKeyMissingError: `${toolLabel} completed, but ${personaLabel} could not synthesize it because the OpenRouter API key is not configured.`,
    retentionFailedError: `${toolLabel} completed, but ${personaLabel} synthesis could not be retained.`
  };
}

/** Copy for an ordinary composer message (host or direct-tool target). */
export function workshopMessageCompletionCopy(label: string): WorkshopRunCompletionCopy {
  return {
    cancelledStatus: `${label} cancelled`,
    apiKeyMissingError: 'OpenRouter API key not configured.',
    retentionFailedError: `Failed to retain ${label}'s conversation.`
  };
}

export interface WorkshopRunCompletionEvents {
  streamCompleted(
    requestId: string,
    content: string,
    cancelled: boolean,
    usage?: TokenUsage,
    truncated?: boolean
  ): void;
  turnCompleted(turn: WorkshopTurn): void;
  status(message: string): void;
  error(message: string, details?: string): void;
}

export interface WorkshopRunCompletionInput {
  session: WorkshopSessionService;
  requestId: string;
  /** Display label for log lines ("Jill", "Prose"). */
  label: string;
  result: AnalysisResult;
  /** The run's abort signal state at completion time. */
  aborted: boolean;
  /**
   * True when this run creates a NEW retained conversation (fresh host).
   * Continuations of an existing retained conversation must never discard it
   * on failure — the sidecar/host still owns that id.
   */
  createsRetainedConversation: boolean;
  copy: WorkshopRunCompletionCopy;
  discardConversation: (conversationId: string) => void;
  log: (line: string) => void;
  events: WorkshopRunCompletionEvents;
}

/**
 * Settle a resolved provider result against the session. Returns the adopted
 * turn, or undefined when the result was cancelled, unusable, or refused.
 */
export function completeWorkshopRun(input: WorkshopRunCompletionInput): WorkshopTurn | undefined {
  const { session, requestId, label, result, copy, events } = input;
  const truncated = result.finishReason === 'length';

  if (input.aborted) {
    input.log(`Run cancelled: ${requestId} (${label}, ${result.content.length} chars discarded)`);
    session.abandonRun(requestId);
    if (input.createsRetainedConversation && result.conversationId) {
      input.discardConversation(result.conversationId);
    }
    events.streamCompleted(requestId, '', true);
    events.status(copy.cancelledStatus);
    return undefined;
  }

  if (isApiKeyNotConfiguredWarning(result.content)) {
    session.abandonRun(requestId);
    events.streamCompleted(requestId, '', true);
    events.error(copy.apiKeyMissingError, result.content);
    return undefined;
  }

  if (input.createsRetainedConversation && !result.conversationId) {
    session.abandonRun(requestId);
    events.streamCompleted(requestId, '', true);
    events.error(
      copy.retentionFailedError,
      'The host response did not return a retained conversation.'
    );
    return undefined;
  }

  // Adopt BEFORE announcing completion: a zombie (session reset or run
  // preempted after dispatch) must not stream its full content to the webview
  // as if it landed, and it always leaves a log trail before the API-billed
  // turn evaporates.
  const turn = session.completeRun(requestId, result.content, result.usage, truncated, result.conversationId);
  if (!turn) {
    if (input.createsRetainedConversation && result.conversationId) {
      input.discardConversation(result.conversationId);
    }
    events.streamCompleted(requestId, '', true);
    input.log(
      `Discarded zombie completion: ${requestId} (${label}) — session was reset or the run preempted mid-stream`
    );
    return undefined;
  }

  events.streamCompleted(requestId, result.content, false, result.usage, truncated);
  events.turnCompleted(turn);
  return turn;
}
