/**
 * From a settlement verdict to the reason a reply's outcome record keeps
 * (ADR 2026-11-17 D13; PR #269 F-01). One pure function over the
 * verdict types: the extractor's rejections of each kind, a memory edit's
 * settlement reason, the file-edit drops staging and completion make, and
 * a to-do status change's settlement (ADR 2026-11-19 D7). Its `never` default means a new rejection, anchor fault or
 * settlement reason does not compile until it is mapped.
 *
 * The record's reasons are fewer than the code's: a persona is told what it
 * can act on (`malformed`, not which element was missing), and a reason that
 * names a host detail is folded into the one beside it.
 */

import type {
  WorkshopFileEditTrailerDropReason,
  WorkshopLocationsTrailerDropReason,
  WorkshopMemoryTrailerDropReason,
  WorkshopTodoTrailerDropReason,
  WorkshopTrailerDropReason
} from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopTodoStatusDropCode } from '@/application/services/workshop/todos/WorkshopReplyTodoStatus';
import type { WorkshopReplyMemoryRejection } from '@/utils/workshopReplyControls';
import type { WorkshopReplyFileEditRejection } from '@/utils/workshopReplyFileEdits';
import type { WorkshopLocationsDropCode } from '@/application/services/workshop/locations/WorkshopReplyLocations';
import type { WorkshopMemoryProposalDrop } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import type { WorkshopMemoryEditDropReason } from '@/application/services/workshop/memory/WorkshopReplyMemoryEdit';
import type { WorkshopFileEditProposalDrop } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';

/** Every reason code a memory-note frame can end with no card for. */
export type WorkshopMemoryTrailerDropCode = WorkshopReplyMemoryRejection | WorkshopMemoryEditDropReason;
/** Every reason code a file-edit frame can end with no card for. */
export type WorkshopFileEditTrailerDropCode = WorkshopFileEditProposalDrop['reason'];
/** Every reason code a to-do status frame can end with no row for (ADR 2026-11-19 D7). */
export type WorkshopTodoTrailerDropCode = WorkshopTodoStatusDropCode;
/** Every reason code a context-paths proposal frame can end with no card for (ADR 2026-11-19 D27). */
export type WorkshopLocationsTrailerDropCode = WorkshopLocationsDropCode;
type DropCode = WorkshopMemoryTrailerDropCode | WorkshopFileEditTrailerDropCode | WorkshopTodoTrailerDropCode
  | WorkshopLocationsTrailerDropCode;

const isMalformed = <Code extends string>(code: Code): code is Extract<Code, `malformed:${string}`> => code.startsWith('malformed:');

/** The recorded reason for one verdict's code. */
export function workshopTrailerDropReason(code: WorkshopMemoryTrailerDropCode): WorkshopMemoryTrailerDropReason;
export function workshopTrailerDropReason(code: WorkshopFileEditTrailerDropCode): WorkshopFileEditTrailerDropReason;
export function workshopTrailerDropReason(code: WorkshopTodoTrailerDropCode): WorkshopTodoTrailerDropReason;
export function workshopTrailerDropReason(code: WorkshopLocationsTrailerDropCode): WorkshopLocationsTrailerDropReason;
export function workshopTrailerDropReason(code: DropCode): WorkshopTrailerDropReason {
  if (isMalformed(code)) {
    return 'malformed';
  }
  switch (code) {
    // Read, either kind.
    case 'misplaced':
      return 'misplaced';
    case 'duplicate':
      return 'duplicate';
    case 'over-cap':
      return 'over-cap';
    case 'memory-off':
    case 'file-edits-off':
      return 'off';
    // Read, a file edit.
    case 'oversized':
      return 'oversized';
    // A memory edit, settled against the notes.
    case 'listing-unread':
      return 'notes-unreadable';
    case 'unknown-target':
      return 'target-not-found';
    case 'archived-target':
    case 'superseded-target':
      return 'target-not-in-effect';
    case 'busy-target':
      return 'target-busy';
    case 'find-missing':
      return 'find-not-found';
    case 'find-ambiguous':
      return 'find-ambiguous';
    case 'replaces-overlap':
    case 'conflicting-operations':
      return 'edits-conflict';
    case 'summary-emptied':
    case 'invalid-kind':
    case 'title-not-one-line':
    case 'summary-not-one-line':
    case 'title-too-long':
    case 'summary-too-long':
    case 'body-too-long':
      return 'result-invalid';
    case 'unchanged':
      return 'no-change';
    case 'pinned-budget':
      return 'pinned-budget';
    // A file edit, at staging and at completion.
    case 'duplicate-identity':
      return 'duplicate';
    case 'not-staged':
      return 'not-staged';
    // A to-do status change, settled against the session it named (ADR 2026-11-19 D7).
    case 'unknown-session':
      return 'session-not-found';
    case 'unreadable-session':
    case 'session-needs-recovery':
      return 'session-unreadable';
    case 'store-unavailable':
    case 'workspace-changed':
      return 'sessions-unavailable';
    case 'unknown-todo':
      return 'todo-not-found';
    case 'not-open':
      return 'todo-not-open';
    // A context-paths proposal, checked at settlement (ADR 2026-11-19 D27).
    case 'nothing-kept':
      return 'nothing-kept';
    case 'no-workspace':
    case 'check-failed':
    case 'not-checked':
      return 'workspace-unavailable';
    case 'unrepresentable':
      return 'too-large';
    default:
      return assertNever(code);
  }
}

/** The recorded reason for a memory frame's drop, whichever step dropped it. */
export function workshopMemoryTrailerDropReason(drop: WorkshopMemoryProposalDrop): WorkshopMemoryTrailerDropReason {
  return workshopTrailerDropReason(drop.reason);
}

/** The recorded reason for a file-edit frame's drop, whichever step dropped it. */
export function workshopFileEditTrailerDropReason(drop: WorkshopFileEditProposalDrop): WorkshopFileEditTrailerDropReason {
  return workshopTrailerDropReason(drop.reason);
}

function assertNever(value: never): never {
  throw new Error(`Unmapped trailer drop reason: ${String(value)}`);
}
