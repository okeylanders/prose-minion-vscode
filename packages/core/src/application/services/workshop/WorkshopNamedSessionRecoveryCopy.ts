/**
 * A refused room keeps its work in its own recovery session (ADR 2026-11-19
 * D6c; PR #286 re-review, finding 2). `current.json` is the workspace's,
 * not the window's: another coordinator can replace it before this room
 * reloads, so a refused named save never relies on it.
 *
 * - **When a named save is refused as changed or busy,** the room's
 *   checkpoint is written at once to a new named session, "<title> (local
 *   recovery)", through the store's collision-free create (`saveNamed`),
 *   which never overwrites.
 * - **One recovery session per refusal episode.** A later refusal updates
 *   it through the lock, against the copy last written there. The episode
 *   ends when the room promotes the file or saves successfully (`end`).
 * - **Told once:** one recovery notice per episode, in
 *   `local-session-preserved`'s shape.
 * - **No duplicate on reload:** `holds` says whether a local snapshot is
 *   the episode's copy, so the displaced-work save skips it.
 * - Logs carry the session id and file name only, never a title or text.
 */

import type { LogSink } from '@/platform';
import type { WorkshopSessionRecoveryNoticeMessage } from '@messages';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';
import { withoutRollingProvenance } from '@/application/services/workshop/WorkshopRollingCheckpoint';
import { hasSameWorkshopRecoveryContent } from '@/application/services/workshop/WorkshopSessionRecoveryEquality';

export interface WorkshopRecoveryCopyStore {
  saveNamed(session: WorkshopPersistedSessionV2): Promise<WorkshopStoredSessionSummary>;
  updateNamed(sessionId: string, session: WorkshopPersistedSessionV2, expected: WorkshopPersistedSessionV2): Promise<WorkshopStoredSessionSummary>;
}

/** Whether a named save's refusal starts or continues a refusal episode: changed, busy or recovery-required (D6c, D6e). */
export function isWorkshopNamedSaveRefusal(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  return name === 'WorkshopNamedSessionChangedError' || name === 'WorkshopNamedSessionBusyError' || name === 'WorkshopNamedSessionRecoveryRequiredError';
}

export class WorkshopNamedSessionRecoveryCopy {
  /** The episode's recovery session, the copy last written there, and the room it was kept from. */
  private episode?: { sessionId: string; written: WorkshopPersistedSessionV2; room: WorkshopPersistedSessionV2 };

  constructor(
    private readonly store: WorkshopRecoveryCopyStore,
    private readonly mintSessionId: () => string,
    private readonly now: () => string,
    private readonly notify: (notice: WorkshopSessionRecoveryNoticeMessage['payload']) => void,
    private readonly log: LogSink,
    private readonly canUpdate: (sessionId: string) => boolean = () => true
  ) {}

  /** Keep the refused room's checkpoint in the episode's recovery session: created once, then updated. */
  async keep(room: WorkshopPersistedSessionV2, namedTitle: string, source: 'named' | 'rolling' = 'named'): Promise<void> {
    const at = this.now();
    // A writer may have opened the prior recovery in a sibling tab since the last refusal.
    if (this.episode && this.canUpdate(this.episode.sessionId)) {
      const next = { ...this.episode.written, workshop: room.workshop, temporal: room.temporal, conversations: room.conversations, summary: room.summary, updatedAt: at, savedAt: at };
      try {
        await this.store.updateNamed(this.episode.sessionId, next, this.episode.written);
        this.episode = { sessionId: this.episode.sessionId, written: next, room };
        this.log.appendLine(`[WorkshopSessionPersistence] Refused save kept in its recovery session (id=${this.episode.sessionId})`);
        return;
      } catch (error) {
        // The recovery itself may now be another window's working file. Preserve that version too.
        if (source !== 'rolling' || !(isWorkshopNamedSaveRefusal(error) ||
          (error instanceof Error && error.name === 'WorkshopNamedSessionNotFoundError'))) {
          throw error;
        }
      }
    }
    const copy: WorkshopPersistedSessionV2 = {
      ...withoutRollingProvenance(room),
      sessionId: this.mintSessionId(),
      title: `${namedTitle} (local recovery)`,
      updatedAt: at,
      savedAt: at
    };
    const saved = await this.store.saveNamed(copy);
    this.episode = { sessionId: saved.sessionId, written: copy, room };
    this.log.appendLine(`[WorkshopSessionPersistence] Refused save kept in a new recovery session ${saved.fileName}`);
    this.notify({
      code: 'local-session-preserved',
      sessionId: saved.sessionId,
      recoveryFileName: saved.fileName,
      message: source === 'rolling'
        ? `This tab’s rolling checkpoint is in use or changed in another window. Your work is kept as "${copy.title}" in Sessions.`
        : `Couldn't save to ${namedTitle}: it changed in another window. Your work is kept as "${copy.title}" in Sessions.`
    });
  }

  /** Whether a local snapshot is already the episode's recovery copy. */
  holds(local: WorkshopPersistedSessionV2): boolean {
    return this.episode !== undefined && hasSameWorkshopRecoveryContent(local, this.episode.room);
  }

  /** The room promoted the file or saved: the episode is over. */
  end(): void {
    this.episode = undefined;
  }
}
