/**
 * Explicit recovery of a named session left mid-save (ADR 2026-11-19 D6e).
 * The writer starts it, after closing other windows; it runs on the
 * coordinator's session-operation queue, by session id only.
 *
 * It reads the stale lock's owner folders and follows D6e's table:
 *
 * | Saved | prior | next | Recovery                                            |
 * |-------|-------|------|-----------------------------------------------------|
 * | yes   | no    | yes  | `next` kept as "(local recovery)" if it differs     |
 * | yes   | yes   | no   | `prior` is the superseded pre-image: dropped        |
 * | no    | yes   | yes  | `prior` restored; `next` kept if it differs from it |
 * | no    | yes   | no   | `prior` restored: a delete that did not finish      |
 * | no    | no    | yes  | `next` kept                                         |
 * | other |       |      | every copy differing from the saved file kept       |
 *
 * - **Copies first, then the restore, then the lock.** Every copy is read
 *   and every "(local recovery)" session saved (`saveNamed`, a
 *   non-overwriting create, as D6c) before anything in the lock moves, so a
 *   failing copy leaves the lock and its contents untouched.
 * - **A retry reuses its copies.** A copy's session id is derived from the
 *   lock it came from (saved name, owner token, prior or next), which a
 *   failed recovery leaves standing; a retry finds the copy it already saved
 *   (`existing`) and saves it again only if it is gone. The restore
 *   renames `prior.json` to the saved name, never over anything. Only then
 *   is the lock removed. A failure names its step and leaves the lock.
 * - **Only a stale lock** is recovered: one within its lease is busy.
 * - **Logs** carry counts and the step, never a title or a file name.
 */

import { createHash } from 'node:crypto';
import type { LogSink } from '@/platform';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import type { FileSystem } from '@/platform';
import {
  WorkshopNamedSessionBusyError,
  type WorkshopNamedSessionLock,
  type WorkshopNamedSessionLockCopy,
  type WorkshopNamedSessionLockRow
} from '@/infrastructure/storage/WorkshopNamedSessionLock';

const LOG = '[WorkshopNamedSessionRecovery]';

/** The step a recovery stopped at. */
export type WorkshopNamedSessionRecoveryStep = 'read' | 'copy' | 'restore' | 'unlock';

const STEP_WORDS: Record<WorkshopNamedSessionRecoveryStep, string> = {
  read: 'reading the copies it found',
  copy: 'saving a recovery copy',
  restore: 'putting the saved session back',
  unlock: 'removing the lock'
};

export class WorkshopNamedSessionRecoveryFailedError extends Error {
  constructor(readonly step: WorkshopNamedSessionRecoveryStep) {
    super(`Recovery stopped while ${STEP_WORDS[step]}. Nothing in the lock was removed; try Recover… again.`);
    this.name = 'WorkshopNamedSessionRecoveryFailedError';
  }
}

export interface WorkshopNamedSessionRecoveryOutcome {
  /** Nothing of this session was left mid-save. */
  readonly nothingToRecover: boolean;
  readonly restored: boolean;
  /** A delete that did not finish: the session is back. */
  readonly unfinishedDelete: boolean;
  readonly copies: readonly WorkshopStoredSessionSummary[];
  readonly dropped: number;
}

export interface WorkshopNamedSessionRecoveryPorts {
  readonly fileSystem: FileSystem;
  readonly lock: WorkshopNamedSessionLock;
  readonly log: LogSink;
  /** A copy or the saved file, decoded exactly; undefined when absent; throws when unreadable. */
  readonly read: (filePath: string, fileName: string) => Promise<WorkshopPersistedSessionV2 | undefined>;
  readonly saveNamed: (session: WorkshopPersistedSessionV2) => Promise<WorkshopStoredSessionSummary>;
  /** A saved session by id, when one exists: a retried recovery's earlier copy. */
  readonly existing: (sessionId: string) => Promise<WorkshopStoredSessionSummary | undefined>;
  readonly now: () => string;
}

/** The saved file at recovery: present (perhaps unreadable) or not. */
export interface SavedFile {
  readonly present: boolean;
  readonly session?: WorkshopPersistedSessionV2;
}

export interface ReadCopy {
  readonly copy: WorkshopNamedSessionLockCopy;
  readonly session: WorkshopPersistedSessionV2;
}

/** Recover the session `sessionId` from its stale lock in `folder`. */
export async function recoverWorkshopNamedSession(
  ports: WorkshopNamedSessionRecoveryPorts,
  folder: string,
  sessionId: string
): Promise<WorkshopNamedSessionRecoveryOutcome> {
  const row = await findRow(ports, folder, sessionId);
  if (!row) {
    return { nothingToRecover: true, restored: false, unfinishedDelete: false, copies: [], dropped: 0 };
  }
  if (row.state === 'busy') {
    throw new WorkshopNamedSessionBusyError();
  }
  // An unreadable saved file still stands: every copy that differs from it is kept.
  const saved = await ports.read(row.filePath, row.fileName).then(
    (session): SavedFile => ({ present: session !== undefined, ...(session ? { session } : {}) }),
    (): SavedFile => ({ present: true })
  );
  const copies: ReadCopy[] = [];
  for (const copy of row.copies) {
    const session = await step('read', () => ports.read(copy.path, copy.kind));
    if (session) {
      copies.push({ copy, session });
    }
  }
  const plan = planRecovery(saved, copies, new Set(row.tokens).size);
  const kept: WorkshopStoredSessionSummary[] = [];
  for (const copy of plan.keep) {
    const at = ports.now();
    const copyId = recoveryCopySessionId(row.fileName, copy.copy);
    kept.push(await step('copy', async () => await ports.existing(copyId) ?? ports.saveNamed({
      ...copy.session,
      sessionId: copyId,
      title: `${copy.session.title} (local recovery)`,
      updatedAt: at,
      savedAt: at
    })));
  }
  if (plan.restore) {
    await step('restore', () => ports.fileSystem.rename(plan.restore!.copy.path, row.filePath, { overwrite: false }));
  }
  await step('unlock', () => ports.lock.removeRecovered(row));
  const dropped = copies.length - plan.keep.length - (plan.restore ? 1 : 0);
  ports.log.appendLine(`${LOG} Recovered (restored=${plan.restore ? 1 : 0}, kept=${kept.length}, dropped=${dropped}).`);
  return { nothingToRecover: false, restored: plan.restore !== undefined, unfinishedDelete: plan.unfinishedDelete, copies: kept, dropped };
}

/** A copy's session id, the same on every retry while its lock stands. */
export function recoveryCopySessionId(fileName: string, copy: WorkshopNamedSessionLockCopy): string {
  const hex = createHash('sha256').update(`${fileName}\u0000${copy.token}\u0000${copy.kind}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** D6e's table. */
export function planRecovery(
  saved: SavedFile,
  copies: readonly ReadCopy[],
  owners: number
): { keep: ReadCopy[]; restore?: ReadCopy; unfinishedDelete: boolean } {
  const prior = copies.filter((copy) => copy.copy.kind === 'prior');
  const next = copies.filter((copy) => copy.copy.kind === 'next');
  const differs = (copy: ReadCopy, from: WorkshopPersistedSessionV2 | undefined): boolean =>
    !from || !hasSameWorkshopCheckpoint(copy.session, from);
  if (owners === 1 && prior.length <= 1 && next.length <= 1) {
    const [p] = prior;
    const [n] = next;
    if (saved.present && !p && n) {
      return { keep: differs(n, saved.session) ? [n] : [], unfinishedDelete: false };
    }
    if (saved.present && p && !n) {
      return { keep: [], unfinishedDelete: false };
    }
    if (!saved.present && p && n) {
      return { keep: differs(n, p.session) ? [n] : [], restore: p, unfinishedDelete: false };
    }
    if (!saved.present && p && !n) {
      return { keep: [], restore: p, unfinishedDelete: true };
    }
    if (!saved.present && !p && n) {
      return { keep: [n], unfinishedDelete: false };
    }
  }
  return { keep: copies.filter((copy) => differs(copy, saved.session)), unfinishedDelete: false };
}

/** The stale lock this session's copies, or its saved file, are under. */
async function findRow(ports: WorkshopNamedSessionRecoveryPorts, folder: string, sessionId: string): Promise<WorkshopNamedSessionLockRow | undefined> {
  const rows = await ports.lock.rowsIn(folder);
  const byCopy = rows.find((row) => row.copies.some((copy) => copy.sessionId === sessionId));
  if (byCopy) {
    return byCopy;
  }
  for (const row of rows) {
    const saved = await ports.read(row.filePath, row.fileName).catch(() => undefined);
    if (saved?.sessionId === sessionId) {
      return row;
    }
  }
  return undefined;
}

async function step<T>(name: WorkshopNamedSessionRecoveryStep, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof WorkshopNamedSessionBusyError) {
      throw error;
    }
    throw new WorkshopNamedSessionRecoveryFailedError(name);
  }
}

/** The host's words for a recovery that landed (D6e). */
export function workshopNamedSessionRecoveryWords(outcome: WorkshopNamedSessionRecoveryOutcome): string {
  if (outcome.nothingToRecover) {
    return 'Nothing of this session was left mid-save.';
  }
  const sentences = [outcome.unfinishedDelete
    ? 'A delete didn\'t finish, so the session is back. Delete it again if you meant to.'
    : 'Recovered the saved session.'];
  for (const copy of outcome.copies) {
    sentences.push(`Another copy is kept as “${copy.title}” in Sessions.`);
  }
  return sentences.join(' ');
}
