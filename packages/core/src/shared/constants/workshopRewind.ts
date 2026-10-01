/**
 * Writer-facing reasons a Workshop rewind is unavailable (ADR 2026-09-30 §4).
 *
 * The host's refusal and the bubble's disabled tooltip use the same phrase,
 * so the product cannot explain one refusal two different ways.
 */

import type { WorkshopTurnRewindUnavailableReason } from '@messages';

export type WorkshopRewindRefusalReason =
  | WorkshopTurnRewindUnavailableReason
  | 'not-a-rest-point';

/**
 * Rewind and Branch share one cut policy, so they share its reasons. Only a
 * position that is no rest point names the action, because no bubble ever
 * shows that one.
 */
export function workshopRewindUnavailableReason(
  reason: WorkshopRewindRefusalReason,
  action: 'rewind' | 'branch' = 'rewind'
): string {
  switch (reason) {
    case 'busy':
      return 'Wait for the current response to finish';
    case 'before-rewind-support':
      return 'Saved before rewind support';
    case 'before-directive-change':
      return "Can't cross a prose directive change yet";
    case 'not-a-rest-point':
      return action === 'branch' ? "Can't branch from this point" : "Can't rewind to this point";
  }
}

/**
 * Why the host refused a Branch (ADR 2026-09-30 §7, D2). Opening the branch
 * replaces the live room and current.json, and Branch never writes the source
 * itself, so the source must already be saved in its own named file with
 * nothing newer waiting to be written. That file must also still hold this
 * room when Branch reads it back: Git or another process may have deleted,
 * corrupted or replaced it since the room was saved.
 */
export type WorkshopBranchRefusalReason = 'unsaved-session' | 'unsaved-changes' | 'source-changed';

export function workshopBranchUnavailableReason(reason: WorkshopBranchRefusalReason): string {
  switch (reason) {
    case 'unsaved-session':
      return 'Save this session before branching';
    case 'unsaved-changes':
      return "Save this session's latest changes before branching";
    case 'source-changed':
      return "This session's saved file is missing or changed on disk. " +
        'Reopen it from Sessions, or use Save as new to keep this room, before branching';
  }
}
