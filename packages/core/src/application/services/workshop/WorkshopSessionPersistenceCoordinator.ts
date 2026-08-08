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
  parseWorkshopSessionTemporalStateV1,
  workshopGuestConversationKey
} from '@/application/services/workshop/WorkshopSessionTimeService';
import {
  WorkshopPersistedSessionCheckpointDecodeResult,
  WorkshopPersistedSessionV1,
  WorkshopPersistedSummaryV1
} from '@/application/services/workshop/WorkshopPersistedSession';
import type {
  WorkshopWidgetRecoveryNotice
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
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
  WorkshopSessionStore,
  WorkshopSessionStoreAvailability,
  WorkshopStoredSessionSummary
} from '@/infrastructure/storage/WorkshopSessionStore';
import { ConversationArchiveEntryV1 } from '@orchestration/ConversationManager';
import {
  WorkshopConversationDegradation,
  WorkshopPersonaId,
  WorkshopSessionSaveStatusMessage,
  WorkshopSessionSummary,
  WorkshopToolId,
  workshopExcerptSourcePath
} from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { countWords } from '@/utils/textUtils';

interface LiveSessionIdentity {
  sessionId: string;
  title: string;
  createdAt: string;
}

interface LiveSessionRollback {
  identity: LiveSessionIdentity;
  activeNamedSessionId?: string;
  workshop: WorkshopSessionStateV1;
  bindings: WorkshopRuntimeConversationBindings;
  temporal: ReturnType<WorkshopSessionTimeService['exportRuntimeState']>;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  degradedConversations: WorkshopConversationDegradation[];
  recoveryNotices: WorkshopWidgetRecoveryNotice[];
}

interface WorkshopHydrationTransaction extends WorkshopSessionHydrateResult {
  discardedConversationIds: string[];
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

export class WorkshopSessionPersistenceCoordinator {
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly ensureAssistantReady?: () => PromiseLike<unknown>;
  private identity: LiveSessionIdentity;
  private activeNamedSessionId?: string;
  private readonly sessionSaveStatusListeners = new Set<
    (event: WorkshopSessionSaveStatus) => void
  >();
  private initialized = false;
  private initializePromise?: Promise<WorkshopSessionHydrateResult>;
  private autosaveQueue: Promise<void> = Promise.resolve();
  private sessionOperationQueue: Promise<void> = Promise.resolve();
  private pendingSessionOperations = 0;
  private dirtyRevision = 0;
  private writtenRevision = 0;
  private degradedConversationKeys: WorkshopConversationLogicalKey[] = [];
  private degradedConversations: WorkshopConversationDegradation[] = [];
  private pendingRecoveryNotices: WorkshopWidgetRecoveryNotice[] = [];
  private currentCheckpointError?: string;
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
    return this.dirtyRevision > this.writtenRevision;
  }

  getDegradedConversationKeys(): WorkshopConversationLogicalKey[] {
    return [...this.degradedConversationKeys];
  }

  getDegradedConversations(): WorkshopConversationDegradation[] {
    return this.degradedConversations.map((entry) => ({ ...entry }));
  }

  consumeRecoveryNotices(): WorkshopWidgetRecoveryNotice[] {
    const notices = this.pendingRecoveryNotices.map((notice) => ({ ...notice }));
    this.pendingRecoveryNotices = [];
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
  }

  /**
   * Hydrate rolling state once per extension-host lifetime. A second webview
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
          try {
            if (await this.store.readNamed(current.session.sessionId)) {
              this.activeNamedSessionId = current.session.sessionId;
            }
          } catch (error) {
            this.outputChannel.appendLine(
              `[WorkshopSessionPersistence] Could not confirm named autosave target ` +
              `(id=${current.session.sessionId}): ${this.errorMessage(error)}`
            );
          }
          result = await this.hydrate(current.session, true, true, current);
        } else {
          this.recordStartMarker();
          this.markDirty('initial session');
        }
      } catch (error) {
        this.activeNamedSessionId = undefined;
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

  /** Mark one fully committed mutation for ordered rolling autosave. */
  markDirty(reason: string): void {
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
        await this.store.writeCurrent(snapshot);
        if (namedSessionId) {
          await this.store.updateNamed(namedSessionId, {
            ...snapshot,
            savedAt: normalizedIso(this.now())
          });
        }
        this.writtenRevision = Math.max(this.writtenRevision, revision);
        if (revision >= this.dirtyRevision) {
          this.emitSessionSaveStatus({ sessionId, status: 'saved' });
        }
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] current.json${
            namedSessionId ? ' + named session' : ''
          } committed (id=${sessionId}, revision=${revision}, reason=${reason})`
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
    if (this.hasPendingWrite()) {
      this.markDirty('flush');
      await this.autosaveQueue;
    }
  }

  async saveNamed(
    title: string,
    targetSessionId?: string
  ): Promise<WorkshopStoredSessionSummary> {
    return this.serializeSessionOperation(async () => {
      const normalizedTitle = this.requireTitle(title);
      const now = normalizedIso(this.now());
      if (targetSessionId !== undefined) {
        return this.updateActiveNamedSession(targetSessionId, normalizedTitle, now);
      }
      const checkpointIdentity: LiveSessionIdentity = {
        sessionId: this.idFactory(),
        title: normalizedTitle,
        createdAt: this.identity.createdAt
      };
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
      this.markDirty('named save identity');
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

  async openNamed(sessionId: string): Promise<WorkshopSessionHydrateResult> {
    return this.serializeSessionOperation(async () => {
      const persisted = await this.readNamedCheckpoint(sessionId);
      if (!persisted) {
        throw new Error(`Named Workshop session ${sessionId} was not found.`);
      }
      const rollback = this.captureRollback();
      let hydration: WorkshopHydrationTransaction;
      try {
        hydration = await this.hydrate(persisted.session, false, false, persisted);
        this.time.touch();
        this.activeNamedSessionId = sessionId;
        const promoted = await this.capture(this.identity);
        await this.store.writeCurrent(promoted);
        this.currentCheckpointError = undefined;
      } catch (error) {
        this.restoreRollback(rollback);
        throw error;
      }
      hydration.discardedConversationIds.forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
      return {
        restored: hydration.restored,
        degradedConversationKeys: hydration.degradedConversationKeys,
        degradedConversations: hydration.degradedConversations
      };
    });
  }

  async renameNamed(sessionId: string, title: string): Promise<WorkshopStoredSessionSummary> {
    return this.serializeSessionOperation(async () => {
      if (this.activeNamedSessionId === sessionId) {
        return this.updateActiveNamedSession(
          sessionId,
          this.requireTitle(title),
          normalizedIso(this.now())
        );
      }
      return this.store.renameNamed(sessionId, this.requireTitle(title));
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
      const duplicate: WorkshopPersistedSessionV1 = {
        ...source.session,
        sessionId: this.idFactory(),
        title: this.requireTitle(requestedTitle ?? `${source.session.title} copy`),
        createdAt: now,
        updatedAt: now,
        savedAt: now
      };
      return this.store.duplicateNamed(sourceSessionId, duplicate);
    });
  }

  async deleteNamed(sessionId: string): Promise<void> {
    return this.serializeSessionOperation(async () => {
      await this.store.deleteNamed(sessionId);
      if (this.activeNamedSessionId === sessionId) {
        this.activeNamedSessionId = undefined;
      }
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
      const rollback = this.captureRollback();
      // Read the working set BEFORE the aggregate drops it. A destructive
      // reset is the one action here that can be disputed later, and "it
      // deleted my context" is unanswerable against a log that only says a
      // wipe happened.
      const cleared = options.clearWorkingSet
        ? this.describeClearedWorkingSet()
        : { attachmentLabels: [] };
      const discarded = this.session.reset(options);
      this.time.reset();
      const createdAt = normalizedIso(this.now());
      this.identity = {
        sessionId: this.idFactory(),
        title: this.defaultTitle(createdAt),
        createdAt
      };
      this.activeNamedSessionId = undefined;
      this.degradedConversationKeys = [];
      this.degradedConversations = [];
      this.recordStartMarker();
      try {
        const promoted = await this.capture(this.identity);
        await this.store.writeCurrent(promoted);
        this.currentCheckpointError = undefined;
      } catch (error) {
        this.restoreRollback(rollback);
        throw error;
      }
      discarded.forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
      return cleared;
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

  private async capture(identity: LiveSessionIdentity): Promise<WorkshopPersistedSessionV1> {
    // Assistant generation setup may await. It must settle before either half
    // of the coherent snapshot is read.
    await this.ensureAssistantReady?.();
    const workshop = this.session.exportCommittedState();
    const targets = this.exportTargets(workshop);
    const conversations = targets.length > 0
      ? this.assistantToolService.exportWorkshopConversationArchive(targets)
      : [];
    const temporal = this.time.exportState();
    return {
      schemaVersion: 1,
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
    persisted: WorkshopPersistedSessionV1,
    retirePreviousConversations = true,
    scheduleResumeAutosave = true,
    checkpointRecovery?: Pick<
      WorkshopPersistedSessionCheckpointDecodeResult,
      'normalizations' | 'recoveryNotices'
    >
  ): Promise<WorkshopHydrationTransaction> {
    // Structural preflight happens before ConversationManager can mint ids.
    const workshop = parseWorkshopSessionStateV1(persisted.workshop);
    const temporal = parseWorkshopSessionTemporalStateV1(persisted.temporal);
    const descriptors = this.importDescriptors(workshop);
    const expectedKeys = new Set(descriptors.keys());
    const archiveEntries = persisted.conversations.filter(
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
    for (const outcome of outcomes) {
      if (outcome.status === 'imported') {
        bindings[outcome.key] = outcome.conversationId;
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
        this.session.getConversationBehavior()
      );
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
    const personaResumeKeys: WorkshopPersonaConversationKey[] = [
      'host',
      ...workshop.participants.personaGuests
        .filter((guest) => guest.liveness === 'live')
        .map((guest) => workshopGuestConversationKey(guest.personaId))
    ];
    this.time.hydrate(temporal, personaResumeKeys);
    this.identity = {
      sessionId: persisted.sessionId,
      title: persisted.title,
      createdAt: persisted.createdAt
    };
    this.degradedConversationKeys = degradedKeys;
    this.degradedConversations = degradedConversations;
    this.pendingRecoveryNotices = [
      ...(checkpointRecovery?.recoveryNotices ?? []),
      ...hydration.recoveryNotices
    ].map((notice) => ({ ...notice }));
    this.session.recordSessionMarker('resume', this.time.describeVisibleMarker('resume'));
    if (retirePreviousConversations) {
      hydration.discardedConversationIds.forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
    }
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Session hydrated ` +
      `(id=${persisted.sessionId}, conversations=${outcomes.length}, degraded=${
        degradedConversations.map(({ key, reason }) => `${key}: ${reason}`).join('; ') || 'none'
      })`
    );
    if (scheduleResumeAutosave) {
      this.markDirty('resume marker');
    }
    return {
      restored: true,
      degradedConversationKeys: degradedKeys,
      degradedConversations,
      discardedConversationIds: hydration.discardedConversationIds
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
      workshop,
      bindings,
      temporal: this.time.exportRuntimeState(),
      degradedConversationKeys: [...this.degradedConversationKeys],
      degradedConversations: this.getDegradedConversations(),
      recoveryNotices: this.pendingRecoveryNotices.map((notice) => ({ ...notice }))
    };
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
    this.activeNamedSessionId = rollback.activeNamedSessionId;
    this.degradedConversationKeys = [...rollback.degradedConversationKeys];
    this.degradedConversations = rollback.degradedConversations.map((entry) => ({ ...entry }));
    this.pendingRecoveryNotices = rollback.recoveryNotices.map((notice) => ({ ...notice }));
  }

  private recordStartMarker(): void {
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

  private defaultTitle(createdAt: string): string {
    const date = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(createdAt));
    return `Untitled session — ${workshopPersonaLabel(this.session.getSelectedPersonaId())} — ${date}`;
  }

  private requireTitle(title: string): string {
    const normalized = title.trim();
    if (!normalized) {
      throw new Error('Workshop session title cannot be blank.');
    }
    if (normalized.length > 160) {
      throw new Error('Workshop session titles are limited to 160 characters.');
    }
    return normalized;
  }

  /**
   * Update the live room's exact named identity. `current.json` goes first:
   * if the second atomic write fails or the host crashes between files, the
   * newer rolling checkpoint remains the recovery authority and the next
   * resume/autosave repairs the named copy instead of rolling it backward.
   */
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
    const checkpoint = {
      ...(await this.capture(nextIdentity)),
      savedAt,
      updatedAt: savedAt
    };
    this.emitSessionSaveStatus({ sessionId, status: 'saving' });
    try {
      await this.store.writeCurrent(checkpoint);
      // Once current.json commits, this identity is the recoverable live truth
      // even if the named mirror reports a failure below.
      this.identity = nextIdentity;
      this.currentCheckpointError = undefined;
      const summary = await this.store.updateNamed(sessionId, checkpoint);
      this.emitSessionSaveStatus({ sessionId, status: 'saved' });
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

  private emitSessionSaveStatus(event: WorkshopSessionSaveStatus): void {
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
