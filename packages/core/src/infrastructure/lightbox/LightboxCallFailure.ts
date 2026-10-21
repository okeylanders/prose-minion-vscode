/**
 * What a failed reading call, a rejected reply or a failure of the host's own
 * work around them may say, and to whom (PR #149 F-05, F-10). Pure.
 *
 * A provider's error text is not the host's to repeat: it can echo the
 * request (the chapter, the context) or carry arbitrary detail of any length.
 * Truncating it is not redacting it. So a failure is reduced to a closed,
 * host-owned category, and only the category's own words reach the Output
 * channel and the board: a fixed sentence for the writer, and a log line
 * made of the category plus, at most, a numeric HTTP status or a built-in
 * error class name. The provider's message, its details and the error's own
 * text are never read here.
 *
 * Where raw detail is worth keeping, it has its own boundary: a reply that
 * came back but could not be used is quarantined, with its rejection's
 * diagnostic, in the rejected-response recovery store (a gitignored project
 * folder, opened only when the writer asks). A call that failed has no reply
 * to keep, so nothing of it is kept.
 */

import { AgentRunUnavailableError, type AgentRunUnavailableReason } from '@orchestration/AgentRunEngine';
import { LightboxGroupFrameError } from '@/infrastructure/lightbox/LightboxReadingWire';
import { AgentContextWindowExceededError } from '@orchestration/RequestContextPreflight';
import { OpenRouterApiError } from '@providers/OpenRouterClient';

export type LightboxCallFailureCategory =
  | AgentRunUnavailableReason
  | 'provider-rejected'
  | 'unexpected'
  | 'setup-failed'
  | 'check-failed';

export interface LightboxCallFailure {
  category: LightboxCallFailureCategory;
  /** Writer-facing, for the failed group. */
  message: string;
  /** For the Output channel: the category, and at most a status code or an error class. */
  log: string;
}

/** Why a reply that came back was rejected: words the host may log and show, and detail only the recovery store keeps. */
export interface LightboxRejection {
  message: string;
  diagnostic?: string;
}

const TRY_AGAIN = 'Read the rest to try again.';
/** Bounds the recovery sidecar's note about an unexpected decode failure. */
const DIAGNOSTIC_CHARACTERS = 2_000;

/**
 * A decode failure as a rejection: the codec's frame errors carry host-owned
 * messages (and maybe a diagnostic); anything else is a host bug, described
 * as such, its text kept only for the recovery sidecar.
 */
export function lightboxRejectionOf(error: unknown): LightboxRejection {
  if (error instanceof LightboxGroupFrameError) {
    return { message: error.message, ...(error.diagnostic ? { diagnostic: error.diagnostic } : {}) };
  }
  return {
    message: 'the reply could not be decoded',
    diagnostic: (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, DIAGNOSTIC_CHARACTERS)
  };
}

/** Error classes whose name is the runtime's, not a message's. */
const BUILT_IN_ERRORS = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AbortError', 'TimeoutError']);

export function describeLightboxCallFailure(error: unknown): LightboxCallFailure {
  if (error instanceof AgentRunUnavailableError) {
    return {
      category: error.reason,
      message: unavailableMessage(error.reason, error.retryAfterSeconds),
      log: error.reason
    };
  }
  if (error instanceof AgentContextWindowExceededError) {
    return { category: 'context-window-exceeded', message: unavailableMessage('context-window-exceeded'), log: 'context-window-exceeded' };
  }
  if (error instanceof OpenRouterApiError) {
    const status = typeof error.status === 'number' && Number.isInteger(error.status) && error.status >= 100 && error.status <= 599
      ? error.status
      : undefined;
    return {
      category: 'provider-rejected',
      message: `The provider refused the call${status ? ` (HTTP ${status})` : ''}. ${TRY_AGAIN}`,
      log: `provider-rejected${status ? ` (HTTP ${status})` : ''}`
    };
  }
  const name = error instanceof Error && BUILT_IN_ERRORS.has(error.name) ? error.name : undefined;
  return {
    category: 'unexpected',
    message: `The call failed before a reading came back. ${TRY_AGAIN}`,
    log: `unexpected${name ? ` (${name})` : ''}`
  };
}

/**
 * A failure of the host's own work around the calls (PR #149 F-10): setting
 * the run up over the chapter (the quote verifier and term counter), before
 * anything is sent, or checking a reply that came back; for group F
 * (Slice 4D), gathering the board's digest before its call, or checking its
 * reply against that digest. Described the same way, by category and at
 * most a built-in error class.
 */
export function describeLightboxHostFailure(error: unknown, stage: 'setup' | 'check' | 'digest' | 'weigh'): LightboxCallFailure {
  const name = error instanceof Error && BUILT_IN_ERRORS.has(error.name) ? ` (${error.name})` : '';
  switch (stage) {
    case 'setup':
      return {
        category: 'setup-failed',
        message: 'The chapter could not be prepared for checking quotes, so nothing was sent.',
        log: `setup-failed${name}`
      };
    case 'digest':
      return {
        category: 'setup-failed',
        message: 'The board could not be gathered for the Opinion, so nothing was sent.',
        log: `setup-failed (digest)${name}`
      };
    case 'check':
      return {
        category: 'check-failed',
        message: `The reading came back but could not be checked against the chapter. ${TRY_AGAIN}`,
        log: `check-failed${name}`
      };
    case 'weigh':
      return {
        category: 'check-failed',
        message: `The Opinion came back but could not be checked against the board. ${TRY_AGAIN}`,
        log: `check-failed (opinion)${name}`
      };
  }
}

function unavailableMessage(reason: AgentRunUnavailableReason, retryAfterSeconds?: number): string {
  switch (reason) {
    case 'missing-credentials':
      return 'Add an OpenRouter API key in Settings to read the chapter.';
    case 'authentication':
      return 'OpenRouter rejected the saved API key. Update it in Settings, then read the rest.';
    case 'insufficient-credits':
      return 'The OpenRouter account has too few credits for this call. Add credits, then read the rest.';
    case 'token-budget-exceeded':
      return 'OpenRouter stopped the call at the API key\'s token limit. Adjust the limit, then read the rest.';
    case 'context-window-exceeded':
      return 'The call was too large for the model\'s window, so it was not sent. Choose a shorter passage, ' +
        'turn off lenses, or choose a model with a larger window.';
    case 'rate-limited':
      return Number.isSafeInteger(retryAfterSeconds) && (retryAfterSeconds as number) > 0
        ? `OpenRouter is rate limiting requests. Read the rest in about ${retryAfterSeconds} seconds.`
        : 'OpenRouter is rate limiting requests. Read the rest in a moment.';
    case 'provider-unavailable':
      return `The model's provider is unavailable right now. ${TRY_AGAIN}`;
    default: {
      const unhandled: never = reason;
      return unhandled;
    }
  }
}
