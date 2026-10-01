/**
 * Branch vocabulary (ADR 2026-09-30 §7): the new session's persisted envelope
 * and the coordinator's Branch-only refusals. Pure: the coordinator supplies
 * the clock, the id and the cut room.
 */

import {
  CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION,
  WorkshopPersistedSessionV2,
  WorkshopPersistedSummaryV1
} from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import type {
  WorkshopRetainedArchiveEntry
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import type { WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionStore';
import type { WorkshopBranchRefusalReason } from '@shared/constants/workshopRewind';

export interface WorkshopBranchCheckpointInput {
  sessionId: string;
  title: string;
  /** The branch time: creation, save and temporal start alike. */
  now: string;
  /** The source session's timezone, which a branch keeps. */
  timezone: string;
  /** Built from the cut room, so the browser describes the branch. */
  summary: WorkshopPersistedSummaryV1;
  workshop: WorkshopSessionStateV1;
  conversations: WorkshopRetainedArchiveEntry[];
}

/**
 * The branch's persisted session (ADR 2026-09-30 §7 step 5): the cut room in
 * a new envelope. Its temporal state is a fresh start in the source's
 * timezone with no persona notices. Opening it queues a resume frame for
 * every retained persona, and a fresh persona gets its own session-start
 * frame. No lineage is recorded in v1.
 */
export function workshopBranchCheckpoint(
  input: WorkshopBranchCheckpointInput
): WorkshopPersistedSessionV2 {
  return {
    schemaVersion: CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId,
    title: input.title,
    createdAt: input.now,
    updatedAt: input.now,
    savedAt: input.now,
    temporal: {
      schemaVersion: 1,
      startedAt: input.now,
      timezone: input.timezone,
      lastActivityAt: input.now,
      personaNotices: []
    },
    summary: input.summary,
    workshop: input.workshop,
    conversations: input.conversations
  };
}

/** Branch needs a source that is saved and fully written; nothing was changed. */
export class WorkshopBranchRefusedError extends Error {
  constructor(readonly reason: WorkshopBranchRefusalReason) {
    super(`Workshop branch refused: ${reason}`);
    this.name = 'WorkshopBranchRefusedError';
  }
}

/**
 * The branch was saved as a named session but could not be opened. The prior
 * room was restored, and the branch stays on disk, openable from Sessions.
 */
export class WorkshopBranchNotOpenedError extends Error {
  constructor(
    readonly branch: Pick<WorkshopStoredSessionSummary, 'sessionId' | 'title' | 'fileName'>,
    readonly detail: string,
    /**
     * Set when Branch itself declined to open the branch: its source changed
     * on disk while the branch was being saved and opened.
     */
    readonly refusal?: WorkshopBranchRefusalReason
  ) {
    super(`Workshop branch “${branch.title}” was saved but not opened: ${detail}`);
    this.name = 'WorkshopBranchNotOpenedError';
  }
}
