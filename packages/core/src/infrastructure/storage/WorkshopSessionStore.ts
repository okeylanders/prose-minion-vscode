/**
 * Workspace-file store for durable Workshop session envelopes (ADR 2026-07-14).
 *
 * This class deliberately owns only filesystem concerns: paths, tolerant reads,
 * bounded summaries/search, and atomic file replacement. It does not hydrate a
 * Workshop aggregate, import conversations, invoke a shell, or interpret IPC.
 * The application coordinator supplies complete `WorkshopPersistedSessionV2`
 * snapshots and owns those higher-level transactions.
 */

import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { PRIMARY_WORKSHOP_ROOM_ID, isNamedSessionFileName, roomIdFromWorkshopFile, workshopRoomFileName } from '@/application/services/workshop/WorkshopRoomSlot';
import { hasSameWorkshopRecoveryContent } from '@/application/services/workshop/WorkshopSessionRecoveryEquality';
import { hasWorkshopRoomWork, workshopUnsavedRoomPreview, type WorkshopUnsavedRoomStatus } from '@/application/services/workshop/WorkshopUnsavedRoom';
import { withoutRollingProvenance } from '@/application/services/workshop/WorkshopRollingCheckpoint';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionCheckpointDecodeResult,
  WorkshopPersistedSessionV2,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { FileSystem, FileType, type LocalRollingClaim, LogSink, Workspace } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { formatByteLimit, WorkshopNamedSessionBusyError, WorkshopNamedSessionLock, WorkshopNamedSessionRecoveryRequiredError } from '@/infrastructure/storage/WorkshopNamedSessionLock';
import { recoverWorkshopNamedSession, type WorkshopNamedSessionRecoveryOutcome } from '@/infrastructure/storage/WorkshopNamedSessionRecovery';
import { withWorkshopNamedSessionLocks } from '@/infrastructure/storage/WorkshopNamedSessionLockRows';
import { isRecord } from '@/application/services/workshop/persistedValidation';
import {
  assertPersistedJsonNestingDepth
} from '@/application/services/workshop/persistedJson';
import {
  buildWorkshopSessionSearchIndexV1,
  parseWorkshopSessionSearchIndexV1,
  workshopSessionSearchIndexFileName,
  workshopStoredSessionSummary,
  workshopStoredSummaryFromSearchIndex,
  WorkshopSessionSearchIndexV1,
  WorkshopStoredSessionSummary
} from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';
import {
  isMissingFileSystemPathError
} from '@/infrastructure/storage/fileSystemErrors';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import {
  readWorkshopSessionPage,
  WorkshopSessionPage,
  WorkshopSessionPageRead,
  WorkshopSessionPageRequest
} from '@/infrastructure/storage/WorkshopSessionStorePage';
import {
  WORKSHOP_BOOKMARK_BROWSER_LIMITS,
  WorkshopBookmarkBrowserLimits
} from '@shared/constants/workshopBookmarkBrowser';

export type {
  WorkshopStoredSessionSummary
} from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** A search index is metadata, never a second full snapshot. */
const MAXIMUM_SEARCH_INDEX_BYTES = 64 * 1024;

export const WORKSHOP_SESSION_STORE_LIMITS = Object.freeze({
  /** Keep one noisy workspace directory from making browser open unbounded. */
  maximumFiles: 200,
  /** Session JSON is user-owned input; do not eagerly parse an arbitrary blob. */
  maximumFileBytes: 5 * 1024 * 1024,
  /**
   * Exact restore/open actions may exceed the browser preview bound, but must
   * never allocate an arbitrary workspace blob inside the extension host.
   */
  maximumExactFileBytes: 25 * 1024 * 1024,
  /** Bound the amount of serialized session text inspected for browser search. */
  maximumSearchCharacters: 250_000,
  /** A failed write must not spin forever on a hostile filesystem provider. */
  maximumNameCollisions: 100
});

export interface WorkshopSessionStoreLimits {
  maximumFiles: number;
  maximumFileBytes: number;
  maximumExactFileBytes: number;
  maximumSearchCharacters: number;
  maximumNameCollisions: number;
}

export type WorkshopSessionStoreUnavailableReason = 'no-workspace' | 'multi-root';

export type WorkshopSessionStoreAvailability =
  | {
      available: true;
      rootPath: string;
      sessionsDirectory: string;
      currentPath: string;
    }
  | {
      available: false;
      reason: WorkshopSessionStoreUnavailableReason;
    };

export class WorkshopSessionStoreUnavailableError extends Error {
  constructor(readonly reason: WorkshopSessionStoreUnavailableReason) {
    super(
      reason === 'no-workspace'
        ? 'Workshop sessions require an open workspace folder.'
        : 'Workshop sessions require a single-root workspace. Choose one workspace folder before saving sessions.'
    );
    this.name = 'WorkshopSessionStoreUnavailableError';
  }
}

export class WorkshopNamedSessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Named Workshop session ${sessionId} was not found.`);
    this.name = 'WorkshopNamedSessionNotFoundError';
  }
}

export class WorkshopNamedSessionIdentityConflictError extends Error {
  constructor(sessionId: string) {
    super(`A named Workshop session already uses id ${sessionId}.`);
    this.name = 'WorkshopNamedSessionIdentityConflictError';
  }
}

export class WorkshopNamedSessionChangedError extends Error {
  constructor() {
    super('The saved Workshop session changed on disk. Reopen the session to load the saved version before saving again.');
    this.name = 'WorkshopNamedSessionChangedError';
  }
}

export class WorkshopRollingCheckpointConflictError extends Error {
  constructor(message = 'Another window changed this tab’s rolling checkpoint. The existing file was kept.') {
    super(message);
    this.name = 'WorkshopRollingCheckpointConflictError';
  }
}

export class WorkshopRollingCheckpointBusyError extends WorkshopRollingCheckpointConflictError {
  constructor() {
    super('Another window is writing this rolling checkpoint. The existing file was kept. Try again in a moment.');
    this.name = 'WorkshopRollingCheckpointBusyError';
  }
}

export class WorkshopRollingCheckpointRecoveryRequiredError extends WorkshopRollingCheckpointConflictError {
  constructor() {
    super('The rolling checkpoint has an expired write claim. The existing file was kept. Use Reopen Closed Workshop Room… to open a recovery copy.');
    this.name = 'WorkshopRollingCheckpointRecoveryRequiredError';
  }
}

interface WorkshopRoomCheckpointRow {
  roomId: string;
  title: string;
  updatedAt: string;
  recoveryToken?: string;
}

/** A revision is bound to one slot and workspace. Unreadable/claimed files have no deletion authority. */
export interface WorkshopUnsavedRoomRow extends WorkshopRoomCheckpointRow {
  revision: string;
  preview: string;
}

export class WorkshopSessionFileReadError extends Error {
  constructor(
    readonly fileName: string,
    details: string
  ) {
    super(`Could not read Workshop session ${fileName}: ${details}`);
    this.name = 'WorkshopSessionFileReadError';
  }
}

export interface WorkshopSessionListResult {
  /** The rolling workspace checkpoint, when it exists and passed envelope validation. */
  current?: WorkshopStoredSessionSummary;
  sessions: WorkshopStoredSessionSummary[];
  /** True when a safety bound prevented the browser from considering every file. */
  truncated: boolean;
  /**
   * True when at least one otherwise-discoverable session could not be fully
   * content-searched within the browser's byte/character bounds. The result
   * list is still valid for metadata matches; it is not a complete grep.
   */
  searchTruncated: boolean;
}

/**
 * Small, schema-versioned browser index beside a full session snapshot.
 * The snapshot remains the only durable authority; this is deliberately
 * enough to list/reveal/manage a long session without parsing its transcript.
 */
interface BrowserFullRead {
  session?: WorkshopPersistedSessionV2;
  /** The browser chose not to parse this valid-looking large file. */
  limited: boolean;
}

interface StoredNamedSession {
  filePath: string;
  fileName: string;
  session: WorkshopPersistedSessionV2;
  migrations: WorkshopPersistedSessionCheckpointDecodeResult['migrations'];
  normalizations: WorkshopPersistedSessionCheckpointDecodeResult['normalizations'];
  recoveryNotices: WorkshopPersistedSessionCheckpointDecodeResult['recoveryNotices'];
}

interface CachedNamedSessionPath {
  filePath: string;
  fileName: string;
}

/**
 * `current.json` and named checkpoint persistence, through host-agnostic ports.
 * The injected clock makes collision behavior deterministic in tests and keeps
 * filename generation out of UI code.
 */
export class WorkshopSessionStore {
  private readonly currentFileName: string;
  /** Exact revisions accepted by this view. Browser previews and read-back checks never advance them. */
  private readonly rollingRevisions = new Map<string, string>();
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    private readonly now: () => Date = () => new Date(),
    private readonly limits: WorkshopSessionStoreLimits = WORKSHOP_SESSION_STORE_LIMITS,
    /** The Bookmarks screen's page bounds (ADR 2026-11-05 D8). */
    private readonly pageLimits: WorkshopBookmarkBrowserLimits = WORKSHOP_BOOKMARK_BROWSER_LIMITS,
    roomId = PRIMARY_WORKSHOP_ROOM_ID,
    /** Room views share immutable named paths resolved by this store. */
    private readonly namedSessionPaths = new Map<string, CachedNamedSessionPath>(),
    private readonly ensuredStorageDirectories = new Set<string>(),
    private readonly roomWorkspace?: WorkshopSessionStoreAvailability
  ) {
    this.currentFileName = workshopRoomFileName(roomId);
  }

  /** Room views share the named catalog and retain their own rolling path. */
  forRoom(roomId: string): WorkshopSessionStore {
    return new WorkshopSessionStore(this.fileSystem, this.workspace, this.log, this.now, this.limits,
      this.pageLimits, roomId, this.namedSessionPaths, this.ensuredStorageDirectories, this.roomWorkspace ?? this.availability());
  }

  /** Only rolling files can select a restore slot. A damaged or large file remains available for recovery. */
  async listRoomCheckpoints(): Promise<WorkshopRoomCheckpointRow[]> {
    const paths = this.availability();
    if (!paths.available) { return []; }
    let entries: Array<[string, FileType]>;
    try {
      entries = await this.fileSystem.readDirectory(paths.sessionsDirectory);
    } catch (error) {
      if (isMissingFileError(error)) { return []; }
      throw error;
    }
    const directories = new Set(entries.filter(([, type]) => type === FileType.Directory).map(([name]) => name));
    const rooms: WorkshopRoomCheckpointRow[] = [];
    for (const [name, type] of entries) {
      const roomId = roomIdFromWorkshopFile(name);
      if (type !== FileType.File || !roomId) { continue; }
      const currentPath = path.join(paths.sessionsDirectory, name);
      // Keep every file reopenable while limiting how many previews one picker can parse.
      const summary = rooms.length < this.limits.maximumFiles
        ? (await this.readCurrentForBrowser({ ...paths, currentPath }, undefined)).summary
        : undefined;
      const claim = directories.has(`.${name}.lock`) ? await this.named.rollingClaim(currentPath) : undefined;
      rooms.push({
        roomId, title: summary?.title ?? name, updatedAt: summary?.updatedAt ?? '',
        ...(claim?.state === 'recovery-required' && { recoveryToken: claim.token })
      });
    }
    return rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.roomId.localeCompare(b.roomId));
  }

  /** Enumerate rolling files directly, including index-less files from previous versions. */
  async listUnsavedRooms(): Promise<WorkshopUnsavedRoomRow[]> {
    if (!this.availability().available) { return []; }
    const paths = this.requireAvailability();
    let entries: Array<[string, FileType]>;
    try {
      entries = await this.fileSystem.readDirectory(paths.sessionsDirectory);
    } catch (error) {
      if (isMissingFileError(error)) { return []; }
      throw error;
    }
    const rolling = entries.filter(([name, type]) => {
      const roomId = roomIdFromWorkshopFile(name);
      return type === FileType.File && roomId && roomId !== PRIMARY_WORKSHOP_ROOM_ID;
    });
    if (!rolling.length) { return []; }
    // A bounded sidecar can locate a named candidate, but only the complete named contents prove a match.
    // Index once per listing so a library of unsaved sessions does not rescan every named file per row.
    const named = new Map<string, string | null>();
    for (const [name, type] of entries) {
      if (type !== FileType.File || !isNamedSessionFileName(name)) { continue; }
      const indexName = workshopSessionSearchIndexFileName(name);
      const index = await this.readSearchIndexForBrowser(path.join(paths.sessionsDirectory, indexName), indexName, name);
      let id = index?.sessionId;
      if (!id) {
        try { id = (await this.readSessionFileExact(path.join(paths.sessionsDirectory, name), name))?.session.sessionId; }
        catch (error) { this.skip(name, errorMessage(error)); }
      }
      if (id) { named.set(id, named.has(id) ? null : name); }
    }
    const locks = new Set(entries.filter(([, type]) => type === FileType.Directory).map(([name]) => name));
    const rows: WorkshopUnsavedRoomRow[] = [];
    for (const [name] of rolling) {
      const roomId = roomIdFromWorkshopFile(name)!;
      const filePath = path.join(paths.sessionsDirectory, name);
      const claim = locks.has(`.${name}.lock`) ? await this.named.rollingClaim(filePath) : undefined;
      let row: WorkshopUnsavedRoomRow = { roomId, title: name, updatedAt: '', preview: '', revision: '' };
      try {
        const observed = await this.observeRolling(filePath, name);
        if (!observed) { continue; }
        const { decoded, revision } = observed;
        const session = decoded.session;
        const protectedFile = (claim && claim.state !== 'none') || needsCheckpointRecovery(decoded);
        row = { roomId, title: session.title, updatedAt: session.updatedAt, preview: workshopUnsavedRoomPreview(session.workshop),
          revision: protectedFile ? '' : revision };
        if (!protectedFile) {
          if (!hasWorkshopRoomWork(session)) { continue; }
          const candidate = named.get(session.sessionId);
          if (candidate && !locks.has(`.${candidate}.lock`)) {
            const saved = await this.readSessionFileExact(path.join(paths.sessionsDirectory, candidate), candidate);
            if (saved && !needsCheckpointRecovery(saved) && hasSameWorkshopRecoveryContent(session, saved.session)) { continue; }
          }
        }
      } catch (error) {
        this.skip(name, errorMessage(error));
      }
      if (claim?.state === 'recovery-required') { row.recoveryToken = claim.token; }
      rows.push(row);
    }
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.roomId.localeCompare(b.roomId));
  }

  /** The same content test for a retained in-memory room and a closed disk checkpoint. */
  async classifyRoomContents(session: WorkshopPersistedSessionV2): Promise<WorkshopUnsavedRoomStatus> {
    if (!hasWorkshopRoomWork(session)) { return 'empty'; }
    if (!this.availability().available) { return 'unsaved'; }
    try {
      const named = await this.findNamedSession(session.sessionId, this.requireAvailability(), { ignoreUnreadable: true });
      if (named && !needsCheckpointRecovery(named) && hasSameWorkshopRecoveryContent(session, named.session)) {
        const claim = await this.named.rollingClaim(named.filePath);
        if (claim.state === 'none') { return 'saved'; }
      }
    } catch (error) { this.skip(session.title, errorMessage(error)); }
    return 'unsaved';
  }

  async roomCheckpointStatus(roomId: string): Promise<{ status: WorkshopUnsavedRoomStatus; revision: string } | undefined> {
    const slot = this.forRoom(roomId);
    const paths = slot.requireAvailability();
    if ((await this.named.rollingClaim(paths.currentPath)).state !== 'none') {
      throw new WorkshopRollingCheckpointConflictError();
    }
    const observed = await this.observeRolling(paths.currentPath, slot.currentFileName);
    if (!observed) { return undefined; }
    if (needsCheckpointRecovery(observed.decoded)) { throw new Error('The checkpoint requires recovery.'); }
    return { status: await slot.classifyRoomContents(observed.decoded.session), revision: observed.revision };
  }

  private async observeRolling(filePath: string, fileName: string) {
    let revision = '';
    const decoded = await this.readSessionFileExact(filePath, fileName, bytes => {
      if (bytes) { revision = createHash('sha256').update(filePath).update('\0').update(bytes).digest('hex'); }
    });
    return decoded && { decoded, revision };
  }

  /** Final mutation checks belong inside the rolling write claim, including the live-room generation guard. */
  async deleteUnsavedRoom(roomId: string, revision: string, stillClosed: () => boolean,
    expectedStatus?: 'empty' | 'saved'): Promise<void> {
    if (roomId === PRIMARY_WORKSHOP_ROOM_ID || !revision) { throw new Error('This Workshop checkpoint is protected.'); }
    const slot = this.forRoom(roomId);
    const paths = slot.requireAvailability();
    const changed = () => new Error('The Workshop checkpoint changed. Refresh the unsaved sessions list.');
    await this.named.withRollingLock(paths.currentPath, roomId, async () => {
      const observed = await this.observeRolling(paths.currentPath, slot.currentFileName);
      if (!observed || observed.revision !== revision || needsCheckpointRecovery(observed.decoded)) { throw changed(); }
      const session = observed.decoded.session;
      const remove = async () => {
        const final = await this.observeRolling(paths.currentPath, slot.currentFileName);
        slot.requireAvailability();
        if (final?.revision !== revision || !stillClosed()) { throw changed(); }
        await this.fileSystem.delete(paths.currentPath, { useTrash: expectedStatus === undefined });
        await this.deleteSearchIndexIfPresent(paths, slot.currentFileName);
      };
      if (expectedStatus === 'saved') {
        const found = await this.requireNamedSession(session.sessionId, paths);
        await this.named.withCheckpointLock(found.filePath, session.sessionId, async () => {
          const latest = await this.readSessionFileExact(found.filePath, found.fileName);
          if (!latest || needsCheckpointRecovery(latest) || !hasSameWorkshopRecoveryContent(session, latest.session)) { throw changed(); }
          await remove();
        });
      } else {
        const status = await slot.classifyRoomContents(session);
        if (status !== (expectedStatus ?? 'unsaved')) { throw changed(); }
        await remove();
      }
    });
  }

  /** The writer chose to recover this expired claim into a new independent room. The source is read-only. */
  async recoverRollingRoom(roomId: string, recoveryToken: string, stillClosed: () => boolean = () => true): Promise<string> {
    const source = this.forRoom(roomId);
    const paths = source.requireAvailability();
    const checkClaim = async () => {
      const claim = await this.named.rollingClaim(paths.currentPath);
      if (claim.state === 'busy') {
        throw new WorkshopRollingCheckpointBusyError();
      }
      if (claim.state !== 'recovery-required' || claim.token !== recoveryToken || this.requireAvailability().rootPath !== paths.rootPath) {
        throw new Error('The Workshop checkpoint or workspace changed. Reopen the closed-room picker.');
      }
    };
    await checkClaim();
    let baseline: string | undefined;
    const decoded = await this.readSessionFileExact(paths.currentPath, source.currentFileName, bytes => { baseline = rollingRevision(bytes); });
    if (!decoded) {
      throw new Error('The rolling checkpoint is no longer available to copy.');
    }
    const newRoomId = randomUUID();
    const replacement = this.forRoom(newRoomId);
    const snapshot = { ...withoutRollingProvenance(decoded.session), sessionId: randomUUID() };
    await checkClaim();
    await replacement.writeCurrent(snapshot, {
      beforeCommit: async () => {
        await checkClaim();
        if (await this.readRollingRevision(paths.currentPath) !== baseline || !stillClosed()) {
          throw new Error('The Workshop checkpoint changed during recovery. Reopen the closed-room picker.');
        }
      }
    });
    return newRoomId;
  }

  /** Every replace or remove of a named file holds its lock (ADR 2026-11-19 D6a, D6b). */
  private readonly named = new WorkshopNamedSessionLock(this.fileSystem, this.log, this.now, this.limits.maximumExactFileBytes,
    { changed: () => new WorkshopNamedSessionChangedError(), missing: (id) => new WorkshopNamedSessionNotFoundError(id) });

  availability(): WorkshopSessionStoreAvailability {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {
      return { available: false, reason: 'no-workspace' };
    }
    if (folders.length !== 1) {
      return { available: false, reason: 'multi-root' };
    }
    const rootPath = folders[0].path;
    const sessionsDirectory = path.join(rootPath, 'prose-minion', 'sessions');
    return {
      available: true,
      rootPath,
      sessionsDirectory,
      currentPath: path.join(sessionsDirectory, this.currentFileName)
    };
  }

  async readCurrent(): Promise<WorkshopPersistedSessionV2 | undefined> {
    return (await this.readCurrentWithRecovery())?.session;
  }

  async readCurrentWithRecovery(): Promise<
    WorkshopPersistedSessionCheckpointDecodeResult | undefined
  > {
    const paths = this.requireAvailability();
    return this.readSessionFileExact(paths.currentPath, this.currentFileName, bytes => {
      if (!this.rollingRevisions.has(paths.currentPath)) {
        this.rollingRevisions.set(paths.currentPath, rollingRevision(bytes));
      }
    });
  }

  /**
   * @param options.beforeCommit Runs after the temporary snapshot is written,
   * immediately before it replaces current.json. A throw leaves current.json
   * as it was and removes the temporary file.
   */
  async writeCurrent(
    session: WorkshopPersistedSessionV2,
    options: { beforeCommit?: () => Promise<void> } = {}
  ): Promise<void> {
    const paths = this.requireAvailability();
    const decoded = this.validateSessionForWrite(session);
    const expected = this.rollingRevisions.get(paths.currentPath) ?? 'absent';
    try {
      await this.named.withRollingLock(paths.currentPath, session.sessionId, async replace => {
        const verify = async () => {
          await options.beforeCommit?.();
          const latest = await this.readRollingRevision(paths.currentPath);
          if (latest !== expected) { throw new WorkshopRollingCheckpointConflictError(); }
        };
        const written = await this.writeSnapshotWithSearchIndex(
          paths, paths.currentPath, this.currentFileName, decoded, expected !== 'absent', verify, replace
        );
        this.rollingRevisions.set(paths.currentPath, rollingRevision(written));
      });
    } catch (error) {
      if (error instanceof WorkshopNamedSessionBusyError) {
        throw new WorkshopRollingCheckpointBusyError();
      }
      if (error instanceof WorkshopNamedSessionRecoveryRequiredError) {
        throw new WorkshopRollingCheckpointRecoveryRequiredError();
      }
      if (isDestinationExistsError(error)) {
        throw new WorkshopRollingCheckpointConflictError();
      }
      throw error;
    }
  }

  private async readRollingRevision(filePath: string): Promise<string> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (stat.size > this.limits.maximumExactFileBytes) { throw new WorkshopRollingCheckpointConflictError(); }
      const bytes = await this.fileSystem.readFile(filePath);
      if (bytes.length > this.limits.maximumExactFileBytes) { throw new WorkshopRollingCheckpointConflictError(); }
      return rollingRevision(bytes);
    } catch (error) {
      if (isMissingFileError(error)) { return 'absent'; }
      throw error;
    }
  }

  /** Allocate a named file with immutable identity/path. The caller supplies a fresh id. */
  async saveNamed(session: WorkshopPersistedSessionV2): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const decoded = this.validateSessionForWrite(withoutRollingProvenance(session));
    if (await this.findNamedSession(decoded.sessionId, paths, { ignoreUnreadable: true })) {
      throw new WorkshopNamedSessionIdentityConflictError(decoded.sessionId);
    }

    const initialSlug = titleSlug(decoded.title);
    for (let attempt = 0; attempt < this.limits.maximumNameCollisions; attempt += 1) {
      const fileName = this.namedFileName(initialSlug, attempt);
      const filePath = this.namedPath(paths, fileName);
      try {
        await this.writeSnapshotWithSearchIndex(paths, filePath, fileName, decoded, false);
        this.rememberNamedSessionPath(paths, decoded.sessionId, fileName, filePath);
        return workshopStoredSessionSummary(decoded, fileName);
      } catch (error) {
        if (!isDestinationExistsError(error)) {
          throw error;
        }
      }
    }
    throw new Error('Could not allocate a collision-free Workshop session filename.');
  }

  /** Replace one named checkpoint in place without changing its durable identity or path. */
  async updateNamed(
    sessionId: string,
    session: WorkshopPersistedSessionV2,
    expected: WorkshopPersistedSessionV2
  ): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const found = await this.requireNamedSession(sessionId, paths);
    if (!hasSameWorkshopCheckpoint(found.session, expected)) {
      throw new WorkshopNamedSessionChangedError();
    }
    const decoded = this.validateSessionForWrite(withoutRollingProvenance(session));
    if (decoded.sessionId !== sessionId) {
      throw new Error('Updated Workshop session identity does not match its target.');
    }
    await this.named.replace({ sessionId, filePath: found.filePath, readExact: () => this.readSessionFileExact(found.filePath, found.fileName), session: decoded, expected });
    await this.writeSearchIndexAfterCommit(paths, found.fileName, decoded);
    this.rememberNamedSessionPath(
      paths,
      decoded.sessionId,
      found.fileName,
      found.filePath
    );
    return workshopStoredSessionSummary(decoded, found.fileName);
  }

  /** Load a named checkpoint by durable identity; a caller-supplied path is never accepted. */
  async readNamed(sessionId: string): Promise<WorkshopPersistedSessionV2 | undefined> {
    return (await this.readNamedWithRecovery(sessionId))?.session;
  }

  async readNamedWithRecovery(sessionId: string): Promise<
    WorkshopPersistedSessionCheckpointDecodeResult | undefined
  > {
    const paths = this.requireAvailability();
    const found = await this.findNamedSession(sessionId, paths);
    return found
      ? {
          session: found.session,
          migrations: found.migrations,
          normalizations: found.normalizations,
          recoveryNotices: found.recoveryNotices
        }
      : undefined;
  }

  async list(query?: string, signal?: AbortSignal): Promise<WorkshopSessionListResult> {
    const paths = this.requireAvailability();
    const normalized = normalizedQuery(query);
    const entries = await this.readNamedBrowserSessions(paths, normalized, signal);
    throwIfAborted(signal);
    const current = await this.readCurrentForBrowser(paths, normalized, signal);
    return {
      ...(current.summary ? { current: current.summary }
        : {}),
      sessions: (await withWorkshopNamedSessionLocks(entries.sessions, await this.named.rowsIn(paths.sessionsDirectory), normalized, this.readLocked)).sort(compareSummariesNewestFirst),
      truncated: entries.truncated,
      searchTruncated: entries.searchTruncated || current.searchTruncated
    };
  }

  /**
   * One page of every named session file, read-only and uncapped by the
   * browser's 200 (ADR 2026-11-05 D8): the walk is WorkshopSessionStorePage's.
   * It never writes the exact-read path cache (PR #216 F-01), and reads only
   * the page's own files within its budget (F-03): recall checks ids across
   * the walk.
   */
  async listPage(request: WorkshopSessionPageRequest, signal?: AbortSignal): Promise<WorkshopSessionPage> {
    const paths = this.requireAvailability();
    let directoryEntries: Array<[string, FileType]>;
    try {
      directoryEntries = await this.fileSystem.readDirectory(paths.sessionsDirectory);
    } catch (error) {
      if (isMissingFileError(error)) {
        return { entries: [], remaining: 0 };
      }
      throw error;
    }
    const names = directoryEntries
      .filter(([name, type]) => type === FileType.File && isNamedSessionFileName(name))
      .map(([name]) => name);
    return readWorkshopSessionPage(names, request, (fileName) => this.readPageEntry(paths, fileName, signal), signal, this.pageLimits);
  }

  /**
   * A page's session, read from the file the page named (its cursor), by the
   * exact read's bounds, and only if that file holds `sessionId`. Page-local:
   * it neither reads nor writes the exact-read path cache (PR #216 F-01).
   */
  async readPagedSession(cursor: string, sessionId: string): Promise<WorkshopPersistedSessionV2 | undefined> {
    const paths = this.requireAvailability();
    if (!isNamedSessionFileName(cursor) || cursor !== path.basename(cursor) || cursor.includes('..')) {
      return undefined;
    }
    const decoded = await this.readSessionFileExact(this.namedPath(paths, cursor), cursor);
    return decoded?.session.sessionId === sessionId ? decoded.session : undefined;
  }

  async renameNamed(sessionId: string, title: string): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const found = await this.requireNamedSession(sessionId, paths);
    this.assertNamedSessionNeedsNoRecoveryBeforeMutation(found);
    const nextTitle = title.trim();
    if (!nextTitle) {
      throw new Error('Workshop session title cannot be blank.');
    }
    const updated: WorkshopPersistedSessionV2 = {
      ...found.session,
      title: nextTitle,
      updatedAt: this.now().toISOString()
    };
    const decoded = this.validateSessionForWrite(updated);
    return this.updateNamed(sessionId, decoded, found.session);
  }

  /**
   * Persist a coordinator-created duplicate. The store intentionally does not
   * manufacture aggregate identity: it only ensures the supplied snapshot is
   * distinct from the named source and all existing named checkpoint ids.
   */
  async duplicateNamed(
    sourceSessionId: string,
    duplicate: WorkshopPersistedSessionV2
  ): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const source = await this.requireNamedSession(sourceSessionId, paths);
    this.assertNamedSessionNeedsNoRecoveryBeforeMutation(source);
    if (duplicate.sessionId === sourceSessionId) {
      throw new Error('A duplicated Workshop session must have a fresh session id.');
    }
    return this.saveNamed(duplicate);
  }

  /** Explicit recovery of a session left mid-save (ADR 2026-11-19 D6e); the coordinator runs it on its queue. */
  async recoverNamed(sessionId: string): Promise<WorkshopNamedSessionRecoveryOutcome> {
    const paths = this.requireAvailability();
    const existing = async (id: string) => { const found = await this.findNamedSession(id, paths, { ignoreUnreadable: true }); return found && workshopStoredSessionSummary(found.session, found.fileName); };
    const ports = { fileSystem: this.fileSystem, lock: this.named, log: this.log, read: this.readLocked, saveNamed: (copy: WorkshopPersistedSessionV2) => this.saveNamed(copy), existing, now: () => this.now().toISOString() };
    return recoverWorkshopNamedSession(ports, paths.sessionsDirectory, sessionId);
  }

  private readonly readLocked = async (filePath: string, fileName: string) => (await this.readSessionFileExact(filePath, fileName))?.session;

  async deleteNamed(sessionId: string): Promise<void> {
    const paths = this.requireAvailability();
    const found = await this.requireNamedSession(sessionId, paths);
    await this.named.remove(found.filePath, sessionId);
    await this.deleteSearchIndexIfPresent(paths, found.fileName);
    this.namedSessionPaths.delete(this.namedSessionCacheKey(paths, sessionId));
  }

  /** Resolve a user-visible file action without exposing or accepting raw IPC paths. */
  async resolveRevealPath(sessionId: string | 'current'): Promise<string> {
    const paths = this.requireAvailability();
    if (sessionId === 'current') {
      return paths.currentPath;
    }
    return (await this.requireNamedSession(sessionId, paths)).filePath;
  }

  private requireAvailability(): Extract<WorkshopSessionStoreAvailability, { available: true }> {
    const availability = this.availability();
    const bound = this.roomWorkspace;
    if (bound && (bound.available
      ? !availability.available || bound.rootPath !== availability.rootPath
      : availability.available || bound.reason !== availability.reason)) {
      throw new Error('The Workshop workspace changed after this room was attached.');
    }
    if (!availability.available) {
      throw new WorkshopSessionStoreUnavailableError(availability.reason);
    }
    return availability;
  }

  private async requireNamedSession(
    sessionId: string,
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>
  ): Promise<StoredNamedSession> {
    const found = await this.findNamedSession(sessionId, paths);
    if (!found) {
      throw new WorkshopNamedSessionNotFoundError(sessionId);
    }
    return found;
  }

  private async findNamedSession(
    sessionId: string,
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    options: { ignoreUnreadable?: boolean; underLock?: boolean } = {}
  ): Promise<StoredNamedSession | undefined> {
    if (!sessionId.trim()) {
      return undefined;
    }
    const cacheKey = this.namedSessionCacheKey(paths, sessionId);
    const cached = this.namedSessionPaths.get(cacheKey);
    if (cached) {
      const decoded = await this.readSessionFileExact(cached.filePath, cached.fileName);
      if (decoded?.session.sessionId === sessionId) {
        return { ...cached, ...decoded };
      }
      // Replaced by another session: resolve afresh. Missing: keep the name, the lock a missing read takes (D6e).
      if (decoded) { this.namedSessionPaths.delete(cacheKey); }
    }
    // Exact actions are not browser listing/search: scan all named files so an
    // existing session beyond the browser's safety window cannot be shadowed
    // by a duplicate id or become impossible to open/delete.
    const entries = await this.readNamedSessions(paths, sessionId);
    const matches = entries.sessions.filter((entry) => entry.session.sessionId === sessionId);
    if (matches.length > 1) {
      // A durable identity must select exactly one full authoritative file.
      // Never let directory enumeration choose arbitrarily.
      throw new WorkshopNamedSessionIdentityConflictError(sessionId);
    }
    const found = matches[0];
    if (found) {
      this.rememberNamedSessionPath(
        paths,
        sessionId,
        found.fileName,
        found.filePath
      );
    }
    if (!found && !options.ignoreUnreadable && !options.underLock) { // D6e: missing only on a read under the lock.
      return this.named.decideMissing(paths.sessionsDirectory, sessionId, cached?.fileName, () => this.findNamedSession(sessionId, paths, { ...options, underLock: true }));
    }
    if (!found && entries.failures.length > 0 && !options.ignoreUnreadable) {
      // A malformed file may own the requested durable id. Exact operations
      // cannot honestly report "not found" until every named envelope was read.
      throw entries.failures[0];
    }
    return found;
  }

  private namedSessionCacheKey(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    sessionId: string
  ): string {
    return `${paths.sessionsDirectory}\u0000${sessionId}`;
  }

  private rememberNamedSessionPath(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    sessionId: string,
    fileName: string,
    filePath: string
  ): void {
    this.namedSessionPaths.set(
      this.namedSessionCacheKey(paths, sessionId),
      { fileName, filePath }
    );
  }

  private async readNamedSessions(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    requestedSessionId: string
  ): Promise<{
    sessions: StoredNamedSession[];
    truncated: boolean;
    failures: WorkshopSessionFileReadError[];
  }> {
    let directoryEntries: Array<[string, FileType]>;
    try {
      directoryEntries = await this.fileSystem.readDirectory(paths.sessionsDirectory);
    } catch (error) {
      if (isMissingFileError(error)) {
        return { sessions: [], truncated: false, failures: [] };
      }
      throw error;
    }

    const names = directoryEntries
      .filter(([name, type]) => type === FileType.File && isNamedSessionFileName(name))
      .map(([name]) => name)
      // Timestamp-prefixed names sort chronologically. Bound from the newest
      // end so a busy workspace never hides its recent sessions in favor of
      // the oldest files.
      .sort((left, right) => right.localeCompare(left));
    const sessions: StoredNamedSession[] = [];
    const failures: WorkshopSessionFileReadError[] = [];
    for (const fileName of names) {
      const filePath = this.namedPath(paths, fileName);
      try {
        const indexFileName = workshopSessionSearchIndexFileName(fileName);
        const searchIndex = await this.readSearchIndexForBrowser(
          this.namedPath(paths, indexFileName),
          indexFileName,
          fileName
        );
        // Modern checkpoints can be ruled out from their bounded index. Only
        // the requested match (or a legacy/index-less file) needs a full parse.
        if (searchIndex && searchIndex.sessionId !== requestedSessionId) {
          continue;
        }
        const decoded = await this.readSessionFileExact(filePath, fileName);
        if (decoded) {
          sessions.push({ filePath, fileName, ...decoded });
        }
      } catch (error) {
        const failure = error instanceof WorkshopSessionFileReadError
          ? error
          : new WorkshopSessionFileReadError(fileName, errorMessage(error));
        failures.push(failure);
        this.skip(fileName, failure.message);
      }
    }
    return {
      sessions,
      truncated: false,
      failures
    };
  }

  /** Browser-only enumeration. Search indexes make large, valid checkpoints discoverable. */
  private async readNamedBrowserSessions(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    query: string | undefined,
    signal?: AbortSignal
  ): Promise<{
    sessions: WorkshopStoredSessionSummary[];
    truncated: boolean;
    searchTruncated: boolean;
  }> {
    let directoryEntries: Array<[string, FileType]>;
    try {
      directoryEntries = await this.fileSystem.readDirectory(paths.sessionsDirectory);
    } catch (error) {
      if (isMissingFileError(error)) {
        return { sessions: [], truncated: false, searchTruncated: false };
      }
      throw error;
    }

    const names = directoryEntries
      .filter(([name, type]) => type === FileType.File && isNamedSessionFileName(name))
      .map(([name]) => name)
      .sort((left, right) => right.localeCompare(left));
    const boundedNames = names.slice(0, this.limits.maximumFiles);
    const sessions: WorkshopStoredSessionSummary[] = [];
    let searchTruncated = false;

    for (const fileName of boundedNames) {
      throwIfAborted(signal);
      const searchIndex = await this.readSearchIndexForBrowser(
        this.namedPath(paths, workshopSessionSearchIndexFileName(fileName)),
        workshopSessionSearchIndexFileName(fileName),
        fileName
      );
      const filePath = this.namedPath(paths, fileName);
      const candidate = await this.browserSummaryForFile(
        filePath,
        fileName,
        searchIndex,
        query,
        signal
      );
      if (candidate.summary) {
        sessions.push(candidate.summary);
        this.rememberNamedSessionPath(
          paths,
          candidate.summary.sessionId,
          fileName,
          filePath
        );
      }
      searchTruncated ||= candidate.searchTruncated;
    }

    return {
      sessions,
      truncated: names.length > boundedNames.length,
      searchTruncated
    };
  }

  /**
   * One file of a page: its browser summary, and what it costs the page (its
   * size once with a search index, twice without, since the summary then
   * takes a full read; nothing when too large to summarize). Never remembered
   * for exact reads (PR #216 F-01, F-03).
   */
  private async readPageEntry(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fileName: string,
    signal?: AbortSignal
  ): Promise<WorkshopSessionPageRead> {
    const filePath = this.namedPath(paths, fileName);
    let bytes: number;
    try {
      bytes = (await this.fileSystem.stat(filePath)).size;
    } catch (error) {
      if (isMissingFileError(error)) {
        return { kind: 'gone' };
      }
      this.skip(fileName, errorMessage(error));
      return { kind: 'read', bytes: 0 };
    }
    const indexFileName = workshopSessionSearchIndexFileName(fileName);
    const searchIndex = await this.readSearchIndexForBrowser(this.namedPath(paths, indexFileName), indexFileName, fileName);
    const { summary } = await this.browserSummaryForFile(filePath, fileName, searchIndex, undefined, signal);
    const cost = searchIndex ? bytes : bytes <= this.limits.maximumFileBytes ? 2 * bytes : 0;
    return { kind: 'read', bytes: cost, ...(summary ? { summary } : {}) };
  }

  private async readCurrentForBrowser(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    query: string | undefined,
    signal?: AbortSignal
  ): Promise<{ summary?: WorkshopStoredSessionSummary; searchTruncated: boolean }> {
    const fullPath = paths.currentPath;
    if (!(await this.fileExists(fullPath))) {
      // An orphan current searchIndex must never invent a live session.
      return { searchTruncated: false };
    }
    const fileName = path.basename(fullPath);
    const searchIndex = await this.readSearchIndexForBrowser(
      this.namedPath(paths, workshopSessionSearchIndexFileName(fileName)),
      workshopSessionSearchIndexFileName(fileName),
      fileName
    );
    return this.browserSummaryForFile(fullPath, fileName, searchIndex, query, signal);
  }

  /**
   * Favor a valid searchIndex for no-query/metadata matches. A content query must
   * still inspect the authoritative full payload within its defensive bound.
   */
  private async browserSummaryForFile(
    fullPath: string,
    fileName: string,
    searchIndex: WorkshopSessionSearchIndexV1 | undefined,
    query: string | undefined,
    signal?: AbortSignal
  ): Promise<{ summary?: WorkshopStoredSessionSummary; searchTruncated: boolean }> {
    throwIfAborted(signal);
    if (searchIndex) {
      const summary = workshopStoredSummaryFromSearchIndex(searchIndex);
      if (!query || summaryMatches(summary, query)) {
        return { summary, searchTruncated: false };
      }
      const full = await this.readSessionFileForBrowser(fullPath, fileName);
      throwIfAborted(signal);
      if (!full.session) {
        return { searchTruncated: full.limited };
      }
      const match = fullSessionMatches(full.session, query, this.limits.maximumSearchCharacters);
      return {
        ...(match.matches ? { summary } : {}),
        searchTruncated: match.truncated
      };
    }

    // Pre-searchIndex/legacy files retain their bounded full-parse fallback.
    const full = await this.readSessionFileForBrowser(fullPath, fileName);
    throwIfAborted(signal);
    if (!full.session) {
      return { searchTruncated: full.limited && query !== undefined };
    }
    const summary = workshopStoredSessionSummary(full.session, fileName);
    if (!query) {
      return { summary, searchTruncated: false };
    }
    const match = fullSessionMatches(full.session, query, this.limits.maximumSearchCharacters);
    return {
      ...(match.matches ? { summary } : {}),
      searchTruncated: match.truncated
    };
  }

  /**
   * Identity-sensitive reads use a larger bound than browser enumeration, but
   * remain bounded because workspace files are untrusted Marketplace input.
   */
  private async readSessionFileExact(
    filePath: string,
    displayName: string,
    observed?: (bytes: Uint8Array | undefined) => void
  ): Promise<WorkshopPersistedSessionCheckpointDecodeResult | undefined> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      this.assertExactFileSize(stat.size, displayName);
    } catch (error) {
      if (isMissingFileError(error)) {
        observed?.(undefined);
        return undefined;
      }
      if (error instanceof WorkshopSessionFileReadError) {
        throw error;
      }
      throw new WorkshopSessionFileReadError(displayName, errorMessage(error));
    }
    let bytes: Uint8Array;
    try {
      bytes = await this.fileSystem.readFile(filePath);
    } catch (error) {
      if (isMissingFileError(error)) {
        observed?.(undefined);
        return undefined;
      }
      throw new WorkshopSessionFileReadError(displayName, errorMessage(error));
    }
    try {
      this.assertExactFileSize(bytes.byteLength, displayName);
      observed?.(bytes);
      const text = decoder.decode(bytes);
      assertPersistedJsonNestingDepth(text, `Workshop session ${displayName}`);
      return decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    } catch (error) {
      if (error instanceof WorkshopSessionFileReadError) {
        throw error;
      }
      throw new WorkshopSessionFileReadError(displayName, errorMessage(error));
    }
  }

  /** Tolerant bounded read used only to populate/search the session browser. */
  private async readSessionFileForBrowser(
    filePath: string,
    displayName: string
  ): Promise<BrowserFullRead> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (stat.size > this.limits.maximumFileBytes) {
        this.skip(displayName, `file exceeds ${this.limits.maximumFileBytes} byte browser bound`);
        return { limited: true };
      }
      const bytes = await this.fileSystem.readFile(filePath);
      if (bytes.byteLength > this.limits.maximumFileBytes) {
        this.skip(displayName, `file exceeds ${this.limits.maximumFileBytes} byte browser bound`);
        return { limited: true };
      }
      return {
        session: decodeWorkshopPersistedSessionCheckpoint(
          JSON.parse(decoder.decode(bytes))
        ).session,
        limited: false
      };
    } catch (error) {
      if (!isMissingFileError(error)) {
        this.skip(displayName, errorMessage(error));
      }
      return { limited: false };
    }
  }

  /** Search indexes are browser indexes only: bounded, strict, and never authoritative. */
  private async readSearchIndexForBrowser(
    filePath: string,
    displayName: string,
    expectedFullFileName: string
  ): Promise<WorkshopSessionSearchIndexV1 | undefined> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (stat.size > MAXIMUM_SEARCH_INDEX_BYTES) {
        this.skip(displayName, `search index exceeds ${MAXIMUM_SEARCH_INDEX_BYTES} byte browser bound`);
        return undefined;
      }
      const bytes = await this.fileSystem.readFile(filePath);
      if (bytes.byteLength > MAXIMUM_SEARCH_INDEX_BYTES) {
        this.skip(displayName, `search index exceeds ${MAXIMUM_SEARCH_INDEX_BYTES} byte browser bound`);
        return undefined;
      }
      return parseWorkshopSessionSearchIndexV1(JSON.parse(decoder.decode(bytes)), expectedFullFileName);
    } catch (error) {
      if (!isMissingFileError(error)) {
        this.skip(displayName, errorMessage(error));
      }
      return undefined;
    }
  }

  private async writeSearchIndex(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fullFileName: string,
    session: WorkshopPersistedSessionV2
  ): Promise<void> {
    const searchIndex = buildWorkshopSessionSearchIndexV1(session, fullFileName);
    // Re-validate the exact compact contract before it reaches disk; a search index
    // cannot become a permissive parallel session format by accident.
    const decoded = parseWorkshopSessionSearchIndexV1(searchIndex, fullFileName);
    await this.writeJsonAtomically(
      this.namedPath(paths, workshopSessionSearchIndexFileName(fullFileName)),
      decoded,
      true,
      MAXIMUM_SEARCH_INDEX_BYTES,
      'Workshop session search index'
    );
  }

  private async deleteSearchIndexIfPresent(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fullFileName: string
  ): Promise<void> {
    const searchIndexPath = this.namedPath(paths, workshopSessionSearchIndexFileName(fullFileName));
    try {
      await this.fileSystem.delete(searchIndexPath);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      return stat.type === FileType.File;
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * The full snapshot is authoritative; the compact search index is derived.
   * If index replacement fails after the snapshot commits, remove any stale
   * index so browser reads fall back to the authoritative file.
   */
  private async writeSnapshotWithSearchIndex(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    targetPath: string,
    fileName: string,
    session: WorkshopPersistedSessionV2,
    overwrite: boolean,
    beforeCommit?: () => Promise<void>,
    replace?: LocalRollingClaim['replace']
  ): Promise<Uint8Array> {
    await this.ensureStorageDirectory(paths);
    const bytes = await this.writeAtomically(targetPath, session, overwrite, beforeCommit, replace);
    await this.writeSearchIndexAfterCommit(paths, fileName, session);
    return bytes;
  }

  private async writeSearchIndexAfterCommit(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fileName: string,
    session: WorkshopPersistedSessionV2
  ): Promise<void> {
    try {
      await this.writeSearchIndex(paths, fileName, session);
    } catch (error) {
      try {
        await this.deleteSearchIndexIfPresent(paths, fileName);
      } catch (cleanupError) {
        this.skip(
          workshopSessionSearchIndexFileName(fileName),
          `index write failed (${errorMessage(error)}); stale-index cleanup also failed ` +
          `(${errorMessage(cleanupError)})`
        );
        return;
      }
      this.skip(
        workshopSessionSearchIndexFileName(fileName),
        `index write failed after snapshot commit; removed stale index (${errorMessage(error)})`
      );
    }
  }

  private async ensureStorageDirectory(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>
  ): Promise<void> {
    if (this.ensuredStorageDirectories.has(paths.sessionsDirectory)) {
      return;
    }
    await this.fileSystem.createDirectory(paths.sessionsDirectory);
    const gitignorePath = this.namedPath(paths, '.gitignore');
    if (!(await this.fileExists(gitignorePath))) {
      await this.fileSystem.writeFile(gitignorePath, encoder.encode('*\n!.gitignore\n'));
    }
    this.ensuredStorageDirectories.add(paths.sessionsDirectory);
  }

  private async writeAtomically(
    targetPath: string,
    session: WorkshopPersistedSessionV2,
    overwrite: boolean,
    beforeCommit?: () => Promise<void>,
    replace?: LocalRollingClaim['replace']
  ): Promise<Uint8Array> {
    return this.writeJsonAtomically(
      targetPath,
      session,
      overwrite,
      this.limits.maximumExactFileBytes,
      'Workshop session',
      beforeCommit,
      replace
    );
  }

  private async writeJsonAtomically(
    targetPath: string,
    value: WorkshopPersistedSessionV2 | WorkshopSessionSearchIndexV1,
    overwrite: boolean,
    maximumBytes: number,
    description: string,
    beforeCommit?: () => Promise<void>,
    replace?: LocalRollingClaim['replace']
  ): Promise<Uint8Array> {
    const bytes = this.named.encode(value, description, maximumBytes);
    const temporaryPath = `${targetPath}.tmp-${randomUUID()}`;
    try {
      await this.fileSystem.writeFile(temporaryPath, bytes);
      await beforeCommit?.();
      if (overwrite && replace) {
        await replace(temporaryPath);
      } else {
        await this.fileSystem.rename(temporaryPath, targetPath, { overwrite });
      }
    } catch (error) {
      try {
        await this.fileSystem.delete(temporaryPath);
      } catch {
        // Best effort only: the next write uses a new unique temp name.
      }
      throw error;
    }
    return bytes;
  }

  private namedPath(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fileName: string
  ): string {
    const candidate = path.join(paths.sessionsDirectory, fileName);
    if (!isPathWithinRoot(paths.sessionsDirectory, candidate)) {
      throw new Error('Workshop session filename escaped its storage directory.');
    }
    return candidate;
  }

  private namedFileName(initialSlug: string, collision: number): string {
    const stamp = formatFilenameTimestamp(this.now());
    return `${stamp}-${initialSlug}${collision === 0 ? '' : `-${collision + 1}`}.json`;
  }

  private validateSessionForWrite(
    session: WorkshopPersistedSessionV2
  ): WorkshopPersistedSessionV2 {
    return parseWorkshopPersistedSession(session);
  }

  /**
   * Recovery commits only through intentional session hydration and its later
   * save. Browser metadata operations must never silently rewrite writer data.
   */
  private assertNamedSessionNeedsNoRecoveryBeforeMutation(
    session: StoredNamedSession
  ): void {
    if (session.recoveryNotices.length > 0) {
      throw new Error(
        'Open this Workshop session before renaming or duplicating it so its saved configuration can be recovered deliberately.'
      );
    }
  }

  private assertExactFileSize(size: number, displayName: string): void {
    if (size > this.limits.maximumExactFileBytes) {
      throw new WorkshopSessionFileReadError(
        displayName,
        `file exceeds the ${formatByteLimit(this.limits.maximumExactFileBytes)} ` +
        'exact-read bound. Move or remove this checkpoint before reopening Workshop.'
      );
    }
  }

  private skip(fileName: string, reason: string): void {
    this.log.appendLine(`[WorkshopSessionStore] Skipped ${fileName}: ${reason}`);
  }
}

function compareSummariesNewestFirst(left: WorkshopStoredSessionSummary, right: WorkshopStoredSessionSummary): number {
  const byUpdatedAt = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  if (byUpdatedAt !== 0) {
    return byUpdatedAt;
  }
  return left.sessionId.localeCompare(right.sessionId);
}

function normalizedQuery(query: string | undefined): string | undefined {
  const normalized = query?.trim().toLocaleLowerCase();
  return normalized || undefined;
}

function summaryMatches(summary: WorkshopStoredSessionSummary, query: string): boolean {
  return [
    summary.title,
    summary.hostPersonaId,
    ...summary.participantPersonaIds,
    summary.excerptLabel ?? '',
    summary.excerptIdentity ?? '',
    summary.preview ?? ''
  ].join('\n').toLocaleLowerCase().includes(query);
}

function fullSessionMatches(
  session: WorkshopPersistedSessionV2,
  query: string,
  maximumCharacters: number
): { matches: boolean; truncated: boolean } {
  if (summaryMatches(workshopStoredSessionSummary(session, 'ignored.json'), query)) {
    return { matches: true, truncated: false };
  }
  // Transcript, excerpt, and archive-only memory remain host-side. Walk only
  // the bounded amount of text the browser is allowed to inspect instead of
  // serializing the full unbounded session and slicing afterward.
  const bounded = boundedSearchText(
    [session.workshop, session.conversations],
    maximumCharacters
  );
  return {
    matches: bounded.text.toLocaleLowerCase().includes(query),
    truncated: bounded.truncated
  };
}

function boundedSearchText(
  roots: readonly unknown[],
  maximumCharacters: number
): { text: string; truncated: boolean } {
  const stack = [...roots].reverse();
  const chunks: string[] = [];
  let length = 0;
  let truncated = false;

  const append = (value: string): boolean => {
    const chunk = chunks.length === 0 ? value : `\n${value}`;
    const remaining = Math.max(0, maximumCharacters - length);
    if (chunk.length > remaining) {
      chunks.push(chunk.slice(0, remaining));
      length += remaining;
      truncated = true;
      return false;
    }
    chunks.push(chunk);
    length += chunk.length;
    return true;
  };

  while (stack.length > 0) {
    const value = stack.pop();
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      if (!append(String(value))) {
        break;
      }
      continue;
    }
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push(value[index]);
      }
      continue;
    }
    if (isRecord(value)) {
      const entries = Object.entries(value);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, nested] = entries[index];
        stack.push(nested);
        stack.push(key);
      }
    }
  }

  return {
    text: chunks.join(''),
    truncated: truncated || stack.length > 0
  };
}

function titleSlug(title: string): string {
  const slug = title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'untitled-session';
}

function formatFilenameTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function isMissingFileError(error: unknown): boolean {
  return isMissingFileSystemPathError(error);
}

function isDestinationExistsError(error: unknown): boolean {
  return /EEXIST|already exists|destination exists/i.test(errorMessage(error));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Workshop session search was superseded.');
    error.name = 'AbortError';
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function needsCheckpointRecovery(decoded: WorkshopPersistedSessionCheckpointDecodeResult): boolean {
  // Routine legacy defaults, migrated room offsets and unverified history marks do not drop
  // writer content. Never prune a checkpoint whose widget, bookmark, or reaction had to be discarded.
  return decoded.recoveryNotices.length > 0 || decoded.normalizations.some(change =>
    change === 'dropped-dangling-bookmarks' || change === 'dropped-dangling-reactions' ||
    change === 'discarded-nonpersona-widget-recommendation' || change === 'dropped-duplicate-pending-lightbox-tiles');
}

function rollingRevision(bytes: Uint8Array | undefined): string {
  return bytes ? createHash('sha256').update(bytes).digest('hex') : 'absent';
}
