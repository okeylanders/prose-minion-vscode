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
  WorkshopPersistedSummaryV1,
  WorkshopPersistedSessionV1,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { FileSystem, FileType, LogSink, Workspace } from '@/platform';
import { isPathWithinRoot } from './pathContainment';
import { WorkshopPersonaId } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** A sidecar is metadata, never a second full snapshot. */
const MAXIMUM_SUMMARY_SIDECAR_BYTES = 64 * 1024;

export const WORKSHOP_SESSION_STORE_LIMITS = Object.freeze({
  /** Keep one noisy workspace directory from making browser open unbounded. */
  maximumFiles: 200,
  /** Session JSON is user-owned input; do not eagerly parse an arbitrary blob. */
  maximumFileBytes: 5 * 1024 * 1024,
  /** Bound the amount of serialized session text inspected for browser search. */
  maximumSearchCharacters: 250_000,
  /** A failed write must not spin forever on a hostile filesystem provider. */
  maximumNameCollisions: 100
});

export interface WorkshopSessionStoreLimits {
  maximumFiles: number;
  maximumFileBytes: number;
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

export interface WorkshopStoredSessionSummary {
  /** Durable envelope identity; safe to send back in typed IPC. Never a path. */
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  startedAt: string;
  timezone: string;
  hostPersonaId: WorkshopPersistedSessionV1['summary']['hostPersonaId'];
  participantPersonaIds: WorkshopPersistedSessionV1['summary']['participantPersonaIds'];
  turnCount: number;
  excerptWordCount: number;
  excerptLabel?: string;
  excerptIdentity?: string;
  preview?: string;
  /** Storage identity for diagnostic display only; never an absolute path. */
  fileName: string;
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
interface WorkshopSessionSummarySidecarV1 {
  schemaVersion: 1;
  fileName: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  startedAt: string;
  timezone: string;
  summary: WorkshopPersistedSummaryV1;
}

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
    await this.writeAtomically(paths.currentPath, decoded, true);
    await this.writeSummarySidecar(paths, 'current.json', decoded);
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
        await this.writeAtomically(filePath, decoded, false);
        await this.writeSummarySidecar(paths, fileName, decoded);
        this.rememberNamedSessionPath(paths, decoded.sessionId, fileName, filePath);
        return sessionSummary(decoded, fileName);
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
    const found = await this.requireNamedSession(sessionId, paths);
    const decoded = this.validateSessionForWrite(session);
    if (decoded.sessionId !== sessionId) {
      throw new Error('Updated Workshop session identity does not match its target.');
    }
    await this.writeAtomically(found.filePath, decoded, true);
    await this.writeSummarySidecar(paths, found.fileName, decoded);
    this.rememberNamedSessionPath(
      paths,
      decoded.sessionId,
      found.fileName,
      found.filePath
    );
    return sessionSummary(decoded, found.fileName);
  }

  /** Load a named checkpoint by durable identity; a caller-supplied path is never accepted. */
  async readNamed(sessionId: string): Promise<WorkshopPersistedSessionV1 | undefined> {
    const paths = this.requireAvailability();
    const found = await this.findNamedSession(sessionId, paths);
    return found?.session;
  }

  async list(query?: string): Promise<WorkshopSessionListResult> {
    const paths = this.requireAvailability();
    const normalized = normalizedQuery(query);
    const entries = await this.readNamedBrowserSessions(paths, normalized);
    const current = await this.readCurrentForBrowser(paths, normalized);
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
    await this.writeAtomically(found.filePath, decoded, true);
    await this.writeSummarySidecar(paths, found.fileName, decoded);
    return sessionSummary(decoded, found.fileName);
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
    await this.deleteSummarySidecarIfPresent(paths, found.fileName);
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
    const entries = await this.readNamedSessions(paths);
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
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>
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

  /** Browser-only enumeration. Sidecars make large, valid checkpoints discoverable. */
  private async readNamedBrowserSessions(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    query: string | undefined
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
      const sidecar = await this.readSummarySidecarForBrowser(
        this.namedPath(paths, summarySidecarFileName(fileName)),
        summarySidecarFileName(fileName),
        fileName
      );
      const filePath = this.namedPath(paths, fileName);
      const candidate = await this.browserSummaryForFile(filePath, fileName, sidecar, query);
      if (candidate.summary) {
        sessions.push(candidate.summary);
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
    query: string | undefined
  ): Promise<{ summary?: WorkshopStoredSessionSummary; searchTruncated: boolean }> {
    const fullPath = paths.currentPath;
    if (!(await this.fileExists(fullPath))) {
      // An orphan current sidecar must never invent a live session.
      return { searchTruncated: false };
    }
    const fileName = 'current.json';
    const sidecar = await this.readSummarySidecarForBrowser(
      this.namedPath(paths, summarySidecarFileName(fileName)),
      summarySidecarFileName(fileName),
      fileName
    );
    return this.browserSummaryForFile(fullPath, fileName, sidecar, query);
  }

  /**
   * Favor a valid sidecar for no-query/metadata matches. A content query must
   * still inspect the authoritative full payload within its defensive bound.
   */
  private async browserSummaryForFile(
    fullPath: string,
    fileName: string,
    sidecar: WorkshopSessionSummarySidecarV1 | undefined,
    query: string | undefined
  ): Promise<{ summary?: WorkshopStoredSessionSummary; searchTruncated: boolean }> {
    if (sidecar) {
      const summary = sidecarSummary(sidecar);
      if (!query || summaryMatches(summary, query)) {
        return { summary, searchTruncated: false };
      }
      const full = await this.readSessionFileForBrowser(fullPath, fileName);
      if (!full.session) {
        return { searchTruncated: full.limited };
      }
      const match = fullSessionMatches(full.session, query, this.limits.maximumSearchCharacters);
      return {
        ...(match.matches ? { summary } : {}),
        searchTruncated: match.truncated
      };
    }

    // Pre-sidecar/legacy files retain their bounded full-parse fallback.
    const full = await this.readSessionFileForBrowser(fullPath, fileName);
    if (!full.session) {
      return { searchTruncated: full.limited && query !== undefined };
    }
    const summary = sessionSummary(full.session, fileName);
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
   * Identity-sensitive reads are intentionally unbounded. V1 stores the full
   * transcript and provider archive, so a snapshot written by this store must
   * remain readable regardless of the browser's defensive enumeration limit.
   */
  private async readSessionFileExact(
    filePath: string,
    displayName: string
  ): Promise<WorkshopPersistedSessionV1 | undefined> {
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
      return parseWorkshopPersistedSession(JSON.parse(decoder.decode(bytes)));
    } catch (error) {
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

  /** Sidecars are browser indexes only: bounded, strict, and never authoritative. */
  private async readSummarySidecarForBrowser(
    filePath: string,
    displayName: string,
    expectedFullFileName: string
  ): Promise<WorkshopSessionSummarySidecarV1 | undefined> {
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (stat.size > MAXIMUM_SUMMARY_SIDECAR_BYTES) {
        this.skip(displayName, `summary sidecar exceeds ${MAXIMUM_SUMMARY_SIDECAR_BYTES} byte browser bound`);
        return undefined;
      }
      const bytes = await this.fileSystem.readFile(filePath);
      if (bytes.byteLength > MAXIMUM_SUMMARY_SIDECAR_BYTES) {
        this.skip(displayName, `summary sidecar exceeds ${MAXIMUM_SUMMARY_SIDECAR_BYTES} byte browser bound`);
        return undefined;
      }
      return parseSummarySidecar(JSON.parse(decoder.decode(bytes)), expectedFullFileName);
    } catch (error) {
      if (!isMissingFileError(error)) {
        this.skip(displayName, errorMessage(error));
      }
      return undefined;
    }
  }

  private async writeSummarySidecar(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fullFileName: string,
    session: WorkshopPersistedSessionV1
  ): Promise<void> {
    const sidecar = summarySidecar(session, fullFileName);
    // Re-validate the exact compact contract before it reaches disk; a sidecar
    // cannot become a permissive parallel session format by accident.
    const decoded = parseSummarySidecar(sidecar, fullFileName);
    await this.writeJsonAtomically(
      this.namedPath(paths, summarySidecarFileName(fullFileName)),
      decoded,
      true
    );
  }

  private async deleteSummarySidecarIfPresent(
    paths: Extract<WorkshopSessionStoreAvailability, { available: true }>,
    fullFileName: string
  ): Promise<void> {
    const sidecarPath = this.namedPath(paths, summarySidecarFileName(fullFileName));
    try {
      await this.fileSystem.delete(sidecarPath);
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

  private async writeAtomically(
    targetPath: string,
    session: WorkshopPersistedSessionV1,
    overwrite: boolean
  ): Promise<void> {
    await this.writeJsonAtomically(targetPath, session, overwrite);
  }

  private async writeJsonAtomically(
    targetPath: string,
    value: WorkshopPersistedSessionV1 | WorkshopSessionSummarySidecarV1,
    overwrite: boolean
  ): Promise<void> {
    const temporaryPath = `${targetPath}.tmp-${this.now().getTime()}-${++this.temporaryWriteCounter}`;
    try {
      await this.fileSystem.writeFile(temporaryPath, encoder.encode(JSON.stringify(value, undefined, 2)));
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

  private skip(fileName: string, reason: string): void {
    this.log.appendLine(`[WorkshopSessionStore] Skipped ${fileName}: ${reason}`);
  }
}

function sessionSummary(
  session: WorkshopPersistedSessionV1,
  fileName: string
): WorkshopStoredSessionSummary {
  return sidecarSummary(summarySidecar(session, fileName));
}

function summarySidecar(
  session: WorkshopPersistedSessionV1,
  fileName: string
): WorkshopSessionSummarySidecarV1 {
  return {
    schemaVersion: 1,
    fileName,
    sessionId: session.sessionId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...(session.savedAt ? { savedAt: session.savedAt } : {}),
    startedAt: session.temporal.startedAt,
    timezone: session.temporal.timezone,
    summary: {
      hostPersonaId: session.summary.hostPersonaId,
      participantPersonaIds: [...session.summary.participantPersonaIds],
      turnCount: session.summary.turnCount,
      excerptWordCount: session.summary.excerptWordCount,
      ...(session.summary.excerptLabel ? { excerptLabel: session.summary.excerptLabel } : {}),
      ...(session.summary.excerptIdentity ? { excerptIdentity: session.summary.excerptIdentity } : {}),
      ...(session.summary.preview ? { preview: session.summary.preview } : {})
    }
  };
}

function sidecarSummary(sidecar: WorkshopSessionSummarySidecarV1): WorkshopStoredSessionSummary {
  return {
    sessionId: sidecar.sessionId,
    title: sidecar.title,
    createdAt: sidecar.createdAt,
    updatedAt: sidecar.updatedAt,
    ...(sidecar.savedAt ? { savedAt: sidecar.savedAt } : {}),
    startedAt: sidecar.startedAt,
    timezone: sidecar.timezone,
    hostPersonaId: sidecar.summary.hostPersonaId,
    participantPersonaIds: [...sidecar.summary.participantPersonaIds],
    turnCount: sidecar.summary.turnCount,
    excerptWordCount: sidecar.summary.excerptWordCount,
    ...(sidecar.summary.excerptLabel ? { excerptLabel: sidecar.summary.excerptLabel } : {}),
    ...(sidecar.summary.excerptIdentity ? { excerptIdentity: sidecar.summary.excerptIdentity } : {}),
    ...(sidecar.summary.preview ? { preview: sidecar.summary.preview } : {}),
    fileName: sidecar.fileName
  };
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
  session: WorkshopPersistedSessionV1,
  query: string,
  maximumCharacters: number
): { matches: boolean; truncated: boolean } {
  if (summaryMatches(sessionSummary(session, 'ignored.json'), query)) {
    return { matches: true, truncated: false };
  }
  // Transcript and excerpt remain host-side; this bounded serialized scan lets
  // the browser search them without shipping all session content to React.
  const serialized = JSON.stringify(session.workshop);
  return {
    matches: serialized.slice(0, maximumCharacters).toLocaleLowerCase().includes(query),
    truncated: serialized.length > maximumCharacters
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

function summarySidecarFileName(fullFileName: string): string {
  if (fullFileName === 'current.json') {
    return 'current.summary.json';
  }
  return `${fullFileName.slice(0, -'.json'.length)}.summary.json`;
}

function isNamedSessionFileName(name: string): boolean {
  return name.endsWith('.json') &&
    name !== 'current.json' &&
    !name.endsWith('.summary.json');
}

function parseSummarySidecar(
  value: unknown,
  expectedFileName: string
): WorkshopSessionSummarySidecarV1 {
  if (!isRecord(value)) {
    throw new Error('Workshop session summary sidecar must contain a JSON object.');
  }
  exactKeys(
    value,
    'Workshop session summary sidecar',
    [
      'schemaVersion',
      'fileName',
      'sessionId',
      'title',
      'createdAt',
      'updatedAt',
      'startedAt',
      'timezone',
      'summary'
    ],
    ['savedAt']
  );
  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported Workshop summary schema: ${String(value.schemaVersion)}`);
  }
  if (value.fileName !== expectedFileName) {
    throw new Error('Workshop session summary sidecar belongs to a different snapshot.');
  }
  for (const key of ['sessionId', 'title', 'createdAt', 'updatedAt', 'startedAt', 'timezone'] as const) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) {
      throw new Error(`Workshop session summary sidecar has an invalid ${key}.`);
    }
  }
  for (const key of ['createdAt', 'updatedAt', 'startedAt'] as const) {
    if (!isTimestamp(value[key])) {
      throw new Error(`Workshop session summary sidecar has an invalid ${key}.`);
    }
  }
  if (value.savedAt !== undefined && !isTimestamp(value.savedAt)) {
    throw new Error('Workshop session summary sidecar has an invalid savedAt.');
  }
  const sessionId = value.sessionId as string;
  const title = value.title as string;
  const createdAt = value.createdAt as string;
  const updatedAt = value.updatedAt as string;
  const startedAt = value.startedAt as string;
  const timezone = value.timezone as string;
  const savedAt = value.savedAt as string | undefined;
  assertTimezone(timezone);
  const summary = parseSidecarSummary(value.summary);
  return {
    schemaVersion: 1,
    fileName: expectedFileName,
    sessionId,
    title,
    createdAt: normalizeTimestamp(createdAt),
    updatedAt: normalizeTimestamp(updatedAt),
    ...(savedAt !== undefined ? { savedAt: normalizeTimestamp(savedAt) } : {}),
    startedAt: normalizeTimestamp(startedAt),
    timezone,
    summary
  };
}

function parseSidecarSummary(value: unknown): WorkshopPersistedSummaryV1 {
  if (!isRecord(value)) {
    throw new Error('Workshop session summary sidecar has an invalid summary.');
  }
  exactKeys(
    value,
    'Workshop session summary sidecar summary',
    ['hostPersonaId', 'participantPersonaIds', 'turnCount', 'excerptWordCount'],
    ['excerptLabel', 'excerptIdentity', 'preview']
  );
  if (!isWorkshopPersonaId(value.hostPersonaId)) {
    throw new Error('Workshop session summary sidecar has an invalid host persona.');
  }
  if (!Array.isArray(value.participantPersonaIds) || value.participantPersonaIds.some(
    (personaId) => !isWorkshopPersonaId(personaId)
  )) {
    throw new Error('Workshop session summary sidecar has invalid participant personas.');
  }
  if (!isNonNegativeInteger(value.turnCount) || !isNonNegativeInteger(value.excerptWordCount)) {
    throw new Error('Workshop session summary sidecar has invalid counts.');
  }
  for (const key of ['excerptLabel', 'excerptIdentity', 'preview'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new Error(`Workshop session summary sidecar has an invalid ${key}.`);
    }
  }
  return {
    hostPersonaId: value.hostPersonaId as WorkshopPersonaId,
    participantPersonaIds: [...value.participantPersonaIds] as WorkshopPersonaId[],
    turnCount: value.turnCount,
    excerptWordCount: value.excerptWordCount,
    ...(typeof value.excerptLabel === 'string' ? { excerptLabel: value.excerptLabel } : {}),
    ...(typeof value.excerptIdentity === 'string' ? { excerptIdentity: value.excerptIdentity } : {}),
    ...(typeof value.preview === 'string' ? { preview: value.preview } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  label: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown field ${key}.`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label} is missing required field ${key}.`);
    }
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function assertTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error(`Workshop session summary sidecar has an invalid timezone: ${value}`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return /ENOENT|not found|unseeded path/i.test(errorMessage(error));
}

function isDestinationExistsError(error: unknown): boolean {
  return /EEXIST|already exists|destination exists/i.test(errorMessage(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
