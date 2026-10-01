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

export function workshopRewindUnavailableReason(reason: WorkshopRewindRefusalReason): string {
  switch (reason) {
    case 'busy':
      return 'Wait for the current response to finish';
    case 'before-rewind-support':
      return 'Saved before rewind support';
    case 'before-directive-change':
      return "Can't cross a prose directive change yet";
    case 'not-a-rest-point':
      return "Can't rewind to this point";
  }
}

/**
 * Why the host refused a Branch before cutting anything (ADR 2026-09-30 §7,
 * D2). Opening the branch replaces the live room and current.json, and Branch
 * never writes the source itself, so the source must already be saved in its
 * own named file with nothing newer waiting to be written.
 */
export type WorkshopBranchRefusalReason = 'unsaved-session' | 'unsaved-changes';

export function workshopBranchUnavailableReason(reason: WorkshopBranchRefusalReason): string {
  switch (reason) {
    case 'unsaved-session':
      return 'Save this session before branching';
    case 'unsaved-changes':
      return "Save this session's latest changes before branching";
  }
}
