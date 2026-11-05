/**
 * The room seed port (ADR 2026-11-04 D9): what a fresh Workshop room is
 * started with, beyond what the aggregate itself carries.
 *
 * The persistence coordinator calls it at exactly the room starts ADR D2
 * seeds, and nowhere else:
 *
 * - the first room in a project (no `current.json`): `prepare('first')`;
 * - New session (`carry`): `prepare('new')`;
 * - New session: full reset (`full-reset`): `prepare('full-reset')`.
 *
 * New session: full reset, empty context (`empty`), Open, Duplicate, Branch,
 * Rewind and a reload of `current.json` never call it.
 *
 * `prepare` reads, asynchronously, outside the room-replacement transaction.
 * `install` is synchronous and runs inside it, after the aggregate's reset and
 * before the start marker and the first checkpoint, so that checkpoint holds
 * what was installed. A replacement that fails drops the plan with the room it
 * was meant for: it is never installed anywhere else.
 *
 * The coordinator imports this module as types only. Only the composition
 * root (`extension.ts`) chooses a seed; until Slice 2b it passes
 * `WORKSHOP_NO_ROOM_SEED`.
 */

import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';

/** Which room start a plan is prepared for. */
export type WorkshopRoomSeedKind = 'first' | 'new' | 'full-reset';

/**
 * What `prepare` read for one room start. Opaque to the coordinator, which
 * only hands it back to `install`; a seed extends it with what it read.
 */
export interface WorkshopRoomSeedPlan {
  readonly kind: WorkshopRoomSeedKind;
}

/**
 * Why a pinned file was not attached to the room. `workspace-changed`
 * (Slice 2b, PR #208 F01): the project folder changed while the seed read,
 * so nothing it read is installed.
 */
export type WorkshopRoomSeedLeftOutReason = 'missing' | 'unreadable' | 'over-budget' | 'workspace-changed';

export interface WorkshopRoomSeedLeftOut {
  /** The file's label, for the writer's result line. Never logged. */
  readonly label: string;
  readonly reason: WorkshopRoomSeedLeftOutReason;
  /**
   * The room still holds this file, carried from the room before with the
   * body it had: its re-read was left out, but the file was not. Set only
   * then (Slice 2b), so the result line never calls it "not attached".
   */
  readonly kept?: true;
}

/** What `install` did to the room, for the result line and the log's counts. */
export interface WorkshopRoomSeedReport {
  /** How many files the seed meant to attach. */
  readonly pinnedCount: number;
  /** How many of them the room holds now, attached or re-read in place. */
  readonly attachedCount: number;
  /** The words those attached files hold. */
  readonly attachedWords: number;
  /** Each file not attached, in pinned order. */
  readonly leftOut: readonly WorkshopRoomSeedLeftOut[];
}

/**
 * The narrow slice of the session aggregate that seeding needs: list the
 * room's attachments, add one, and replace file bodies in their slots.
 */
export type WorkshopRoomSeedTarget = Pick<
  WorkshopSessionService,
  'getContextAttachments' | 'addContextAttachment' | 'refreshContextFileAttachments'
>;

export interface WorkshopRoomSeed {
  /**
   * Read what the room will be seeded with. Resolves for every outcome: a file
   * that cannot be read is a left-out entry in `install`'s report, never a
   * rejection, because a seed must never keep a room from starting.
   */
  prepare(kind: WorkshopRoomSeedKind): Promise<WorkshopRoomSeedPlan>;
  /** Install a plan into the fresh room. Synchronous; returns what it did. */
  install(plan: WorkshopRoomSeedPlan, room: WorkshopRoomSeedTarget): WorkshopRoomSeedReport;
}

const NOTHING_SEEDED: WorkshopRoomSeedReport = Object.freeze({
  pinnedCount: 0,
  attachedCount: 0,
  attachedWords: 0,
  leftOut: Object.freeze([])
});

/** A report of a seed that meant to attach nothing. */
export function isEmptyWorkshopRoomSeedReport(report: WorkshopRoomSeedReport | undefined): boolean {
  return report === undefined || report.pinnedCount === 0;
}

/** The seed that plans nothing and reports nothing: today's Workshop. */
export const WORKSHOP_NO_ROOM_SEED: WorkshopRoomSeed = Object.freeze({
  prepare: (kind: WorkshopRoomSeedKind): Promise<WorkshopRoomSeedPlan> => Promise.resolve({ kind }),
  install: (): WorkshopRoomSeedReport => NOTHING_SEEDED
});
