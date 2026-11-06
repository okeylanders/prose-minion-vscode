/**
 * The durable `applying` checkpoint's contract (ADR 2026-11-05 D8; PR #226
 * F-04 re-review): what `WorkshopSessionPersistenceCoordinator.checkpointFileEdit`
 * answers, and the one rule it reads a checkpoint by. Pure.
 *
 * `{ ok: true }` means every recoverable checkpoint (`current.json`, and the
 * named session file when the room is named) was written and read back
 * holding that exact card in `applying`. Anything else is a refusal, and no
 * document write may follow. A `flush()` that merely resolves is never
 * this answer.
 */

import type { WorkshopTurn } from '@messages';

export const WORKSHOP_FILE_EDIT_CHECKPOINT_REFUSALS = [
  /** The room generation moved: another room now owns the session. */
  'room-changed',
  /** A persona reply is running; autosave defers capture until it settles. */
  'run-active',
  /** The store is unavailable, protected, or the workspace changed since load. */
  'store-unavailable',
  /** A write failed, or a read-back did not hold the card in `applying`. */
  'checkpoint-failed',
  /** The named file holds it, but `current.json` could not be mirrored. */
  'mirror-failed',
  /** The live card is not in `applying` (it was never set, or something replaced it). */
  'not-applying'
] as const;
export type WorkshopFileEditCheckpointRefusal = (typeof WORKSHOP_FILE_EDIT_CHECKPOINT_REFUSALS)[number];

export type WorkshopFileEditCheckpointResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: WorkshopFileEditCheckpointRefusal };

/** The port the file-edit handler checkpoints through; satisfied by the persistence coordinator. */
export interface WorkshopFileEditCheckpointPort {
  checkpointFileEdit(generation: number, turnId: string, index: number): Promise<WorkshopFileEditCheckpointResult>;
}

/** Whether a checkpoint's turns hold this card in `applying`. */
export function workshopCheckpointHoldsApplying(
  turns: readonly Pick<WorkshopTurn, 'id' | 'fileEditProposals'>[] | undefined,
  turnId: string,
  index: number
): boolean {
  return turns?.find((turn) => turn.id === turnId)?.fileEditProposals?.[index]?.state === 'applying';
}
