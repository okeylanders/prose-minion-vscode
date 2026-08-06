/**
 * Workspace-file store for durable Workshop session envelopes (ADR 2026-07-14).
 *
 * This class deliberately owns only filesystem concerns: paths, tolerant reads,
 * bounded summaries/search, and atomic file replacement. It does not hydrate a
 * Workshop aggregate, import conversations, invoke a shell, or interpret IPC.
 * The application coordinator supplies complete `WorkshopPersistedSessionV1`
 * snapshots and owns those higher-level transactions.
 */

import * as path from 'path';
import {
  WorkshopPersistedSessionV1,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { FileSystem, FileType, LogSink, Workspace } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
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
  session?: WorkshopPersistedSessionV1;
  /** The browser chose not to parse this valid-looking large file. */
  limited: boolean;
}

interface StoredNamedSession {
  filePath: string;
  fileName: string;
  session: WorkshopPersistedSessionV1;
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
  private temporaryWriteCounter = 0;
  private readonly ensuredStorageDirectories = new Set<string>();
  /**
   * A named file's path is immutable after allocation. Cache only paths this
   * store has created or resolved authoritatively so live-room autosave does
   * not reparse every saved transcript after each committed mutation.
   */
  private readonly namedSessionPaths = new Map<string, CachedNamedSessionPath>();

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    private readonly now: () => Date = () => new Date(),
    private readonly limits: WorkshopSessionStoreLimits = WORKSHOP_SESSION_STORE_LIMITS
  ) {}

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
      currentPath: path.join(sessionsDirectory, 'current.json')
    };
  }

  async readCurrent(): Promise<WorkshopPersistedSessionV1 | undefined> {
    const paths = this.requireAvailability();
    return this.readSessionFileExact(paths.currentPath, 'current.json');
  }

  async writeCurrent(session: WorkshopPersistedSessionV1): Promise<void> {
    const paths = this.requireAvailability();
    const decoded = this.validateSessionForWrite(session);
    await this.writeSnapshotWithSearchIndex(
      paths,
      paths.currentPath,
      'current.json',
      decoded,
      true
    );
  }

  /** Allocate a named file with immutable identity/path. The caller supplies a fresh id. */
  async saveNamed(session: WorkshopPersistedSessionV1): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const decoded = this.validateSessionForWrite(session);
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
    session: WorkshopPersistedSessionV1
  ): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const found = await this.requireNamedSessionPath(sessionId, paths);
    const decoded = this.validateSessionForWrite(session);
    if (decoded.sessionId !== sessionId) {
      throw new Error('Updated Workshop session identity does not match its target.');
    }
    await this.writeSnapshotWithSearchIndex(
      paths,
      found.filePath,
      found.fileName,
      decoded,
      true
    );
    this.rememberNamedSessionPath(
      paths,
      decoded.sessionId,
      found.fileName,
      found.filePath
    );
    return workshopStoredSessionSummary(decoded, found.fileName);
  }

  /** Load a named checkpoint by durable identity; a caller-supplied path is never accepted. */
  async readNamed(sessionId: string): Promise<WorkshopPersistedSessionV1 | undefined> {
    const paths = this.requireAvailability();
    const found = await this.findNamedSession(sessionId, paths);
    return found?.session;
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
      sessions: entries.sessions.sort(compareSummariesNewestFirst),
      truncated: entries.truncated,
      searchTruncated: entries.searchTruncated || current.searchTruncated
    };
  }

  async renameNamed(sessionId: string, title: string): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    const found = await this.requireNamedSession(sessionId, paths);
    const nextTitle = title.trim();
    if (!nextTitle) {
      throw new Error('Workshop session title cannot be blank.');
    }
    const updated: WorkshopPersistedSessionV1 = {
      ...found.session,
      title: nextTitle,
      updatedAt: this.now().toISOString()
    };
    const decoded = this.validateSessionForWrite(updated);
    await this.writeSnapshotWithSearchIndex(
      paths,
      found.filePath,
      found.fileName,
      decoded,
      true
    );
    return workshopStoredSessionSummary(decoded, found.fileName);
  }

  /**
   * Persist a coordinator-created duplicate. The store intentionally does not
   * manufacture aggregate identity: it only ensures the supplied snapshot is
   * distinct from the named source and all existing named checkpoint ids.
   */
  async duplicateNamed(
    sourceSessionId: string,
    duplicate: WorkshopPersistedSessionV1
  ): Promise<WorkshopStoredSessionSummary> {
    const paths = this.requireAvailability();
    await this.requireNamedSession(sourceSessionId, paths);
    if (duplicate.sessionId === sourceSessionId) {
      throw new Error('A duplicated Workshop session must have a fresh session id.');
    }
    return this.saveNamed(duplicate);
  }

  async deleteNamed(sessionId: string): Promise<void> {
    const paths = this.requireAvailability();
    const found = await this.requireNamedSession(sessionId, paths);
    await this.fileSystem.delete(found.filePath);
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

  /**
   * Autosave updates need the immutable target path, not the old transcript.
   * A valid compact index confirms the cached identity without reparsing the
   * full file immediately before it is replaced.
   */
  private async requireNamedSessionPath(
    sessionId: string,
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>
  ): Promise<CachedNamedSessionPath> {
    const cacheKey = this.namedSessionCacheKey(paths, sessionId);
    const cached = this.namedSessionPaths.get(cacheKey);
    if (cached) {
      const indexFileName = workshopSessionSearchIndexFileName(cached.fileName);
      const searchIndex = await this.readSearchIndexForBrowser(
        this.namedPath(paths, indexFileName),
        indexFileName,
        cached.fileName
      );
      if (searchIndex?.sessionId === sessionId) {
        return cached;
      }
      this.namedSessionPaths.delete(cacheKey);
    }
    const found = await this.requireNamedSession(sessionId, paths);
    return { fileName: found.fileName, filePath: found.filePath };
  }

  private async findNamedSession(
    sessionId: string,
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    options: { ignoreUnreadable?: boolean } = {}
  ): Promise<StoredNamedSession | undefined> {
    if (!sessionId.trim()) {
      return undefined;
    }
    const cacheKey = this.namedSessionCacheKey(paths, sessionId);
    const cached = this.namedSessionPaths.get(cacheKey);
    if (cached) {
      const session = await this.readSessionFileExact(cached.filePath, cached.fileName);
      if (session?.sessionId === sessionId) {
        return { ...cached, session };
      }
      // Missing or manually replaced: fall back to a full conflict-aware
      // resolution instead of writing through a stale path.
      this.namedSessionPaths.delete(cacheKey);
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
        const session = await this.readSessionFileExact(filePath, fileName);
        if (session) {
          sessions.push({ filePath, fileName, session });
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
    const fileName = 'current.json';
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
    displayName: string
  ): Promise<WorkshopPersistedSessionV1 | undefined> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      this.assertExactFileSize(stat.size, displayName);
    } catch (error) {
      if (isMissingFileError(error)) {
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
        return undefined;
      }
      throw new WorkshopSessionFileReadError(displayName, errorMessage(error));
    }
    try {
      this.assertExactFileSize(bytes.byteLength, displayName);
      const text = decoder.decode(bytes);
      assertPersistedJsonNestingDepth(text, `Workshop session ${displayName}`);
      return parseWorkshopPersistedSession(JSON.parse(text));
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
      return { session: parseWorkshopPersistedSession(JSON.parse(decoder.decode(bytes))), limited: false };
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
    session: WorkshopPersistedSessionV1
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
    session: WorkshopPersistedSessionV1,
    overwrite: boolean
  ): Promise<void> {
    await this.ensureStorageDirectory(paths);
    await this.writeAtomically(targetPath, session, overwrite);
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
    session: WorkshopPersistedSessionV1,
    overwrite: boolean
  ): Promise<void> {
    await this.writeJsonAtomically(
      targetPath,
      session,
      overwrite,
      this.limits.maximumExactFileBytes,
      'Workshop session'
    );
  }

  private async writeJsonAtomically(
    targetPath: string,
    value: WorkshopPersistedSessionV1 | WorkshopSessionSearchIndexV1,
    overwrite: boolean,
    maximumBytes: number,
    description: string
  ): Promise<void> {
    const text = JSON.stringify(value, undefined, 2);
    assertPersistedJsonNestingDepth(text, description);
    const bytes = encoder.encode(text);
    if (bytes.byteLength > maximumBytes) {
      const guidance = description === 'Workshop session'
        ? ' Start a new Workshop session or remove retained context; the existing checkpoint remains unchanged.'
        : '';
      throw new Error(
        `${description} exceeds the maximum persisted size of ` +
        `${formatByteLimit(maximumBytes)}.${guidance}`
      );
    }

    const temporaryPath = `${targetPath}.tmp-${this.now().getTime()}-${++this.temporaryWriteCounter}`;
    try {
      await this.fileSystem.writeFile(temporaryPath, bytes);
      await this.fileSystem.rename(temporaryPath, targetPath, { overwrite });
    } catch (error) {
      try {
        await this.fileSystem.delete(temporaryPath);
      } catch {
        // Best effort only: the next write uses a new unique temp name.
      }
      throw error;
    }
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
    session: WorkshopPersistedSessionV1
  ): WorkshopPersistedSessionV1 {
    return parseWorkshopPersistedSession(session);
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

function formatByteLimit(bytes: number): string {
  const mebibyte = 1024 * 1024;
  return bytes % mebibyte === 0
    ? `${bytes / mebibyte} MiB`
    : `${bytes.toLocaleString('en-US')} bytes`;
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
  session: WorkshopPersistedSessionV1,
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

function isNamedSessionFileName(name: string): boolean {
  return name.endsWith('.json') &&
    name !== 'current.json' &&
    !name.endsWith('.summary.json');
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
