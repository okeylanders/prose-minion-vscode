/**
 * The single writer-facing recovery path for an immutable Workshop scope.
 *
 * Both the host-side refusal and the proactive webview signposts use this
 * sentence so the product cannot offer two different exits from the same
 * locked room.
 */
export const WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE =
  'Start a new session to change this — your excerpt and context carry over.';
