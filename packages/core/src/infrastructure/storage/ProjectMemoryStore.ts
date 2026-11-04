/**
 * ProjectMemoryStore — the Workshop's project memories on disk (epic
 * 2026-11-04, Slice 1; the feature note's "Storage and concurrency"). One
 * Markdown file per memory (`ProjectMemoryCodec`, format 1) in
 * `prose-minion/memory/` of the workspace's one folder. Slice 2 builds it
 * once at the composition root, when it has a consumer.
 *
 * - **Where, read live.** One workspace folder keeps memory; none, or
 *   several, is unavailable, and says why (`availability()`, read on every
 *   operation). Memory has no session-only mode: unavailable means off.
 * - **No room state.** The store knows files, not rooms; what reaches a
 *   persona, and the accepted-workspace check, are Slice 2's. Every path is checked with
 *   `isPathWithinRoot` before it is written.
 * - **Ids, never paths.** `read`, `replace` and `delete` take a memory's
 *   id and resolve it through the folder's listing, so no caller (and no
 *   model) ever names a file.
 * - **The Lightbox board store's write discipline, shared, not copied.**
 *   Writes run through one queue, so they never interleave in this store.
 *   - A new memory is staged under a hidden name private to the write (a
 *     random id: another window's store never writes over it), the commit
 *     point (`beforeCommit`) runs with nothing awaited before the rename,
 *     and the rename never overwrites. A name another window took first is
 *     never reported as this write's: a new id is minted and tried again.
 *   - An edit, a pin or an archive is a rewrite in place
 *     under a claim (`commitStoredFileRewrite`): only a file that reads, and
 *     only the bytes that were read, are replaced, so a rewrite never
 *     brings back a memory another window deleted, and one that finds the
 *     file changed under it reads it again.
 *   - A delete claims the file too, and retires every earlier version a
 *     rewrite left beside it (`StoredFileClaims.deleteClaimed`), so nothing
 *     comes back after it. A file a live claim holds is busy.
 * - **Never a file it cannot read.** A file that does not decode is listed
 *   with its reason, and never rewritten or deleted. A write that would not
 *   read back is not written.
 * - **Owed writes.** Every write is owed until it settles; `shutDown`
 *   waits for every owed write, and for any started while it waits, as the
 *   Lightbox library's does (PR #183 F-03).
 * - **Logs** carry memory ids, counts, reasons and error categories
 *   (`fileSystemErrorCategory`: a code, never a message, which can carry a
 *   path), never a title, a summary, a body or a file name (a file name's
 *   slug is the title's).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { FileSystem, LogSink, Workspace } from '@/platform';
import type { ProjectMemory } from '@shared/types/projectMemory';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { encodeProjectMemory, prepareProjectMemoryFile } from '@/infrastructure/storage/ProjectMemoryCodec';
import { StoredFileClaims, deleteStoredFileQuietly, storedFileExists } from '@/infrastructure/storage/StoredFileClaims';
import { fileSystemErrorCategory } from '@/infrastructure/storage/fileSystemErrors';
import { commitStoredFileRewrite, type StoredFileRewritePorts } from '@/infrastructure/storage/StoredFileRewrite';
import {
  PROJECT_MEMORY_CLAIM,
  PROJECT_MEMORY_DISPLAY_PATH,
  decodeProjectMemoryBytes,
  freeProjectMemoryFileName,
  projectMemoryFileName,
  projectMemoryLogName,
  readProjectMemoryFolder,
  type ProjectMemoryFile,
  type ProjectMemoryFolderRead
} from '@/infrastructure/storage/ProjectMemoryFiles';
import type {
  ProjectMemoryAvailability,
  ProjectMemoryCreateResult,
  ProjectMemoryDeleteResult,
  ProjectMemoryDraft,
  ProjectMemoryListing,
  ProjectMemoryRead,
  ProjectMemoryReplaceResult,
  ProjectMemoryStoreOptions,
  ProjectMemoryUpdate,
  ProjectMemoryWriteOptions
} from '@/infrastructure/storage/ProjectMemoryStoreContracts';

export * from '@/infrastructure/storage/ProjectMemoryStoreContracts';

const LOG = '[ProjectMemoryStore]';
/** A listing, a rewrite or a new file whose ground moves under it tries again, this many times at most. */
const ATTEMPTS = 3;
/** Fresh ids minted before a create gives up on finding one the folder does not hold. */
const ID_DRAWS = 16;
const encoder = new TextEncoder();

type Read = Extract<ProjectMemoryFolderRead, { kind: 'read' }>;
type Found =
  | { kind: 'found'; file: ProjectMemoryFile; filePath: string }
  | { kind: 'missing' | 'busy' | 'conflict' | 'unknown' };

export class ProjectMemoryStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly owed = new Set<Promise<unknown>>();
  private readonly now: () => Date;
  private readonly mintStagingId: () => string;
  private readonly mintMemoryId: () => string;
  private readonly claims: StoredFileClaims;
  private readonly rewritePorts: StoredFileRewritePorts;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    options: ProjectMemoryStoreOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.mintStagingId = options.mintStagingId ?? randomUUID;
    this.mintMemoryId = options.mintMemoryId ?? (() => randomBytes(3).toString('hex'));
    this.claims = new StoredFileClaims(fileSystem, log, options.claimNow ?? this.now, {
      claimPattern: PROJECT_MEMORY_CLAIM,
      logPrefix: LOG,
      logName: projectMemoryLogName,
      formatError: fileSystemErrorCategory
    });
    this.rewritePorts = { fileSystem, claims: this.claims, log, logPrefix: LOG, noun: 'memory', mintStagingId: this.mintStagingId };
  }

  /** Where memory is kept now, read live. */
  availability(): ProjectMemoryAvailability {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {
      return { available: false, reason: 'no-workspace' };
    }
    if (folders.length !== 1) {
      return { available: false, reason: 'multi-root' };
    }
    const rootPath = folders[0].path;
    return { available: true, rootPath, directory: path.join(rootPath, 'prose-minion', 'memory'), displayPath: PROJECT_MEMORY_DISPLAY_PATH };
  }

  /** Every memory file, decoded; unreadable ones with their reasons, and ones another window holds now. */
  list(): Promise<ProjectMemoryListing> {
    return this.enqueue(async () => {
      const where = this.availability();
      if (!where.available) {
        return { kind: 'unavailable', reason: where.reason };
      }
      const read = await this.settledRead(where.directory);
      if (read.kind === 'unknown') {
        return { kind: 'unknown' };
      }
      return {
        kind: 'listed',
        memories: read.files.map(({ fileName, memory }) => ({ fileName, memory })),
        unreadable: read.unreadable,
        conflicts: read.conflicts,
        busy: read.held
      };
    });
  }

  /** The memory `id` names, resolved through the listing. */
  read(id: string): Promise<ProjectMemoryRead> {
    return this.enqueue(async () => {
      const where = this.availability();
      if (!where.available) {
        return { kind: 'unavailable', reason: where.reason };
      }
      const found = await this.find(where.directory, id);
      return found.kind === 'found'
        ? { kind: 'memory', entry: { fileName: found.file.fileName, memory: found.file.memory } }
        : { kind: found.kind };
    });
  }

  /** Save a new memory: its id and times minted here, staged, then committed by a rename that never overwrites. */
  create(draft: ProjectMemoryDraft, options: ProjectMemoryWriteOptions = {}): Promise<ProjectMemoryCreateResult> {
    return this.owe(this.enqueue(async () => {
      const where = this.availability();
      if (!where.available) {
        return { kind: 'unavailable', reason: where.reason };
      }
      const read = await this.settledRead(where.directory);
      if (read.kind === 'unknown') {
        this.log.appendLine(`${LOG} The memory folder could not be read; nothing was saved.`);
        return { kind: 'failed' };
      }
      const taken = new Set([...read.files.map((file) => file.memory.id), ...read.held.flatMap((held) => (held.id ? [held.id] : [])), ...read.conflicts.map((conflict) => conflict.id)]);
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const id = this.freshId(taken);
        if (!id) {
          break;
        }
        taken.add(id);
        const stamp = this.now().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const memory = fromDraft(draft, id, stamp);
        const check = prepareProjectMemoryFile(memory);
        if (check.kind === 'invalid') {
          this.log.appendLine(`${LOG} A new memory would not read back as written (${check.reason}${check.key ? ` at ${check.key}` : ''}); it was not saved.`);
          return check.key ? { kind: 'invalid', reason: check.reason, key: check.key } : { kind: 'invalid', reason: check.reason };
        }
        const fileName = projectMemoryFileName(memory.title, id);
        const outcome = await this.writeNew(where.directory, fileName, encoder.encode(check.text), options);
        if (outcome === 'taken') {
          continue;
        }
        if (outcome === 'withdrawn' || outcome === 'failed') {
          return outcome === 'withdrawn' ? { kind: 'withdrawn' } : { kind: 'failed' };
        }
        this.log.appendLine(`${LOG} Saved ${id}.`);
        return { kind: 'created', entry: { fileName, memory: check.memory } };
      }
      this.log.appendLine(`${LOG} No free name was found for a new memory; nothing was saved.`);
      return { kind: 'failed' };
    }));
  }

  /**
   * Rewrite the memory `id` names in place (an edit, a pin, an archive; a
   * supersession is a new memory naming the old, never a rewrite of it): `update` gets the memory as it reads now and returns it
   * changed, or undefined to leave it. Its id and creation time cannot
   * change; its `updated` time is the caller's to set.
   */
  replace(id: string, update: ProjectMemoryUpdate, options: ProjectMemoryWriteOptions = {}): Promise<ProjectMemoryReplaceResult> {
    return this.owe(this.enqueue(async () => {
      const where = this.availability();
      if (!where.available) {
        return { kind: 'unavailable', reason: where.reason };
      }
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const found = await this.find(where.directory, id);
        if (found.kind !== 'found') {
          return notFound(found.kind);
        }
        const { file, filePath } = found;
        const entry = { fileName: file.fileName, memory: file.memory };
        const next = update(file.memory);
        if (!next) {
          return { kind: 'unchanged', entry };
        }
        if (next.id !== file.memory.id || next.created !== file.memory.created) {
          return { kind: 'invalid', reason: 'identity-changed' };
        }
        const check = prepareProjectMemoryFile(next);
        if (check.kind === 'invalid') {
          this.log.appendLine(`${LOG} A rewrite of ${id} would not read back as written (${check.reason}${check.key ? ` at ${check.key}` : ''}); it was not written.`);
          return check.key ? { kind: 'invalid', reason: check.reason, key: check.key } : { kind: 'invalid', reason: check.reason };
        }
        const text = check.text;
        if (text === encodeProjectMemory(file.memory)) {
          return { kind: 'unchanged', entry };
        }
        const folder = path.dirname(filePath);
        const outcome = await commitStoredFileRewrite(this.rewritePorts, {
          filePath,
          label: id,
          read: file.bytes,
          written: encoder.encode(text),
          beforeCommit: options.beforeCommit,
          onCommitted: () => undefined,
          fallbackPath: async () => path.join(folder, await freeProjectMemoryFileName(this.fileSystem, folder, file.fileName))
        });
        switch (outcome.kind) {
          case 'committed':
            return { kind: 'replaced', entry: { fileName: file.fileName, memory: check.memory } };
          case 'again':
            continue;
          case 'gone':
            if (outcome.state === 'present' || outcome.state === 'absent') {
              // Put back, or moved: look for it again by its id.
              continue;
            }
            return outcome.state === 'busy' ? { kind: 'busy' } : { kind: 'failed' };
          case 'withdrawn':
            return { kind: 'withdrawn' };
          case 'failed':
            return { kind: 'failed' };
        }
      }
      this.log.appendLine(`${LOG} ${id} kept changing while it was rewritten; it was left as another writer left it.`);
      return { kind: 'failed' };
    }));
  }

  /**
   * Delete the memory `id` names, under a claim; a file that does not read,
   * or conflicts, is never deleted, and neither is one that, once claimed,
   * no longer reads as this memory (`changed`: put back).
   */
  delete(id: string): Promise<ProjectMemoryDeleteResult> {
    return this.owe(this.enqueue(async () => {
      const where = this.availability();
      if (!where.available) {
        return { kind: 'unavailable', reason: where.reason };
      }
      const found = await this.find(where.directory, id);
      if (found.kind !== 'found') {
        return notFound(found.kind);
      }
      // The claimed bytes must still be this memory, readable (PR #194 F-02): never another file put at its path.
      const deleted = await this.claims.deleteClaimed(found.filePath, id, this.mintStagingId(), (claimed) => {
        const decoded = decodeProjectMemoryBytes(claimed);
        return decoded.kind === 'memory' && decoded.memory.id === id;
      });
      if (deleted === 'deleted') {
        this.log.appendLine(`${LOG} Deleted ${id}.`);
      }
      return { kind: deleted };
    }));
  }

  /** Settle every write owed, and any started while it waits (deactivation, PR #183 F-03). */
  async shutDown(): Promise<void> {
    while (this.owed.size > 0) {
      await Promise.allSettled([...this.owed]);
    }
  }

  /** The file holding `id`, found through the folder's listing. */
  private async find(directory: string, id: string): Promise<Found> {
    const read = await this.settledRead(directory);
    if (read.kind === 'unknown') {
      return { kind: 'unknown' };
    }
    const file = read.files.find((candidate) => candidate.memory.id === id);
    if (file) {
      const filePath = path.join(directory, file.fileName);
      return isPathWithinRoot(directory, filePath) ? { kind: 'found', file, filePath } : { kind: 'missing' };
    }
    if (read.conflicts.some((conflict) => conflict.id === id)) {
      return { kind: 'conflict' };
    }
    return { kind: read.held.some((held) => held.id === id) ? 'busy' : 'missing' };
  }

  /**
   * The folder read, with its claims settled (a memory left mid-rewrite goes
   * back, a rewrite's leftover goes) and read again when that changed
   * anything, or when a file moved while it was read.
   */
  private async settledRead(directory: string): Promise<Read | { kind: 'unknown' }> {
    let read = await readProjectMemoryFolder(this.fileSystem, directory);
    for (let attempt = 1; attempt < ATTEMPTS && read.kind === 'read'; attempt++) {
      const settled = read.claimed && await this.claims.settleFolder(directory);
      if (!settled && !read.moved) {
        break;
      }
      read = await readProjectMemoryFolder(this.fileSystem, directory);
    }
    if (read.kind === 'unknown') {
      this.log.appendLine(`${LOG} The memory folder could not be read.`);
    }
    return read;
  }

  /** Stage `bytes` and commit them as `fileName`, never over anything: `taken` when another file has the name. */
  private async writeNew(
    directory: string,
    fileName: string,
    bytes: Uint8Array,
    options: ProjectMemoryWriteOptions
  ): Promise<'saved' | 'taken' | 'withdrawn' | 'failed'> {
    const finalPath = path.join(directory, fileName);
    const temporaryPath = path.join(directory, `.${fileName}.tmp-${this.mintStagingId()}`);
    if (!isPathWithinRoot(directory, finalPath) || !isPathWithinRoot(directory, temporaryPath)) {
      this.log.appendLine(`${LOG} Refused to write outside ${PROJECT_MEMORY_DISPLAY_PATH}.`);
      return 'failed';
    }
    try {
      await this.fileSystem.createDirectory(directory);
      await this.fileSystem.writeFile(temporaryPath, bytes);
    } catch (error) {
      this.log.appendLine(`${LOG} Could not stage a new memory: ${fileSystemErrorCategory(error)}`);
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      return 'failed';
    }
    // The commit point: nothing is awaited between it and the rename that commits.
    if (options.beforeCommit && !options.beforeCommit()) {
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      return 'withdrawn';
    }
    try {
      await this.fileSystem.rename(temporaryPath, finalPath, { overwrite: false });
      return 'saved';
    } catch (error) {
      const taken = await storedFileExists(this.fileSystem, finalPath);
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      if (taken) {
        return 'taken';
      }
      this.log.appendLine(`${LOG} Could not save a new memory: ${fileSystemErrorCategory(error)}`);
      return 'failed';
    }
  }

  /** An id no file of the folder holds, as far as this store knows; undefined after `ID_DRAWS` draws. */
  private freshId(taken: ReadonlySet<string>): string | undefined {
    for (let draw = 0; draw < ID_DRAWS; draw++) {
      const id = `mem-${this.mintMemoryId()}`;
      if (!taken.has(id)) {
        return id;
      }
    }
    return undefined;
  }

  private owe<T>(write: Promise<T>): Promise<T> {
    this.owed.add(write);
    const settle = () => {
      this.owed.delete(write);
    };
    write.then(settle, settle);
    return write;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/** A memory not found, as a write answers it: a folder that could not be read failed the write. */
function notFound(kind: Exclude<Found['kind'], 'found'>): { kind: 'missing' | 'busy' | 'conflict' } | { kind: 'failed' } {
  return kind === 'unknown' ? { kind: 'failed' } : { kind };
}

/** The memory a draft makes, field by field, so nothing a caller added rides along. */
function fromDraft(draft: ProjectMemoryDraft, id: string, stamp: string): ProjectMemory {
  return {
    id,
    title: draft.title,
    kind: draft.kind,
    summary: draft.summary,
    status: draft.status,
    pinned: draft.pinned,
    created: stamp,
    updated: stamp,
    origin: draft.origin,
    ...(draft.proposedBy !== undefined ? { proposedBy: draft.proposedBy } : {}),
    ...(draft.sourceSession !== undefined ? { sourceSession: draft.sourceSession } : {}),
    sourceTurns: [...draft.sourceTurns],
    supersedes: [...draft.supersedes],
    body: draft.body
  };
}
