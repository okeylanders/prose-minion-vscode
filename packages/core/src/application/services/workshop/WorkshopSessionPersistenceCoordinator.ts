/**
 * Application-owned persistence transaction for Workshop.
 *
 * The aggregate and retained provider histories have different owners. This
 * coordinator is the one seam allowed to capture, hydrate, and retire both so
 * `current.json` can never describe a room from two different moments.
 */

import { randomUUID, createHash } from 'node:crypto';
import * as path from 'node:path';
import { LogSink } from '@/platform';
import {
  WorkshopConversationLogicalKey,
  WorkshopRuntimeConversationBindings,
  WorkshopSessionActiveRunPersistenceError,
  WorkshopSessionService,
  WorkshopSessionStateV1,
  parseWorkshopSessionStateV1
} from './WorkshopSessionService';
import {
  WorkshopPersonaConversationKey,
  WorkshopSessionTimeService,
  parseWorkshopSessionTemporalStateV1,
  workshopGuestConversationKey
} from './WorkshopSessionTimeService';
import {
  WorkshopPersistedSessionV1,
  WorkshopPersistedSummaryV1
} from './WorkshopPersistedSession';
import { WorkshopConversationSettingsService } from './WorkshopConversationSettingsService';
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
  WorkshopPersonaId,
  WorkshopSessionSummary,
  WorkshopToolId
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
}

interface WorkshopHydrationTransaction extends WorkshopSessionHydrateResult {
  discardedConversationIds: string[];
}

export interface WorkshopSessionHydrateResult {
  restored: boolean;
  degradedConversationKeys: WorkshopConversationLogicalKey[];
}

export interface WorkshopSessionListData {
  availability: WorkshopSessionStoreAvailability;
  current?: WorkshopSessionSummary;
  sessions: WorkshopSessionSummary[];
  truncated: boolean;
  searchTruncated: boolean;
}

export interface WorkshopSessionPersistenceCoordinatorOptions {
  now?: () => Date;
  idFactory?: () => string;
  ensureAssistantReady?: () => PromiseLike<unknown>;
}

export type WorkshopNamedSaveStatus = 'saving' | 'saved' | 'error';

const normalizedIso = (date: Date): string => date.toISOString();

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export class WorkshopSessionPersistenceCoordinator {
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly ensureAssistantReady?: () => PromiseLike<unknown>;
  private identity: LiveSessionIdentity;
  private activeNamedSessionId?: string;
  private readonly namedSaveStatusListeners = new Set<
    (sessionId: string, status: WorkshopNamedSaveStatus) => void
  >();
  private initialized = false;
  private initializePromise?: Promise<WorkshopSessionHydrateResult>;
  private writeQueue: Promise<void> = Promise.resolve();
  private sessionOperationQueue: Promise<void> = Promise.resolve();
  private pendingSessionOperations = 0;
  private dirtyRevision = 0;
  private writtenRevision = 0;
  private degradedConversationKeys: WorkshopConversationLogicalKey[] = [];
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

  isCurrentCheckpointProtected(): boolean {
    return this.currentCheckpointError !== undefined;
  }

  isSessionOperationPending(): boolean {
    return this.pendingSessionOperations > 0;
  }

  addNamedSaveStatusListener(
    listener: (sessionId: string, status: WorkshopNamedSaveStatus) => void
  ): () => void {
    this.namedSaveStatusListeners.add(listener);
    return () => this.namedSaveStatusListeners.delete(listener);
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
      degradedConversationKeys: []
    };
    if (availability.available) {
      try {
        const current = await this.store.readCurrent();
        if (current) {
          try {
            if (await this.store.readNamed(current.sessionId)) {
              this.activeNamedSessionId = current.sessionId;
            }
          } catch (error) {
            this.outputChannel.appendLine(
              `[WorkshopSessionPersistence] Could not confirm named autosave target ` +
              `(id=${current.sessionId}): ${this.errorMessage(error)}`
            );
          }
          result = await this.hydrate(current);
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
      return;
    }
    this.dirtyRevision += 1;
    const revision = this.dirtyRevision;
    const namedSessionId = this.activeNamedSessionId;
    if (namedSessionId) {
      this.emitNamedSaveStatus(namedSessionId, 'saving');
    }
    const initializationBarrier = this.initializePromise ?? this.initialize();
    const operationBarrier = this.sessionOperationQueue;
    this.writeQueue = Promise.all([
      this.writeQueue,
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
        if (namedSessionId && revision >= this.dirtyRevision) {
          this.emitNamedSaveStatus(namedSessionId, 'saved');
        }
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] current.json${
            namedSessionId ? ' + named session' : ''
          } committed (revision=${revision}, reason=${reason})`
        );
      } catch (error) {
        if (error instanceof WorkshopSessionActiveRunPersistenceError) {
          this.outputChannel.appendLine(
            `[WorkshopSessionPersistence] Autosave deferred at active-run boundary (revision=${revision}, reason=${reason})`
          );
          return;
        }
        this.outputChannel.appendLine(
          `[WorkshopSessionPersistence] Autosave failed (revision=${revision}, reason=${reason}): ${this.errorMessage(error)}`
        );
        if (namedSessionId && revision >= this.dirtyRevision) {
          this.emitNamedSaveStatus(namedSessionId, 'error');
        }
      }
    });
    void this.writeQueue;
  }

  /** Retry a dirty autosave after a run guard has cleared and await ordering. */
  async flush(): Promise<void> {
    // First let an already-scheduled write settle. Only enqueue a retry when
    // the revision is still dirty (for example, an active-run guard deferred
    // capture). This avoids manufacturing a second write/status transition
    // for every ordinary lifecycle flush.
    await this.writeQueue;
    if (this.hasPendingWrite()) {
      this.markDirty('flush');
      await this.writeQueue;
    }
  }

  async saveNamed(
    title: string,
    targetSessionId?: string
  ): Promise<WorkshopStoredSessionSummary> {
    return this.runSessionOperation(async () => {
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

  async list(query?: string): Promise<WorkshopSessionListData> {
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
    const listed = await this.store.list(query);
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
    return this.runSessionOperation(async () => {
      const persisted = await this.store.readNamed(sessionId);
      if (!persisted) {
        throw new Error(`Named Workshop session ${sessionId} was not found.`);
      }
      const rollback = this.captureRollback();
      let hydration: WorkshopHydrationTransaction;
      try {
        hydration = await this.hydrate(persisted, false, false);
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
        degradedConversationKeys: hydration.degradedConversationKeys
      };
    });
  }

  async renameNamed(sessionId: string, title: string): Promise<WorkshopStoredSessionSummary> {
    return this.runSessionOperation(async () => {
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
    return this.runSessionOperation(async () => {
      const source = await this.store.readNamed(sourceSessionId);
      if (!source) {
        throw new Error(`Named Workshop session ${sourceSessionId} was not found.`);
      }
      const now = normalizedIso(this.now());
      const duplicate: WorkshopPersistedSessionV1 = {
        ...source,
        sessionId: this.idFactory(),
        title: this.requireTitle(requestedTitle ?? `${source.title} copy`),
        createdAt: now,
        updatedAt: now,
        savedAt: now
      };
      return this.store.duplicateNamed(sourceSessionId, duplicate);
    });
  }

  async deleteNamed(sessionId: string): Promise<void> {
    return this.runSessionOperation(async () => {
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
  async resetSession(): Promise<void> {
    return this.runSessionOperation(async () => {
      const rollback = this.captureRollback();
      const discarded = this.session.reset();
      this.time.reset();
      const createdAt = normalizedIso(this.now());
      this.identity = {
        sessionId: this.idFactory(),
        title: this.defaultTitle(createdAt),
        createdAt
      };
      this.activeNamedSessionId = undefined;
      this.degradedConversationKeys = [];
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
    });
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
    scheduleResumeAutosave = true
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
          writerProfile: this.conversationSettingsService.getWriterProfile()
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
    this.session.recordSessionMarker('resume', this.time.describeVisibleMarker('resume'));
    if (retirePreviousConversations) {
      hydration.discardedConversationIds.forEach((conversationId) =>
        this.assistantToolService.discardConversation(conversationId)
      );
    }
    this.outputChannel.appendLine(
      `[WorkshopSessionPersistence] Session hydrated ` +
      `(id=${persisted.sessionId}, conversations=${outcomes.length}, degraded=${degradedKeys.join(',') || 'none'})`
    );
    if (scheduleResumeAutosave) {
      this.markDirty('resume marker');
    }
    return {
      restored: true,
      degradedConversationKeys: degradedKeys,
      discardedConversationIds: hydration.discardedConversationIds
    };
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
    persisted: WorkshopPersistedSessionV1,
    fileName: string,
    kind: 'current'
  ): WorkshopSessionSummary;
  private toMessageSummary(
    persisted: WorkshopStoredSessionSummary,
    kind: 'current'
  ): WorkshopSessionSummary;
  private toMessageSummary(
    persisted: WorkshopStoredSessionSummary,
    kind: 'named'
  ): WorkshopSessionSummary;
  private toMessageSummary(
    value: WorkshopPersistedSessionV1 | WorkshopStoredSessionSummary,
    fileNameOrKind: string,
    currentKind?: 'current'
  ): WorkshopSessionSummary {
    const isCurrent = currentKind === 'current' || fileNameOrKind === 'current';
    const summary = 'summary' in value ? value.summary : value;
    const temporal = 'temporal' in value ? value.temporal : undefined;
    return {
      sessionId: value.sessionId,
      title: value.title,
      fileName: 'fileName' in value ? value.fileName : fileNameOrKind,
      kind: isCurrent ? 'current' : 'named',
      startedAt: Date.parse(
        temporal?.startedAt ??
        ('startedAt' in value ? value.startedAt : value.createdAt)
      ),
      updatedAt: Date.parse(value.updatedAt),
      savedAt: value.savedAt ? Date.parse(value.savedAt) : undefined,
      timezone: temporal?.timezone ??
        ('timezone' in value ? value.timezone : 'UTC'),
      hostPersonaId: summary.hostPersonaId,
      participantPersonaIds: [...summary.participantPersonaIds],
      turnCount: summary.turnCount,
      excerptWordCount: summary.excerptWordCount,
      excerptLabel: summary.excerptLabel,
      excerptIdentity: summary.excerptIdentity,
      preview: summary.preview,
      degradedConversationKeys: isCurrent ? this.getDegradedConversationKeys() : undefined
    };
  }

  /**
   * Serialize session replacement and named-session mutations behind both
   * earlier operations and autosaves. A rejection is observable to the caller
   * but never poisons the queue for the next operation.
   */
  private runSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.pendingSessionOperations += 1;
    const initialization = this.initialize();
    const priorOperation = this.sessionOperationQueue;
    const priorWrites = this.writeQueue;
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
      degradedConversationKeys: [...this.degradedConversationKeys]
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
  }

  private recordStartMarker(): void {
    this.session.recordSessionMarker('start', this.time.describeVisibleMarker('start'));
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
    this.emitNamedSaveStatus(sessionId, 'saving');
    try {
      await this.store.writeCurrent(checkpoint);
      // Once current.json commits, this identity is the recoverable live truth
      // even if the named mirror reports a failure below.
      this.identity = nextIdentity;
      this.currentCheckpointError = undefined;
      const summary = await this.store.updateNamed(sessionId, checkpoint);
      this.emitNamedSaveStatus(sessionId, 'saved');
      return summary;
    } catch (error) {
      this.emitNamedSaveStatus(sessionId, 'error');
      throw error;
    }
  }

  private emitNamedSaveStatus(
    sessionId: string,
    status: WorkshopNamedSaveStatus
  ): void {
    this.namedSaveStatusListeners.forEach((listener) => listener(sessionId, status));
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
