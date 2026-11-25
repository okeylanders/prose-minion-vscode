/**
 * What a Passage Search call that threw came to (ADR 2026-11-20 D7, D11):
 * one rule for the read calls and the organizing pass, so the two cannot
 * drift on what counts as a request that reached the provider.
 *
 * - `key-changed`: the retired engine refused (`missing-credentials`).
 *   Nothing was sent.
 * - `too-large`: the engine's own preflight refused before any request
 *   (`context-window-exceeded`: the request does not fit the model's
 *   window as the engine measures it at dispatch, a window the catalog may
 *   have learned only after the plan was priced). Nothing was sent.
 * - `stopped-in-flight`: the caller's signal was aborted while the call was
 *   out. It was dispatched and may have been charged.
 * - `provider-failed`: anything else. The request may have reached the
 *   provider (a refusal, an error, a reply that would not decode), and
 *   nothing says it did not: it is counted as dispatched.
 *
 * A call that was not dispatched leaves no usage entry, is no request and
 * is no provider failure: it neither adds to the failure streak nor ends
 * it. A dispatched call that threw leaves one usage entry, unknown
 * (`undefined`): it is counted as a request, and a cost total over it is
 * not complete. Only the two reasons above are known to precede dispatch;
 * a new one joins this function, its own count in the result and its test,
 * on purpose.
 */

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';

export type PassageSearchCallFailure = 'key-changed' | 'too-large' | 'stopped-in-flight' | 'provider-failed';

export function classifyPassageSearchCallFailure(error: unknown, aborted: boolean): PassageSearchCallFailure {
  if (error instanceof AgentRunUnavailableError) {
    if (error.reason === 'missing-credentials') {
      return 'key-changed';
    }
    if (error.reason === 'context-window-exceeded') {
      return 'too-large';
    }
  }
  return aborted ? 'stopped-in-flight' : 'provider-failed';
}

/** Whether a call that failed this way went out: it then leaves an unknown usage entry and counts as a request. */
export function passageSearchCallWasDispatched(failure: PassageSearchCallFailure): boolean {
  switch (failure) {
    case 'key-changed':
    case 'too-large':
      return false;
    case 'stopped-in-flight':
    case 'provider-failed':
      return true;
    default: {
      const unreachable: never = failure;
      return unreachable;
    }
  }
}

/** A failure's kind for a log: a closed reason or a class name, never a message, which may quote a path or the writer's text. */
export function passageSearchFaultKind(error: unknown): string {
  if (error instanceof AgentRunUnavailableError) {
    return error.reason;
  }
  return error instanceof Error ? error.name : 'unknown';
}
