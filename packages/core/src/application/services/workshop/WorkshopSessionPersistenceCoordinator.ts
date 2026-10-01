/**
 * Application-owned persistence transaction for Workshop.
 *
 * The aggregate and retained provider histories have different owners. This
 * coordinator is the one seam allowed to capture, hydrate, and retire both so
 * `current.json` can never describe a room from two different moments.
 */

import { randomUUID, createHash } from 'crypto';
import * as path from 'path';
import { LogSink } from '@/platform';
import {
  WorkshopSessionActiveRunPersistenceError,
  WorkshopSessionCheckpointNormalization,
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopConversationLogicalKey,
  WorkshopRuntimeConversationBindings,
  WorkshopSessionStateV1,
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  WorkshopPersonaConversationKey,
  WorkshopSessionTimeService,
  isWorkshopPersonaConversationKey,
  parseWorkshopSessionTemporalStateV1,
  workshopGuestConversationKey
} from '@/application/services/workshop/WorkshopSessionTimeService';
import {
  CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION,
  WorkshopPersistedSessionCheckpointDecodeResult,
  WorkshopPersistedSessionV2,
  WorkshopPersistedSummaryV1
} from '@/application/services/workshop/WorkshopPersistedSession';
import {
  WorkshopConversationSettingsService
} from '@/application/services/workshop/WorkshopConversationSettingsService';
import {
  renderWorkshopStandingDirectiveFramesFromState
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveFrames';
import {
  WorkshopConversationExportTarget,
  WorkshopConversationImportTarget,
  AssistantToolService
} from '@services/analysis/AssistantToolService';
import {
  WorkshopNamedSessionChangedError,
  WorkshopNamedSessionNotFoundError,
  WorkshopSessionStore,
  WorkshopSessionStoreAvailability,
  WorkshopSessionStoreUnavailableError,
  WorkshopStoredSessionSummary
} from '@/infrastructure/storage/WorkshopSessionStore';
import { ConversationArchiveEntryV1 } from '@orchestration/ConversationManager';
import {
  WorkshopConversationDegradation,
  WorkshopPersonaId,
  WorkshopSessionSaveStatusMessage,
  WorkshopSessionRecoveryNoticeMessage,
  WorkshopSessionSummary,
  WorkshopToolId,
  workshopExcerptSourcePath
} from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { countWords } from '@/utils/textUtils';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import { cleanRollingCheckpoint, isCleanRollingCheckpoint, withoutRollingProvenance } from '@/application/services/workshop/WorkshopRollingCheckpoint';
import { hasSameWorkshopRecoveryContent } from '@/application/services/workshop/WorkshopSessionRecoveryEquality';
import type {
  WorkshopImportedRetainedHistory
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';
import type {
  WorkshopRewindCut
} from '@/application/services/workshop/session/WorkshopRewindPolicy';
import {
  WorkshopBranchNotOpenedError,
  WorkshopBranchRefusedError,
  workshopBranchCheckpoint
} from '@/application/services/workshop/WorkshopSessionBranch';
import {
  requireWorkshopSessionTitle,
  workshopBranchTitle
} from '@/application/services/workshop/WorkshopSessionTitles';
import {
  rewindWorkshopSession,
  WorkshopRetainedArchiveEntry,
  WorkshopRewindComposerRestore,
  WorkshopRewindCutSummary,
  WorkshopRewindRefusedError,
  WorkshopRewindWidgetRestore,
  WorkshopSessionRewindResult
} from '@/application/services/workshop/session/WorkshopSessionRewind';

interface LiveSessionIdentity {
  sessionId: string;
  title: string;
  createdAt: string;
}

interface LiveSessionRollback {
  identity: LiveSessionIdentity;
  activeNamedSessionId?: string;
  acceptedNamedCheckpoint?: WorkshopPersistedSessionV2;
  workshop: WorkshopSessionStateV1;
  bindings: WorkshopRuntimeConversationBindings;
  temporal: ReturnType<WorkshopSessionTimeService['exportRuntimeState']>;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  degradedConversations: WorkshopConversationDegradation[];
  resumePending: boolean;
  localWorkPending: boolean;
  pendingRollingMirror?: WorkshopPersistedSessionV2;
  currentCheckpointError?: string;
  recoveryNotices: WorkshopSessionRecoveryNoticeMessage['payload'][];
}

interface WorkshopHydrationTransaction extends WorkshopSessionHydrateResult {
  discardedConversationIds: string[];
}

/** What replaced the live room: the runtime conversations it superseded. */
interface WorkshopRoomReplacement {
  discardedConversationIds: readonly string[];
}

/** One promoted room: its imported histories bound to its hydrated aggregate. */
interface WorkshopRoomInstallation {
  workshop: WorkshopSessionStateV1;
  importedConversationCount: number;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  degradedConversations: WorkshopConversationDegradation[];
  /** The runtime conversations the installation replaced. */
  discardedConversationIds: string[];
  recoveryNotices: WorkshopSessionRecoveryNoticeMessage['payload'][];
}

// The Rewind and Branch operations' public vocabulary: handlers depend on the
// coordinator, never on the session collaborators behind it.
export type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
export { WorkshopRewindRefusedError } from '@/application/services/workshop/session/WorkshopSessionRewind';
export {
  WorkshopBranchNotOpenedError,
  WorkshopBranchRefusedError
} from '@/application/services/workshop/WorkshopSessionBranch';

/**
 * Who asked for a rewind. A writer's bubble action re-seeds the composer; a
 * Side Quest's End (not yet wired to a route) never does.
 */
export type WorkshopRewindOrigin = 'writer' | 'sideQuestEnd';

export interface WorkshopRewindOutcome {
  summary: WorkshopRewindCutSummary;
  /** Present only when a writer rewinds their own message (origin `'writer'`). */
  composerRestore?: WorkshopRewindComposerRestore;
  /** Present only when a writer rewinds their own widget message (origin `'writer'`). */
  widgetRestore?: WorkshopRewindWidgetRestore;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  degradedConversations: WorkshopConversationDegradation[];
}

export interface WorkshopBranchOutcome {
  /** The named session the branch was cut from. Branch never writes its file. */
  source: { sessionId: string; title: string };
  /** The new named session, now the live room. */
  branch: WorkshopStoredSessionSummary;
  summary: WorkshopRewindCutSummary;
  /** Present only when the writer branched from their own message. */
  composerRestore?: WorkshopRewindComposerRestore;
  /** Present only when the writer branched from their own widget message. */
  widgetRestore?: WorkshopRewindWidgetRestore;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  degradedConversations: WorkshopConversationDegradation[];
}

export interface WorkshopSessionHydrateResult {
  restored: boolean;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  degradedConversations?: WorkshopConversationDegradation[];
}

export interface WorkshopSessionListData {
  availability: WorkshopSessionStoreAvailability;
  current?: WorkshopSessionSummary;
  sessions: WorkshopSessionSummary[];
  truncated: boolean;
  searchTruncated: boolean;
}

/**
 * What a reset actually destroyed. Empty for an ordinary new session, which
 * preserves the working set; populated only for a full reset, and captured
 * before the aggregate is mutated so the caller can log specifics.
 */
export interface WorkshopResetSummary {
  excerptLabel?: string;
  attachmentLabels: string[];
}

export interface WorkshopSessionPersistenceCoordinatorOptions {
  now?: () => Date;
  idFactory?: () => string;
  ensureAssistantReady?: () => PromiseLike<unknown>;
}

export type WorkshopSessionSaveStatus = WorkshopSessionSaveStatusMessage['payload'];

const normalizedIso = (date: Date): string => date.toISOString();

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** What a cut kept and removed, for one log line: counts and keys, never content. */
function describeWorkshopCut(
  cut: WorkshopRewindCut,
  cutRoom: WorkshopSessionRewindResult,
  before: readonly WorkshopRetainedArchiveEntry[]
): string {
  const after = new Map(cutRoom.conversations.map((entry) => [entry.key, entry.messages.length]));
  const histories = before
    .map((entry) => `${entry.key} ${entry.messages.length}→${after.get(entry.key) ?? 'dropped'}`)
    .join(', ') || 'none';
  const { summary } = cutRoom;
  return `cut=${cut.kind}:${cut.turnId}, ` +
    `keptThrough=${summary.keptThroughTurnId}, removedTurns=${summary.removedTurnCount}, ` +
    `removedTodos=${summary.removedTodoCount}, messages=${histories}, ` +
    `dropped=${summary.droppedConversationKeys.join(',') || 'none'}` +
    (summary.releasedWidgetConfigIds.length > 0
      ? `, releasedWidgets=${summary.releasedWidgetConfigIds.join(',')}`
      : '') +
    (cutRoom.unverifiedConversationKeys.length > 0
      ? `, unverifiedMarks=${cutRoom.unverifiedConversationKeys.join(',')}`
      : '');
}

export class WorkshopSessionPersistenceCoordinator {
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly ensureAssistantReady?: () => PromiseLike<unknown>;
  private identity: LiveSessionIdentity;
  private activeNamedSessionId?: string;
  private acceptedNamedCheckpoint?: WorkshopPersistedSessionV2;
  private readonly sessionSaveStatusListeners = new Set<
    (event: WorkshopSessionSaveStatus) => void
  >();
  private initialized = false;
  private initializePromise?: Promise<WorkshopSessionHydrateResult>;
  private autosaveQueue: Promise<void> = Promise.resolve();
  private sessionOperationQueue: Promise<void> = Promise.resolve();
  private pendingSessionOperations = 0;
  private resumePending = false;
  private localWorkPending = false;
  private dirtyRevision = 0;
  private writtenRevision = 0;
  private degradedConversationKeys: WorkshopConversationLogicalKey[] = [];
  private degradedConversations: WorkshopConversationDegradation[] = [];
  private pendingRecoveryNotices: WorkshopSessionRecoveryNoticeMessage['payload'][] = [];
  private currentCheckpointError?: string;
  private pendingRollingMirror?: WorkshopPersistedSessionV2;
  private lastSessionSaveStatus?: WorkshopSessionSaveStatus;
  // These notices describe files already committed, so hydration/rollback must not erase them.
  private savedRecoveryNotices: WorkshopSessionRecoveryNoticeMessage['payload'][] = [];
  private acceptedWorkspaceRoot?: string;
  private initialUnavailableReason?: Extract<
    WorkshopSessionStoreAvailability,
    { available: false }
  >['reason'];

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly assistantToolService: AssistantToolService,
    private readonly conversationSettingsService: WorkshopConversationSettingsService,
    private readonly time: WorkshopSessionTimeService,
    private readonly store: WorkshopSessionStore,
    private readonly outputChannel: LogSink,
    options: WorkshopSessionPersistenceCoordinatorOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
    this.ensureAssistantReady = options.ensureAssistantReady;
    const createdAt = normalizedIso(this.now());
    this.identity = {
      sessionId: this.idFactory(),
      title: this.defaultTitle(createdAt),
      createdAt
    };
  }

  availability(): WorkshopSessionStoreAvailability {
    return this.store.availability();
  }

  hasPendingWrite(): boolean {
    return this.dirtyRevision > this.writtenRevision || this.pendingRollingMirror !== undefined;
  }

  getDegradedConversationKeys(): WorkshopConversationLogicalKey[] {
    return [...this.degradedConversationKeys];
  }

  getDegradedConversations(): WorkshopConversationDegradation[] {
    return this.degradedConversations.map((entry) => ({ ...entry }));
  }

  consumeRecoveryNotices(): WorkshopSessionRecoveryNoticeMessage['payload'][] {
    const notices = [...this.pendingRecoveryNotices, ...this.savedRecoveryNotices]
      .map((notice) => ({ ...notice }));
    this.pendingRecoveryNotices = [];
    this.savedRecoveryNotices = [];
    return notices;
  }

  isCurrentCheckpointProtected(): boolean {
    return this.currentCheckpointError !== undefined;
  }

  getCurrentCheckpointError(): string | undefined {
    return this.currentCheckpointError;
  }

  isSessionOperationPending(): boolean {
    return this.pendingSessionOperations > 0;
  }

  addSessionSaveStatusListener(
    listener: (event: WorkshopSessionSaveStatus) => void
  ): () => void {
    this.sessionSaveStatusListeners.add(listener);
    return () => this.sessionSaveStatusListeners.delete(listener);
  }

  async waitForSessionOperations(): Promise<void> {
    await this.initialize();
    await this.sessionOperationQueue;
    if (this.lastSessionSaveStatus) {
      this.emitSessionSaveStatus(this.lastSessionSaveStatus);
    }
  }

  /**
   * Hydrate persisted state once per extension-host lifetime. A second webview
   * asks for the same live aggregate and cannot create a false resume marker.
   */
  initialize(): Promise<WorkshopSessionHydrateResult> {
    if (this.initializePromise) {
      return this.initializePromise;
    }
    this.initializePromise = this.initializeOnce();
    return this.initializePromise;
  }

  private async initializeOnce(): Promise<WorkshopSessionHydrateResult> {
    const availability = this.store.availability();
    if (availability.available) {
      this.acceptedWorkspaceRoot = availability.rootPath;
    } else {
      this.initialUnavailableReason = availability.reason;
    }
    let result: WorkshopSessionHydrateResult = {
      restored: false,
      degradedConversationKeys: [],
      degradedConversations: []
    };
    if (availability.available) {
      try {
        const current = await this.readCurrentCheckpoint();
        if (current) {
          // current.json locates the session; its named checkpoint owns the truth.
          // An inconclusive lookup permits rolling recovery, never a named write.
          let named: WorkshopPersistedSessionCheckpointDecodeResult | undefined;
          try {
            named = await this.readNamedCheckpoint(current.session.sessionId);
          } catch (error) {
            this.outputChannel.appendLine(
              `[WorkshopSessionPersistence] Named association unconfirmed; restoring current.json only: ${this.errorMessage(error)}`
            );
          }
          const authoritative = named ?? current;
          const cleanRolling = isCleanRollingCheckpoint(current.session);
          if (named && cleanRolling) {
            this.outputChannel.appendLine(
              `[WorkshopSessionPersistence] Clean rolling cache; adopting named without local recovery (id=${named.session.sessionId})`
            );
          }
          if (named && !cleanRolling) {
            await this.preserveDisplacedLocalSession(current.session, named.session);
          }
          if (named) {
            this.activeNamedSessionId = named.session.sessionId;
            this.acceptedNamedCheckpoint = named.session;
            this.outputChannel.appendLine(
              `[WorkshopSessionPersistence] Restoring authoritative named checkpoint ` +
              `(id=${named.session.sessionId}, turns=${named.session.workshop.turns.length})`
            );
          }
          result = await this.hydrate(authoritative.session, true, authoritative);
          if (named) {
            this.localWorkPending = false;
            await this.scheduleRollingMirror(named.session);
          } else {
            this.localWorkPending = !cleanRolling;
          }
        } else {
          this.recordStartMarker();
          this.markDirty('initial session');
        }
      } catch (error) {
        this.activeNamedSessionId = undefined;
        this.acceptedNamedCheckpoint = undefined;
        const details = this.errorMessage(error);
        this.currentCheckpointError = details;
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] Current session restore failed; rolling autosave paused: ${details}`
        );
        this.recordStartMarker();
      }
    } else {
      this.recordStartMarker();
      this.outputChannel.appendLine(
        `[WorkshopSessionPersistence] Persistence unavailable (${availability.reason}); Workshop remains live in memory`
      );
    }
    this.initialized = true;
    return result;
  }

  /** Called only once an actual message/tool interaction is about to begin. */
  beginInteraction(): ReturnType<WorkshopSessionService['recordSessionMarker']> | undefined {
    if (!this.resumePending) {
      return undefined;
    }
    this.resumePending = false;
    return this.session.recordSessionMarker('resume', this.time.describeVisibleMarker('resume'));
  }

  private async mirrorNamedCheckpoint(checkpoint: WorkshopPersistedSessionV2): Promise<void> {
    // Hydration/provider setup may already have awaited. Recheck the named source before replacing the
    // rolling cache, and preserve its original payload rather than a hydrated projection.
    const latest = await this.readNamedCheckpoint(checkpoint.sessionId);
    if (!latest || !hasSameWorkshopCheckpoint(latest.session, checkpoint)) {
      throw new WorkshopNamedSessionChangedError();
    }
    await this.store.writeCurrent(cleanRollingCheckpoint(checkpoint));
  }

  /** A named commit/load succeeded; failure of its cache copy is independently retryable. */
  private async scheduleRollingMirror(checkpoint: WorkshopPersistedSessionV2): Promise<void> {
    this.pendingRollingMirror = checkpoint;
    await this.retryRollingMirror();
  }

  private async retryRollingMirror(): Promise<void> {
    const checkpoint = this.pendingRollingMirror;
    if (!checkpoint) {
      return;
    }
    try {
      this.assertAcceptedWorkspace();
      // A rescue Save-as-new must never overwrite an unreadable original current.json.
      if (this.currentCheckpointError) {
        throw new Error(this.currentCheckpointError);
      }
      await this.mirrorNamedCheckpoint(checkpoint);
      if (this.pendingRollingMirror === checkpoint) {
        this.pendingRollingMirror = undefined;
        if (this.lastSessionSaveStatus?.status === 'error' && this.dirtyRevision <= this.writtenRevision) {
          this.emitSessionSaveStatus({ sessionId: checkpoint.sessionId, status: 'saved' });
        }
      }
    } catch (error) {
      const detail = `The named session is available, but current.json could not be updated. ${this.errorMessage(error)}`;
      this.outputChannel.appendLine(`[WorkshopSessionPersistence] Rolling mirror pending: ${detail}`);
      this.emitSessionSaveStatus({ sessionId: checkpoint.sessionId, status: 'error', error: detail });
    }
  }

  /** Mark one fully committed mutation for ordered rolling autosave. */
  markDirty(reason: string): void {
    this.localWorkPending = true;
    // New author work supersedes any older cache-only retry.
    this.pendingRollingMirror = undefined;
    this.time.touch();
    try {
      this.assertAcceptedWorkspace();
    } catch (error) {
      this.protectCurrentCheckpoint(error, reason);
      return;
    }
    if (this.currentCheckpointError) {
      this.outputChannel.appendLine(
        `[WorkshopSessionPersistence] Autosave skipped while current.json is protected ` +
        `(reason=${reason}): ${this.currentCheckpointError}`
      );
      this.emitSessionSaveStatus({
        sessionId: this.identity.sessionId,
        status: 'error',
        error: this.currentCheckpointError
      });
      return;
    }
    this.dirtyRevision += 1;
    const revision = this.dirtyRevision;
    const sessionId = this.identity.sessionId;
    const namedSessionId = this.activeNamedSessionId;
    this.emitSessionSaveStatus({ sessionId, status: 'saving' });
    const initializationBarrier = this.initializePromise ?? this.initialize();
    const operationBarrier = this.sessionOperationQueue;
    this.autosaveQueue = Promise.all([
      this.autosaveQueue,
      initializationBarrier,
      operationBarrier
    ]).then(async () => {
      if (revision <= this.writtenRevision) {
        return;
      }
      if (!this.store.availability().available) {
        return;
      }
      try {
        this.assertAcceptedWorkspace();
        const snapshot = await this.capture(this.identity);
        if (namedSessionId) {
          const checkpoint = { ...snapshot, savedAt: normalizedIso(this.now()) };
          await this.writeNamedWithRollingRecovery(namedSessionId, checkpoint, revision);
        } else {
          await this.store.writeCurrent(snapshot);
        }
        this.writtenRevision = Math.max(this.writtenRevision, revision);
        if (revision >= this.dirtyRevision && !this.pendingRollingMirror) {
          this.emitSessionSaveStatus({ sessionId, status: 'saved' });
        }
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] ${this.pendingRollingMirror
            ? 'Named session committed; current.json mirror pending'
            : `current.json${namedSessionId ? ' + named session' : ''} committed`
          } (id=${sessionId}, revision=${revision}, reason=${reason})`
        );
      } catch (error) {
        if (error instanceof WorkshopSessionActiveRunPersistenceError) {
          this.outputChannel.appendLine(
            `[WorkshopSessionPersistence] Autosave deferred at active-run boundary ` +
            `(id=${sessionId}, revision=${revision}, reason=${reason})`
          );
          return;
        }
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] Autosave failed ` +
          `(id=${sessionId}, revision=${revision}, reason=${reason}): ${this.errorMessage(error)}`
        );
        if (revision >= this.dirtyRevision) {
          this.emitSessionSaveStatus({
            sessionId,
            status: 'error',
            error: this.errorMessage(error)
          });
        }
      }
    });
    void this.autosaveQueue;
  }

  /** Retry a dirty autosave after a run guard has cleared and await ordering. */
  async flush(): Promise<void> {
    // First let an already-scheduled write settle. Only enqueue a retry when
    // the revision is still dirty (for example, an active-run guard deferred
    // capture). This avoids manufacturing a second write/status transition
    // for every ordinary lifecycle flush.
    await this.autosaveQueue;
    if (this.dirtyRevision > this.writtenRevision) {
      this.markDirty('flush');
      await this.autosaveQueue;
    } else if (this.pendingRollingMirror) {
      await this.serializeSessionOperation(() => this.retryRollingMirror());
    }
  }

  async saveNamed(
    title: string,
    targetSessionId?: string
  ): Promise<WorkshopStoredSessionSummary> {
    return this.serializeSessionOperation(async () => {
      const normalizedTitle = requireWorkshopSessionTitle(title);
      const now = normalizedIso(this.now());
      if (targetSessionId !== undefined) {
        return this.updateActiveNamedSession(targetSessionId, normalizedTitle, now);
      }
      const checkpointIdentity: LiveSessionIdentity = {
        sessionId: this.idFactory(),
        title: normalizedTitle,
        createdAt: this.identity.createdAt
      };
      const revision = this.dirtyRevision;
      const checkpoint = {
        ...(await this.capture(checkpointIdentity)),
        savedAt: now,
        updatedAt: now
      };
      const summary = await this.store.saveNamed(checkpoint);
      // A failed named write never changes the live identity. After success,
      // the live room follows the checkpoint so later Save updates by id.
      this.identity = checkpointIdentity;
      this.activeNamedSessionId = checkpointIdentity.sessionId;
      this.acceptedNamedCheckpoint = checkpoint;
      this.localWorkPending = this.dirtyRevision > revision;
      this.writtenRevision = Math.max(this.writtenRevision, revision);
      await this.scheduleRollingMirror(checkpoint);
      return summary;
    });
  }

  async list(query?: string, signal?: AbortSignal): Promise<WorkshopSessionListData> {
    await this.initialize();
    await this.flush();
    this.assertAcceptedWorkspace();
    const availability = this.store.availability();
    if (!availability.available) {
      return {
        availability,
        sessions: [],
        truncated: false,
        searchTruncated: false
      };
    }
    const listed = await this.store.list(query, signal);
    return {
      availability,
      current: listed.current
        ? this.toMessageSummary(listed.current, 'current')
        : undefined,
      sessions: listed.sessions.map((summary) => this.toMessageSummary(summary, 'named')),
      truncated: listed.truncated,
      searchTruncated: listed.searchTruncated
    };
  }

  /** Hold room ownership across file reads so their results cannot reach another session. */
  runContextRefresh(refresh: () => Promise<void>): Promise<void> {
    return this.serializeSessionOperation(refresh);
  }

  /** Recheck disk on webview load, even when the host initialized before Git sync. */
  async refreshNamedSession(
    afterLoad?: (changed: boolean) => Promise<void>
  ): Promise<boolean> {
    return this.serializeSessionOperation(async () => {
      const changed = await this.refreshAssociatedNamedSession();
      await afterLoad?.(changed);
      return changed;
    });
  }

  private async refreshAssociatedNamedSession(): Promise<boolean> {
    // Discovery happens at startup or explicit Open. A deliberately detached
    // room must not be reattached just because Git restores its old file.
    if (!this.activeNamedSessionId) {
      return false;
    }
    const persisted = await this.readNamedCheckpoint(this.activeNamedSessionId);
    if (!persisted) {
      await this.detachMissingNamedSession();
      return false;
    }
    if (!this.acceptedNamedCheckpoint ||
        !hasSameWorkshopCheckpoint(persisted.session, this.acceptedNamedCheckpoint)) {
      await this.promoteNamedSession(persisted);
      return true;
    }
    await this.retryRollingMirror();
    return false;
  }

  async openNamed(
    sessionId: string,
    afterLoad?: () => Promise<void>
  ): Promise<WorkshopSessionHydrateResult> {
    return this.serializeSessionOperation(async () => {
      const persisted = await this.readNamedCheckpoint(sessionId);
      if (!persisted) {
        throw new WorkshopNamedSessionNotFoundError(sessionId);
      }
      const result = await this.promoteNamedSession(persisted);
      await afterLoad?.();
      return result;
    });
  }

  private async promoteNamedSession(
    persisted: WorkshopPersistedSessionCheckpointDecodeResult
  ): Promise<WorkshopSessionHydrateResult> {
    const hydration = await this.replaceLiveRoom(async () => {
      if (this.identity.sessionId === persisted.session.sessionId && this.localWorkPending) {
        await this.preserveDisplacedLocalSession(
          await this.capture(this.identity), persisted.session, this.acceptedNamedCheckpoint
        );
      }
      const promoted = await this.hydrate(persisted.session, false, persisted);
      this.activeNamedSessionId = persisted.session.sessionId;
      await this.mirrorNamedCheckpoint(persisted.session);
      this.acceptedNamedCheckpoint = persisted.session;
      this.localWorkPending = false;
      this.currentCheckpointError = undefined;
      this.pendingRollingMirror = undefined;
      this.emitSessionSaveStatus({ sessionId: this.identity.sessionId, status: 'saved' });
      // Queued pre-load revisions belong to the replaced room, not this one.
      this.writtenRevision = this.dirtyRevision;
      this.outputChannel.appendLine(
        `[WorkshopSessionPersistence] Named checkpoint promoted to current.json ` +
        `(id=${persisted.session.sessionId}, turns=${persisted.session.workshop.turns.length})`
      );
      return promoted;
    });
    return {
      restored: hydration.restored,
      degradedConversationKeys: hydration.degradedConversationKeys,
      degradedConversations: hydration.degradedConversations
    };
  }

  private requireAcceptedNamedCheckpoint(sessionId: string): WorkshopPersistedSessionV2 {
    if (this.acceptedNamedCheckpoint?.sessionId !== sessionId) {
      throw new WorkshopNamedSessionChangedError();
    }
    return this.acceptedNamedCheckpoint;
  }

  private async preserveDisplacedLocalSession(
    local: WorkshopPersistedSessionV2,
    incoming: WorkshopPersistedSessionV2,
    accepted?: WorkshopPersistedSessionV2
  ): Promise<void> {
    if (hasSameWorkshopRecoveryContent(local, incoming) ||
        (accepted && hasSameWorkshopRecoveryContent(local, accepted))) {
      return undefined;
    }
    // Save the complete local snapshot before hydration can replace either its
    // aggregate or provider histories. Failure must abort the replacement.
    const saved = await this.store.saveNamed({
      ...withoutRollingProvenance(local),
      sessionId: this.idFactory(),
      title: `${local.title} (local recovery)`,
      savedAt: normalizedIso(this.now())
    });
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Preserved displaced local session in ${saved.fileName}`
    );
    this.savedRecoveryNotices.push({
      code: 'local-session-preserved',
      sessionId: saved.sessionId,
      recoveryFileName: saved.fileName,
      message: `Your differing local work was preserved as ` +
        `"${saved.title}" in Sessions (${saved.fileName}).`
    });
  }

  async renameNamed(sessionId: string, title: string): Promise<WorkshopStoredSessionSummary> {
    return this.serializeSessionOperation(async () => {
      if (this.activeNamedSessionId === sessionId) {
        return this.updateActiveNamedSession(
          sessionId,
          requireWorkshopSessionTitle(title),
          normalizedIso(this.now())
        );
      }
      return this.store.renameNamed(sessionId, requireWorkshopSessionTitle(title));
    });
  }

  async duplicateNamed(
    sourceSessionId: string,
    requestedTitle?: string
  ): Promise<WorkshopStoredSessionSummary> {
    return this.serializeSessionOperation(async () => {
      const source = await this.store.readNamedWithRecovery(sourceSessionId);
      if (!source) {
        throw new Error(`Named Workshop session ${sourceSessionId} was not found.`);
      }
      if (source.recoveryNotices.length > 0) {
        throw new Error(
          'Open this Workshop session before renaming or duplicating it so its saved configuration can be recovered deliberately.'
        );
      }
      const now = normalizedIso(this.now());
      const duplicate: WorkshopPersistedSessionV2 = {
        ...source.session,
        sessionId: this.idFactory(),
        title: requireWorkshopSessionTitle(requestedTitle ?? `${source.session.title} copy`),
        createdAt: now,
        updatedAt: now,
        savedAt: now
      };
      return this.store.duplicateNamed(sourceSessionId, duplicate);
    });
  }

  async deleteNamed(sessionId: string): Promise<void> {
    return this.serializeSessionOperation(async () => {
      try {
        await this.store.deleteNamed(sessionId);
      } catch (error) {
        if (!(error instanceof WorkshopNamedSessionNotFoundError) || this.activeNamedSessionId !== sessionId) {
          throw error;
        }
      }
      if (this.activeNamedSessionId === sessionId) {
        await this.detachMissingNamedSession();
      }
    });
  }

  private async detachMissingNamedSession(): Promise<void> {
    const snapshot = await this.capture(this.identity);
    await this.store.writeCurrent(snapshot);
    this.activeNamedSessionId = undefined;
    this.acceptedNamedCheckpoint = undefined;
    this.pendingRollingMirror = undefined;
    this.writtenRevision = this.dirtyRevision;
    this.emitSessionSaveStatus({ sessionId: this.identity.sessionId, status: 'saved' });
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Named checkpoint missing; autosave continues to current.json (id=${this.identity.sessionId})`
    );
    this.pendingRecoveryNotices.push({
      code: 'named-session-missing',
      sessionId: this.identity.sessionId,
      message: 'The saved file is no longer on disk. Your room is preserved in current.json; use Save as new to create a named session.'
    });
  }

  async resolveRevealPath(sessionId: string | 'current'): Promise<string> {
    await this.initialize();
    this.assertAcceptedWorkspace();
    return this.store.resolveRevealPath(sessionId);
  }

  /** Start a fresh thread while preserving the aggregate's working set. */
  /**
   * Replace the live room with a fresh one and promote it to `current.json`.
   *
   * `clearWorkingSet` additionally drops the excerpt, the shelf, and every
   * context attachment. Named sessions on disk are never touched by either
   * form; a write failure rolls the whole thing back.
   */
  async resetSession(
    options: { clearWorkingSet?: boolean } = {}
  ): Promise<WorkshopResetSummary> {
    return this.serializeSessionOperation(async () => {
      const reset = await this.replaceLiveRoom(async () => {
        // Read the working set BEFORE the aggregate drops it. A destructive
        // reset is the one action here that can be disputed later, and "it
        // deleted my context" is unanswerable against a log that only says a
        // wipe happened.
        const cleared: WorkshopResetSummary = options.clearWorkingSet
          ? this.describeClearedWorkingSet()
          : { attachmentLabels: [] };
        const discardedConversationIds = this.session.reset(options);
        this.time.reset();
        const createdAt = normalizedIso(this.now());
        this.identity = {
          sessionId: this.idFactory(),
          title: this.defaultTitle(createdAt),
          createdAt
        };
        this.activeNamedSessionId = undefined;
        this.acceptedNamedCheckpoint = undefined;
        this.degradedConversationKeys = [];
        this.degradedConversations = [];
        this.recordStartMarker();
        const promoted = await this.capture(this.identity);
        await this.store.writeCurrent(promoted);
        this.currentCheckpointError = undefined;
        this.pendingRollingMirror = undefined;
        this.localWorkPending = false;
        this.writtenRevision = this.dirtyRevision;
        this.emitSessionSaveStatus({ sessionId: this.identity.sessionId, status: 'saved' });
        return { discardedConversationIds, cleared };
      });
      return reset.cleared;
    });
  }

  /** Name the writer-authored working set a full reset is about to destroy. */
  private describeClearedWorkingSet(): WorkshopResetSummary {
    const excerpt = this.session.getExcerpt() ?? this.session.getShelvedExcerpt();
    return {
      excerptLabel: excerpt
        ? `${workshopExcerptSourcePath(excerpt.source) ?? 'Pasted excerpt'} v${excerpt.version}`
        : undefined,
      attachmentLabels: this.session
        .getContextAttachments()
        .map((attachment) => attachment.label)
    };
  }

  /**
   * Rewind the live room to a rest point (ADR 2026-09-30 §6). Generic over its
   * origin: a writer's bubble action today, a Side Quest's End later.
   *
   * The cut is re-checked here, because webview gating is advisory. The live
   * room is exported exactly as a checkpoint captures it, cut by the pure
   * transform, installed through Open's promotion core, and written before
   * the operation reports success. Any failure restores the prior room, and
   * the prior provider conversations are discarded only after the write.
   */
  async rewindTo(
    cut: WorkshopRewindCut,
    options: { origin: WorkshopRewindOrigin }
  ): Promise<WorkshopRewindOutcome> {
    // A pending operation may replace this room. A cut chosen against it must
    // not wait in line and then run against another one.
    if (this.isSessionOperationPending()) {
      throw new WorkshopRewindRefusedError('busy');
    }
    return this.serializeSessionOperation(async () => {
      const availability = this.store.availability();
      if (!availability.available) {
        throw new WorkshopSessionStoreUnavailableError(availability.reason);
      }
      const evaluation = this.session.evaluateRewindCut(cut);
      if (!evaluation.ok) {
        throw new WorkshopRewindRefusedError(evaluation.reason);
      }
      const { installed, rewound, before } = await this.replaceLiveRoom(async () => {
        const live = await this.exportLiveRoom();
        const cutRoom = rewindWorkshopSession({ ...live, cut });
        const room = await this.installRoom(cutRoom.workshop, cutRoom.conversations);
        // A dropped persona's next conversation starts fresh, time frame
        // included. Inside the transaction, so rollback restores the notices.
        this.time.forgetNotices(
          cutRoom.summary.droppedConversationKeys.filter(isWorkshopPersonaConversationKey)
        );
        await this.commitRewoundRoom();
        return {
          discardedConversationIds: room.discardedConversationIds,
          installed: room,
          rewound: cutRoom,
          before: live.conversations
        };
      });
      this.degradedConversationKeys = installed.degradedConversationKeys;
      this.degradedConversations = installed.degradedConversations;
      this.pendingRecoveryNotices.push(...installed.recoveryNotices.map((notice) => ({ ...notice })));
      this.logRewind(cut, options.origin, rewound, before);
      return {
        summary: rewound.summary,
        composerRestore: options.origin === 'writer' ? rewound.composerRestore : undefined,
        widgetRestore: options.origin === 'writer' ? rewound.widgetRestore : undefined,
        degradedConversationKeys: [...installed.degradedConversationKeys],
        degradedConversations: installed.degradedConversations.map((entry) => ({ ...entry }))
      };
    });
  }

  /**
   * Branch from a rest point of the saved room (ADR 2026-09-30 §7): save the
   * cut room as a new named session, then open it through the named-session
   * promotion that Open uses. The source session's file is never written.
   * A failure before the branch is saved changes nothing and leaves no file;
   * a failure while opening it restores the prior room and reports the saved
   * branch, which stays openable from Sessions.
   */
  async branchFrom(
    cut: WorkshopRewindCut,
    options: { title?: string } = {}
  ): Promise<WorkshopBranchOutcome> {
    // As for Rewind: a cut chosen against this room must not wait in line and
    // then run against another one.
    if (this.isSessionOperationPending()) {
      throw new WorkshopRewindRefusedError('busy');
    }
    return this.serializeSessionOperation(async () => {
      const availability = this.store.availability();
      if (!availability.available) {
        throw new WorkshopSessionStoreUnavailableError(availability.reason);
      }
      // D2: an unnamed room's only durable copy is current.json, which
      // opening the branch would replace.
      const sourceSessionId = this.activeNamedSessionId;
      if (!sourceSessionId) {
        throw new WorkshopBranchRefusedError('unsaved-session');
      }
      // Queued autosaves have settled by now. Branch never writes the source,
      // so it cannot flush work they failed to save, and opening the branch
      // would leave that work behind.
      if (this.localWorkPending || this.dirtyRevision > this.writtenRevision) {
        throw new WorkshopBranchRefusedError('unsaved-changes');
      }
      const evaluation = this.session.evaluateRewindCut(cut);
      if (!evaluation.ok) {
        throw new WorkshopRewindRefusedError(evaluation.reason);
      }
      const source = { sessionId: sourceSessionId, title: this.identity.title };
      const live = await this.exportLiveRoom();
      const branched = rewindWorkshopSession({ ...live, cut });
      // The store writes atomically: a failed save leaves no branch file.
      const saved = await this.store.saveNamed(workshopBranchCheckpoint({
        sessionId: this.idFactory(),
        title: options.title === undefined
          ? workshopBranchTitle(source.title)
          : requireWorkshopSessionTitle(options.title),
        now: normalizedIso(this.now()),
        timezone: this.time.exportState().timezone,
        summary: this.buildSummary(branched.workshop),
        workshop: branched.workshop,
        conversations: branched.conversations
      }));
      let opened: WorkshopSessionHydrateResult;
      try {
        // Open the branch exactly as Sessions would: from its file.
        const persisted = await this.readNamedCheckpoint(saved.sessionId);
        if (!persisted) {
          throw new WorkshopNamedSessionNotFoundError(saved.sessionId);
        }
        opened = await this.promoteNamedSession(persisted);
      } catch (error) {
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] Branch saved but not opened; prior room restored ` +
          `(source=${source.sessionId}, branch=${saved.sessionId}, file=${saved.fileName}): ` +
          this.errorMessage(error)
        );
        throw new WorkshopBranchNotOpenedError(saved, this.errorMessage(error));
      }
      this.outputChannel.appendLine(
        `[WorkshopSessionPersistence] Room branched (source=${source.sessionId}, ` +
        `branch=${saved.sessionId}, file=${saved.fileName}, ` +
        `${describeWorkshopCut(cut, branched, live.conversations)})`
      );
      return {
        source,
        branch: saved,
        summary: branched.summary,
        composerRestore: branched.composerRestore,
        widgetRestore: branched.widgetRestore,
        degradedConversationKeys: [...opened.degradedConversationKeys],
        degradedConversations: (opened.degradedConversations ?? []).map((entry) => ({ ...entry }))
      };
    });
  }

  /**
   * Write the rewound room durably before reporting success (ADR 2026-09-30,
   * Sprint 02 kickoff item 5). A rewind is author work, so it follows the
   * autosave's authority rules: an associated named file is updated only
   * while it is still the checkpoint this room accepted, and a protected
   * current.json is never overwritten.
   */
  private async commitRewoundRoom(): Promise<void> {
    this.localWorkPending = true;
    this.pendingRollingMirror = undefined;
    this.time.touch();
    const sessionId = this.identity.sessionId;
    if (this.currentCheckpointError) {
      this.outputChannel.appendLine(
        `[WorkshopSessionPersistence] Rewound room kept in memory while current.json is protected: ` +
        this.currentCheckpointError
      );
      this.emitSessionSaveStatus({ sessionId, status: 'error', error: this.currentCheckpointError });
      return;
    }
    const revision = this.dirtyRevision;
    const snapshot = await this.capture(this.identity);
    const namedSessionId = this.activeNamedSessionId;
    if (namedSessionId) {
      const checkpoint = { ...snapshot, savedAt: normalizedIso(this.now()) };
      await this.store.updateNamed(
        namedSessionId, checkpoint, this.requireAcceptedNamedCheckpoint(namedSessionId)
      );
      await this.acceptNamedWrite(checkpoint, revision);
    } else {
      await this.store.writeCurrent(snapshot);
      this.writtenRevision = Math.max(this.writtenRevision, revision);
    }
    if (!this.pendingRollingMirror) {
      this.emitSessionSaveStatus({ sessionId, status: 'saved' });
    }
  }

  /** One line per rewind: counts and keys only, never message content. */
  private logRewind(
    cut: WorkshopRewindCut,
    origin: WorkshopRewindOrigin,
    rewound: WorkshopSessionRewindResult,
    before: readonly WorkshopRetainedArchiveEntry[]
  ): void {
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Room rewound (origin=${origin}, ` +
      `${describeWorkshopCut(cut, rewound, before)})`
    );
  }

  /** Both halves of the live room, exactly as a checkpoint captures them. */
  private async exportLiveRoom(): Promise<{
    workshop: WorkshopSessionStateV1;
    conversations: WorkshopRetainedArchiveEntry[];
  }> {
    // Assistant generation setup may await. It must settle before either half
    // of the coherent snapshot is read.
    await this.ensureAssistantReady?.();
    const workshop = this.session.exportCommittedState();
    const targets = this.exportTargets(workshop);
    const conversations = targets.length > 0
      ? this.assistantToolService.exportWorkshopConversationArchive(targets)
      : [];
    return { workshop, conversations };
  }

  private async capture(identity: LiveSessionIdentity): Promise<WorkshopPersistedSessionV2> {
    const { workshop, conversations } = await this.exportLiveRoom();
    const temporal = this.time.exportState();
    return {
      schemaVersion: CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION,
      sessionId: identity.sessionId,
      title: identity.title,
      createdAt: identity.createdAt,
      updatedAt: temporal.lastActivityAt,
      temporal,
      summary: this.buildSummary(workshop),
      workshop,
      conversations
    };
  }

  private exportTargets(
    workshop: WorkshopSessionStateV1
  ): WorkshopConversationExportTarget<WorkshopConversationLogicalKey>[] {
    const targets: WorkshopConversationExportTarget<WorkshopConversationLogicalKey>[] = [];
    const hostConversationId = this.session.getHostConversationId();
    if (workshop.participants.host.conversationKey && hostConversationId) {
      targets.push({
        key: 'host',
        conversationId: hostConversationId,
        role: 'host',
        personaId: workshop.participants.host.personaId
      });
    }
    for (const sidecar of workshop.participants.toolSidecars) {
      const conversationId = this.session.getToolSidecarConversationId(sidecar.toolId);
      if (conversationId) {
        targets.push({
          key: sidecar.conversationKey,
          conversationId,
          role: 'tool',
          toolId: sidecar.toolId
        });
      }
    }
    for (const guest of workshop.participants.personaGuests) {
      if (!guest.conversationKey || guest.liveness !== 'live') {
        continue;
      }
      const conversationId = this.session.getPersonaGuestConversationId(guest.personaId);
      if (conversationId) {
        targets.push({
          key: guest.conversationKey,
          conversationId,
          role: 'guest',
          personaId: guest.personaId
        });
      }
    }
    return targets;
  }

  private async hydrate(
    persisted: WorkshopPersistedSessionV2,
    retirePreviousConversations = true,
    checkpointRecovery?: Pick<
      WorkshopPersistedSessionCheckpointDecodeResult,
      'migrations' | 'normalizations' | 'recoveryNotices'
    >
  ): Promise<WorkshopHydrationTransaction> {
    // Structural preflight happens before ConversationManager can mint ids.
    const temporal = parseWorkshopSessionTemporalStateV1(persisted.temporal);
    const installed = await this.installRoom(
      persisted.workshop,
      persisted.conversations,
      checkpointRecovery
    );
    const personaResumeKeys: WorkshopPersonaConversationKey[] = [
      'host',
      ...installed.workshop.participants.personaGuests
        .filter((guest) => guest.liveness === 'live')
        .map((guest) => workshopGuestConversationKey(guest.personaId))
    ];
    this.time.hydrate(temporal, personaResumeKeys);
    this.identity = {
      sessionId: persisted.sessionId,
      title: persisted.title,
      createdAt: persisted.createdAt
    };
    this.degradedConversationKeys = installed.degradedConversationKeys;
    this.degradedConversations = installed.degradedConversations;
    this.pendingRecoveryNotices = [
      ...(checkpointRecovery?.recoveryNotices ?? []),
      ...installed.recoveryNotices
    ].map((notice) => ({ ...notice }));
    this.resumePending = true;
    if (retirePreviousConversations) {
      installed.discardedConversationIds.forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
    }
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Session hydrated ` +
      `(id=${persisted.sessionId}, conversations=${installed.importedConversationCount}, degraded=${
        installed.degradedConversations.map(({ key, reason }) => `${key}: ${reason}`).join('; ') || 'none'
      })`
    );
    return {
      restored: true,
      degradedConversationKeys: installed.degradedConversationKeys,
      degradedConversations: installed.degradedConversations,
      discardedConversationIds: installed.discardedConversationIds
    };
  }

  /**
   * Open's promotion core, shared with Rewind: import a checkpoint's
   * histories (fresh runtime ids, system prompts rebuilt from current
   * settings) and hydrate its aggregate over them. It changes neither the
   * session identity nor its temporal state, and it retires nothing: the
   * caller decides when the replaced conversations go.
   */
  private async installRoom(
    workshopValue: unknown,
    conversations: WorkshopPersistedSessionV2['conversations'],
    checkpointRecovery?: Pick<
      WorkshopPersistedSessionCheckpointDecodeResult,
      'migrations' | 'normalizations'
    >
  ): Promise<WorkshopRoomInstallation> {
    // Structural preflight happens before ConversationManager can mint ids.
    const workshop = parseWorkshopSessionStateV1(workshopValue);
    const descriptors = this.importDescriptors(workshop);
    const expectedKeys = new Set(descriptors.keys());
    const archiveEntries = conversations.filter(
      (entry): entry is ConversationArchiveEntryV1<WorkshopConversationLogicalKey> =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof entry.key === 'string' &&
        expectedKeys.has(entry.key as WorkshopConversationLogicalKey)
    );
    if (archiveEntries.length > 0) {
      await this.ensureAssistantReady?.();
    }
    const targets: WorkshopConversationImportTarget<WorkshopConversationLogicalKey>[] =
      archiveEntries.flatMap((entry) => {
        const descriptor = descriptors.get(entry.key);
        return descriptor ? [{ entry, ...descriptor }] : [];
      });
    const outcomes = targets.length > 0
      ? await this.assistantToolService.importWorkshopConversationArchive(targets, {
          behavior: this.session.getConversationBehavior(),
          writerProfile: this.conversationSettingsService.getWriterProfile(),
          standingDirectiveFrames: renderWorkshopStandingDirectiveFramesFromState(workshop)
        })
      : [];

    const bindings: Partial<Record<WorkshopConversationLogicalKey, string>> = {};
    // Exactly what each import restored, so a participant without a mark gets
    // a baseline describing the history it really holds (ADR 2026-09-30 §3).
    const importedHistory: WorkshopImportedRetainedHistory = {};
    const importedEntries = new Map(targets.map((target) => [target.entry.key, target.entry]));
    for (const outcome of outcomes) {
      if (outcome.status === 'imported') {
        bindings[outcome.key] = outcome.conversationId;
        const entry = importedEntries.get(outcome.key);
        if (entry) {
          importedHistory[outcome.key] = {
            messageCount: entry.messages.length,
            contextSourceCount: entry.contextSources.length
          };
        }
      }
    }
    const importedIds = outcomes.flatMap((outcome) =>
      outcome.status === 'imported' ? [outcome.conversationId] : []
    );
    let hydration;
    try {
      hydration = this.session.hydrateCommittedState(
        workshop,
        bindings as WorkshopRuntimeConversationBindings,
        this.session.getConversationBehavior(),
        importedHistory
      );
      this.logSchemaMigrations(checkpointRecovery?.migrations ?? []);
      this.logCheckpointNormalizations(unique([
        ...(checkpointRecovery?.normalizations ?? []),
        ...hydration.normalizations
      ]));
    } catch (error) {
      importedIds.forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
      throw error;
    }

    const importedKeys = new Set(
      outcomes.flatMap((outcome) => outcome.status === 'imported' ? [outcome.key] : [])
    );
    const missingKeys = [...expectedKeys].filter((key) => !importedKeys.has(key));
    const degradedKeys = unique([
      ...hydration.degradedConversationKeys,
      ...outcomes.flatMap((outcome) => outcome.status === 'degraded' ? [outcome.key] : []),
      ...missingKeys
    ]);
    const outcomeReasons = new Map(
      outcomes.flatMap((outcome) =>
        outcome.status === 'degraded' ? [[outcome.key, outcome.reason] as const] : []
      )
    );
    const degradedConversations = degradedKeys.map((key) => ({
      key,
      reason: outcomeReasons.get(key) ??
        (missingKeys.includes(key)
          ? 'No valid retained conversation archive was available for this participant.'
          : 'The retained conversation could not be rebound to this participant.')
    }));
    return {
      workshop,
      importedConversationCount: outcomes.length,
      degradedConversationKeys: degradedKeys,
      degradedConversations,
      discardedConversationIds: hydration.discardedConversationIds,
      recoveryNotices: hydration.recoveryNotices
    };
  }

  private async readCurrentCheckpoint(): Promise<
    WorkshopPersistedSessionCheckpointDecodeResult | undefined
  > {
    return this.store.readCurrentWithRecovery();
  }

  private async readNamedCheckpoint(
    sessionId: string
  ): Promise<WorkshopPersistedSessionCheckpointDecodeResult | undefined> {
    return this.store.readNamedWithRecovery(sessionId);
  }

  private importDescriptors(
    workshop: WorkshopSessionStateV1
  ): Map<
    WorkshopConversationLogicalKey,
    | { role: 'host'; personaId: WorkshopPersonaId }
    | { role: 'guest'; personaId: WorkshopPersonaId }
    | { role: 'tool'; toolId: WorkshopToolId }
  > {
    const descriptors = new Map<
      WorkshopConversationLogicalKey,
      | { role: 'host'; personaId: WorkshopPersonaId }
      | { role: 'guest'; personaId: WorkshopPersonaId }
      | { role: 'tool'; toolId: WorkshopToolId }
    >();
    if (workshop.participants.host.conversationKey) {
      descriptors.set('host', {
        role: 'host',
        personaId: workshop.participants.host.personaId
      });
    }
    workshop.participants.toolSidecars.forEach((sidecar) => {
      descriptors.set(sidecar.conversationKey, {
        role: 'tool',
        toolId: sidecar.toolId
      });
    });
    workshop.participants.personaGuests.forEach((guest) => {
      if (guest.conversationKey && guest.liveness === 'live') {
        descriptors.set(guest.conversationKey, {
          role: 'guest',
          personaId: guest.personaId
        });
      }
    });
    return descriptors;
  }

  private buildSummary(workshop: WorkshopSessionStateV1): WorkshopPersistedSummaryV1 {
    const excerpt = workshop.excerpt;
    const participantPersonaIds = unique([
      workshop.participants.host.personaId,
      ...workshop.participants.personaGuests.map((guest) => guest.personaId)
    ]);
    const excerptLabel = excerpt
      ? excerpt.source.kind === 'file'
        ? path.basename(excerpt.source.relativePath)
        : 'Pasted excerpt'
      : undefined;
    const excerptIdentity = excerpt
      ? excerpt.sourceFingerprint ??
        (excerpt.source.kind === 'file'
          ? excerpt.source.configuredResource
            ? `${excerpt.source.configuredResource.group}:${excerpt.source.configuredResource.path}`
            : excerpt.source.relativePath
          : createHash('sha256').update(excerpt.text).digest('hex'))
      : undefined;
    const previewTurn = [...workshop.turns]
      .reverse()
      .find((turn) => turn.participant !== 'session' && turn.content.trim().length > 0);
    return {
      hostPersonaId: workshop.participants.host.personaId,
      // Sprint 13A §11: scope is persisted alongside the room so restore and
      // the browser can say what KIND of session this is, rather than
      // inferring "open conversation" from a missing excerpt.
      scope: workshop.scope ?? null,
      participantPersonaIds,
      turnCount: workshop.turns.length,
      excerptWordCount: excerpt ? countWords(excerpt.text) : 0,
      excerptLabel,
      excerptIdentity,
      preview: previewTurn
        ? previewTurn.content.replace(/\s+/g, ' ').trim().slice(0, 180)
        : undefined
    };
  }

  private toMessageSummary(
    persisted: WorkshopStoredSessionSummary,
    kind: 'current' | 'named'
  ): WorkshopSessionSummary {
    const isCurrent = kind === 'current';
    return {
      sessionId: persisted.sessionId,
      title: persisted.title,
      fileName: persisted.fileName,
      kind: isCurrent ? 'current' : 'named',
      startedAt: Date.parse(persisted.startedAt),
      updatedAt: Date.parse(persisted.updatedAt),
      savedAt: persisted.savedAt ? Date.parse(persisted.savedAt) : undefined,
      timezone: persisted.timezone,
      hostPersonaId: persisted.hostPersonaId,
      participantPersonaIds: [...persisted.participantPersonaIds],
      turnCount: persisted.turnCount,
      excerptWordCount: persisted.excerptWordCount,
      scope: persisted.scope,
      excerptLabel: persisted.excerptLabel,
      excerptIdentity: persisted.excerptIdentity,
      preview: persisted.preview,
      degradedConversationKeys: isCurrent ? this.getDegradedConversationKeys() : undefined
    };
  }

  /**
   * Serialize session replacement and named-session mutations behind both
   * earlier operations and autosaves. A rejection is observable to the caller
   * but never poisons the queue for the next operation.
   */
  private serializeSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.pendingSessionOperations += 1;
    const initialization = this.initialize();
    const priorOperation = this.sessionOperationQueue;
    const priorWrites = this.autosaveQueue;
    const result = Promise.all([initialization, priorOperation, priorWrites]).then(() => {
      this.assertAcceptedWorkspace();
      return operation();
    });
    this.sessionOperationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result.finally(() => {
      this.pendingSessionOperations -= 1;
    });
  }

  private captureRollback(): LiveSessionRollback {
    const workshop = this.session.exportCommittedState();
    const bindings: Partial<Record<WorkshopConversationLogicalKey, string>> = {};
    for (const target of this.exportTargets(workshop)) {
      bindings[target.key] = target.conversationId;
    }
    return {
      identity: { ...this.identity },
      activeNamedSessionId: this.activeNamedSessionId,
      acceptedNamedCheckpoint: this.acceptedNamedCheckpoint,
      workshop,
      bindings,
      temporal: this.time.exportRuntimeState(),
      degradedConversationKeys: [...this.degradedConversationKeys],
      degradedConversations: this.getDegradedConversations(),
      resumePending: this.resumePending,
      localWorkPending: this.localWorkPending,
      pendingRollingMirror: this.pendingRollingMirror,
      currentCheckpointError: this.currentCheckpointError,
      recoveryNotices: this.pendingRecoveryNotices.map((notice) => ({ ...notice }))
    };
  }

  /**
   * The room-replacement transaction New, Open, Rewind and Branch share (ADR
   * 2026-09-30, Sprint 03 kickoff decision 1). `replace` prepares, installs
   * and durably writes the new room. Any failure restores the prior room over
   * its still-live conversations; the conversations the new room superseded
   * are discarded only once it has fully succeeded.
   */
  private async replaceLiveRoom<T extends WorkshopRoomReplacement>(
    replace: () => Promise<T>
  ): Promise<T> {
    const rollback = this.captureRollback();
    let replaced: T;
    try {
      replaced = await replace();
    } catch (error) {
      this.restoreRollback(rollback);
      throw error;
    }
    replaced.discardedConversationIds.forEach((conversationId) =>
      this.assistantToolService.discardConversation(conversationId)
    );
    return replaced;
  }

  /**
   * Rebind the prior aggregate to its still-live provider histories. Only
   * conversations introduced by the failed replacement are retired; the
   * protected rollback ids cannot be discarded even if replacement failed
   * before the aggregate was changed.
   */
  private restoreRollback(rollback: LiveSessionRollback): void {
    const restored = this.session.hydrateCommittedState(
      rollback.workshop,
      rollback.bindings,
      this.session.getConversationBehavior()
    );
    this.logCheckpointNormalizations(restored.normalizations);
    const protectedConversationIds = new Set(
      Object.values(rollback.bindings).filter(
        (conversationId): conversationId is string => typeof conversationId === 'string'
      )
    );
    restored.discardedConversationIds
      .filter((conversationId) => !protectedConversationIds.has(conversationId))
      .forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
    this.time.restoreRuntimeState(rollback.temporal);
    this.identity = { ...rollback.identity };
    this.resumePending = rollback.resumePending;
    this.localWorkPending = rollback.localWorkPending;
    this.pendingRollingMirror = rollback.pendingRollingMirror;
    this.currentCheckpointError = rollback.currentCheckpointError;
    this.activeNamedSessionId = rollback.activeNamedSessionId;
    this.acceptedNamedCheckpoint = rollback.acceptedNamedCheckpoint;
    this.degradedConversationKeys = [...rollback.degradedConversationKeys];
    this.degradedConversations = rollback.degradedConversations.map((entry) => ({ ...entry }));
    this.pendingRecoveryNotices = rollback.recoveryNotices.map((notice) => ({ ...notice }));
  }

  private recordStartMarker(): void {
    this.resumePending = false;
    this.session.recordSessionMarker('start', this.time.describeVisibleMarker('start'));
  }

  private logCheckpointNormalizations(
    normalizations: readonly WorkshopSessionCheckpointNormalization[]
  ): void {
    if (normalizations.length === 0) {
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Development checkpoint normalized ` +
      `(normalizations=${normalizations.join(', ')})`
    );
  }

  private logSchemaMigrations(
    migrations: WorkshopPersistedSessionCheckpointDecodeResult['migrations']
  ): void {
    if (migrations.length === 0) {
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Released session schema migrated ` +
      `(migrations=${migrations.join(', ')})`
    );
  }

  private defaultTitle(createdAt: string): string {
    const date = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(createdAt));
    return `Untitled session — ${workshopPersonaLabel(this.session.getSelectedPersonaId())} — ${date}`;
  }

  /** Commit the authoritative named checkpoint before its rolling mirror. */
  private async updateActiveNamedSession(
    sessionId: string,
    title: string,
    savedAt: string
  ): Promise<WorkshopStoredSessionSummary> {
    if (
      sessionId !== this.identity.sessionId ||
      sessionId !== this.activeNamedSessionId
    ) {
      throw new Error(
        'The saved session changed before it could be updated. Refresh Sessions and try again.'
      );
    }
    const nextIdentity: LiveSessionIdentity = { ...this.identity, title };
    const revision = this.dirtyRevision;
    const checkpoint = {
      ...(await this.capture(nextIdentity)),
      savedAt,
      updatedAt: savedAt
    };
    this.emitSessionSaveStatus({ sessionId, status: 'saving' });
    try {
      const summary = await this.writeNamedWithRollingRecovery(sessionId, checkpoint, revision);
      if (!this.pendingRollingMirror && this.dirtyRevision <= revision) {
        this.emitSessionSaveStatus({ sessionId, status: 'saved' });
      }
      return summary;
    } catch (error) {
      this.emitSessionSaveStatus({
        sessionId,
        status: 'error',
        error: this.errorMessage(error)
      });
      throw error;
    }
  }

  private async writeNamedWithRollingRecovery(
    sessionId: string,
    checkpoint: WorkshopPersistedSessionV2,
    savedRevision = this.dirtyRevision
  ): Promise<WorkshopStoredSessionSummary> {
    let summary: WorkshopStoredSessionSummary;
    this.pendingRollingMirror = undefined;
    this.localWorkPending = true;
    try {
      summary = await this.store.updateNamed(
        sessionId, checkpoint, this.requireAcceptedNamedCheckpoint(sessionId)
      );
    } catch (namedError) {
      // Authority and durability are separate: preserve live work without
      // advancing the named baseline or reporting the named save as complete.
      try {
        await this.store.writeCurrent({ ...checkpoint, ...this.identity });
      } catch (rollingError) {
        throw new Error(
          `${this.errorMessage(namedError)} Local recovery also failed: ${this.errorMessage(rollingError)}`
        );
      }
      throw namedError;
    }
    await this.acceptNamedWrite(checkpoint, savedRevision);
    return summary;
  }

  /** A named write landed: it becomes this room's accepted checkpoint. */
  private async acceptNamedWrite(
    checkpoint: WorkshopPersistedSessionV2,
    savedRevision: number
  ): Promise<void> {
    this.acceptedNamedCheckpoint = checkpoint;
    this.writtenRevision = Math.max(this.writtenRevision, savedRevision);
    if (this.dirtyRevision <= savedRevision) {
      this.localWorkPending = false;
    }
    this.identity = {
      sessionId: checkpoint.sessionId, title: checkpoint.title, createdAt: checkpoint.createdAt
    };
    // Named durability is complete even if its rolling mirror needs a retry.
    await this.scheduleRollingMirror(checkpoint);
  }

  private emitSessionSaveStatus(event: WorkshopSessionSaveStatus): void {
    this.lastSessionSaveStatus = { ...event };
    this.sessionSaveStatusListeners.forEach((listener) => listener({ ...event }));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * The aggregate hydrated at activation belongs to exactly one workspace
   * identity. A later root change cannot silently retarget that live room's
   * autosave; the extension host must be reloaded to establish a new owner.
   */
  private assertAcceptedWorkspace(): void {
    const current = this.store.availability();
    if (this.acceptedWorkspaceRoot !== undefined) {
      if (!current.available || current.rootPath !== this.acceptedWorkspaceRoot) {
        throw new Error(
          'The Workshop workspace changed after this session was loaded. Reload the extension host before saving or opening sessions.'
        );
      }
      return;
    }
    if (
      this.initialUnavailableReason !== undefined &&
      (current.available || current.reason !== this.initialUnavailableReason)
    ) {
      throw new Error(
        'The Workshop workspace changed after this session was loaded. Reload the extension host before saving or opening sessions.'
      );
    }
  }

  private protectCurrentCheckpoint(error: unknown, reason: string): void {
    const details = this.errorMessage(error);
    this.currentCheckpointError = details;
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Autosave stopped because the workspace identity changed ` +
      `(reason=${reason}): ${details}`
    );
  }
}
