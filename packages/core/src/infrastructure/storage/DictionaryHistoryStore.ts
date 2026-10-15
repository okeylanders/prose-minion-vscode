/**
 * Host-owned Dictionary lookup history (ADR 2026-10-14, D1, D3, D4, D7).
 *
 * Keeps the newest lookups in memory and persists them to
 * `prose-minion/history/dictionary.json` in a single-folder workspace. The
 * composition root builds ONE instance and shares it through `CoreServices`,
 * so the sidebar and the Workshop panel see the same ledger.
 *
 * Two promises shape the implementation:
 * - History never fails a lookup. Persistence problems are logged and degrade
 *   durability to `session`; `record` keeps the entry in memory and resolves.
 * - The store never destroys a file it could not read. An untrustworthy file
 *   is renamed aside (never overwritten); a file it can neither read nor set
 *   aside leaves the history session-only rather than clobbering it.
 *
 * Every operation runs through one promise chain, so the lazy load happens
 * once and writes never interleave. Logs carry ids, counts, and reasons only,
 * never the writer's words, context, or results.
 */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  DictionaryHistoryDurability,
  DictionaryHistoryEntry,
  DictionaryHistorySummary,
  DictionaryLookupRequest
} from '@messages';
import type { FileSystem, LogSink, Workspace } from '@/platform';
import { ListenerSet } from '@/utils/ListenerSet';
import {
  DICTIONARY_HISTORY_DISPLAY_PATH,
  DICTIONARY_HISTORY_LIMIT
} from '@shared/constants/dictionaryHistory';
import {
  copyDictionaryHistoryEntry,
  decodeDictionaryHistoryFile,
  encodeDictionaryHistoryFile,
  toDictionaryHistorySummary
} from '@/infrastructure/storage/dictionaryHistoryCodec';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LOG_PREFIX = '[DictionaryHistoryStore]';

export interface DictionaryHistorySnapshot {
  /** Newest first. */
  entries: DictionaryHistorySummary[];
  durability: DictionaryHistoryDurability;
  limit: number;
}

export interface DictionaryHistoryRecordInput {
  request: DictionaryLookupRequest;
  modelIds: readonly string[];
  toolName: string;
  result: string;
}

export interface DictionaryHistoryStoreOptions {
  limit?: number;
  now?: () => Date;
  createId?: () => string;
}

/**
 * Resolved once, at first load: the history belongs to the folder it was read
 * from, so a later workspace change can never write it into another project.
 */
type DictionaryHistoryLocation =
  | { kind: 'project'; directory: string; filePath: string }
  | { kind: 'session'; reason: 'no-workspace' | 'multi-root' };

export class DictionaryHistoryStore {
  private readonly limit: number;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly changeListeners: ListenerSet<[]>;

  private entries: DictionaryHistoryEntry[] = [];
  private location: DictionaryHistoryLocation | undefined;
  /** The last write failed; cleared by the next successful one. */
  private lastWriteFailed = false;
  /** The existing file could be neither read nor set aside, so writing would destroy it. */
  private persistenceBlocked = false;
  private queue: Promise<unknown> = Promise.resolve();
  private temporaryWriteCounter = 0;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    options: DictionaryHistoryStoreOptions = {}
  ) {
    this.limit = options.limit ?? DICTIONARY_HISTORY_LIMIT;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => `dict-hist-${Date.now()}-${randomUUID()}`);
    this.changeListeners = new ListenerSet(`${LOG_PREFIX} Change listener`, log);
  }

  /**
   * Subscribe to record, delete, and clear. Returns the unsubscribe closure;
   * each DictionaryHandler owns its registration and releases it on dispose.
   */
  onDidChange(listener: () => void): () => void {
    return this.changeListeners.add(listener);
  }

  snapshot(): Promise<DictionaryHistorySnapshot> {
    return this.enqueue(async () => ({
      entries: this.entries.map(toDictionaryHistorySummary),
      durability: this.durability(),
      limit: this.limit
    }));
  }

  get(id: string): Promise<DictionaryHistoryEntry | undefined> {
    return this.enqueue(async () => {
      const entry = this.entries.find((candidate) => candidate.id === id);
      return entry ? copyDictionaryHistoryEntry(entry) : undefined;
    });
  }

  /** Insert newest first, evict past the limit, persist, and emit. Never rejects on a write failure. */
  record(input: DictionaryHistoryRecordInput): Promise<DictionaryHistoryEntry>;
  /**
   * The same, for a lookup the writer can still cancel (Astra F-05). A signal
   * aborted before the insert, or during the write, leaves the history in
   * memory and on disk exactly as it was, an entry the insert would have
   * evicted included, emits nothing, and resolves `undefined`. The last check
   * follows the last await, so no cancel message can land between it and the
   * caller resuming.
   */
  record(input: DictionaryHistoryRecordInput, signal: AbortSignal): Promise<DictionaryHistoryEntry | undefined>;
  record(input: DictionaryHistoryRecordInput, signal?: AbortSignal): Promise<DictionaryHistoryEntry | undefined> {
    return this.enqueue(async () => {
      if (signal?.aborted) {
        return undefined;
      }
      const previous = this.entries;
      const entry = copyDictionaryHistoryEntry({
        id: this.createId(),
        createdAt: this.now().toISOString(),
        request: input.request,
        modelIds: [...input.modelIds],
        toolName: input.toolName,
        result: input.result
      });
      this.entries = [entry, ...previous].slice(0, this.limit);
      await this.persist();
      if (signal?.aborted) {
        this.entries = previous;
        await this.persist();
        return undefined;
      }
      this.changeListeners.emit();
      return copyDictionaryHistoryEntry(entry);
    });
  }

  /** Persist and emit only when an entry was removed. */
  delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const remaining = this.entries.filter((entry) => entry.id !== id);
      if (remaining.length === this.entries.length) {
        return false;
      }
      this.entries = remaining;
      await this.persist();
      this.changeListeners.emit();
      return true;
    });
  }

  clear(): Promise<void> {
    return this.enqueue(async () => {
      this.entries = [];
      await this.persist();
      this.changeListeners.emit();
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      await this.ensureLoaded();
      return operation();
    });
    // Keep the chain alive past a failed operation; the caller still sees it.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private durability(): DictionaryHistoryDurability {
    const location = this.location;
    if (!location) {
      throw new Error(`${LOG_PREFIX} durability read before the history loaded`);
    }
    if (location.kind === 'session') {
      return { kind: 'session', reason: location.reason };
    }
    return this.lastWriteFailed || this.persistenceBlocked
      ? { kind: 'session', reason: 'write-failed' }
      : { kind: 'project', displayPath: DICTIONARY_HISTORY_DISPLAY_PATH };
  }

  private resolveLocation(): DictionaryHistoryLocation {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {
      return { kind: 'session', reason: 'no-workspace' };
    }
    if (folders.length !== 1) {
      return { kind: 'session', reason: 'multi-root' };
    }
    const directory = path.join(folders[0].path, 'prose-minion', 'history');
    return { kind: 'project', directory, filePath: path.join(directory, 'dictionary.json') };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.location) {
      return;
    }
    const location = this.resolveLocation();
    this.location = location;
    if (location.kind === 'session') {
      this.log.appendLine(`${LOG_PREFIX} No single project folder (${location.reason}); history lasts for this session only.`);
      return;
    }

    let text: string;
    try {
      text = decoder.decode(await this.fileSystem.readFile(location.filePath));
    } catch (error) {
      if (isMissingFileSystemPathError(error)) {
        return;
      }
      this.persistenceBlocked = true;
      this.log.appendLine(
        `${LOG_PREFIX} Could not read ${DICTIONARY_HISTORY_DISPLAY_PATH}; it will not be overwritten and history lasts for this session only: ${errorMessage(error)}`
      );
      return;
    }

    const decoded = decodeDictionaryHistoryFile(text);
    if (decoded.kind === 'invalid') {
      await this.setAsideInvalidFile(location, decoded.reason);
      return;
    }
    this.entries = decoded.entries.slice(0, this.limit);
    if (decoded.dropped > 0) {
      this.log.appendLine(`${LOG_PREFIX} Dropped ${decoded.dropped} invalid entr${decoded.dropped === 1 ? 'y' : 'ies'} while loading history.`);
    }
  }

  /** Rename an untrustworthy file aside, once, without overwriting anything, then start empty. */
  private async setAsideInvalidFile(
    location: Extract<DictionaryHistoryLocation, { kind: 'project' }>,
    reason: string
  ): Promise<void> {
    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = path.join(location.directory, `dictionary.invalid-${stamp}.json`);
    try {
      await this.fileSystem.rename(location.filePath, quarantinePath, { overwrite: false });
      this.log.appendLine(
        `${LOG_PREFIX} ${DICTIONARY_HISTORY_DISPLAY_PATH} was unreadable (${reason}); renamed it to ${path.basename(quarantinePath)} and started an empty history.`
      );
    } catch (error) {
      this.persistenceBlocked = true;
      this.log.appendLine(
        `${LOG_PREFIX} ${DICTIONARY_HISTORY_DISPLAY_PATH} was unreadable (${reason}) and could not be set aside; it will not be overwritten and history lasts for this session only: ${errorMessage(error)}`
      );
    }
  }

  /** Temporary sibling, then rename over the target, so a crash never leaves a torn file. */
  private async persist(): Promise<void> {
    const location = this.location;
    if (location?.kind !== 'project' || this.persistenceBlocked) {
      return;
    }
    const bytes = encoder.encode(encodeDictionaryHistoryFile(this.entries));
    const temporaryPath = `${location.filePath}.tmp-${this.now().getTime()}-${++this.temporaryWriteCounter}`;
    try {
      await this.fileSystem.createDirectory(location.directory);
      await this.fileSystem.writeFile(temporaryPath, bytes);
      await this.fileSystem.rename(temporaryPath, location.filePath, { overwrite: true });
      if (this.lastWriteFailed) {
        this.log.appendLine(`${LOG_PREFIX} History saved again after an earlier write failure.`);
      }
      this.lastWriteFailed = false;
    } catch (error) {
      this.lastWriteFailed = true;
      this.log.appendLine(
        `${LOG_PREFIX} Could not save ${DICTIONARY_HISTORY_DISPLAY_PATH}; keeping history for this session: ${errorMessage(error)}`
      );
      try {
        await this.fileSystem.delete(temporaryPath);
      } catch {
        // Best effort only: the write may have failed before the file existed.
      }
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
