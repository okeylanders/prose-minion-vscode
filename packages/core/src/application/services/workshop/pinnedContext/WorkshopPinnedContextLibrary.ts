/**
 * WorkshopPinnedContextLibrary: the one owner of pinned context above the
 * store (ADR 2026-11-04 D3, D5, D8; epic Slice 2b). Built only in
 * `extension.ts`, it joins `CoreServices`; no handler constructs it.
 *
 * - `describe()` is the list as the tab (Slice 3) draws it: every entry
 *   resolved now, in the catalog (with its group) or a workspace file, with
 *   its words and its state, and the list's own state in ADR D8's words.
 * - `readForSeed()` is what a room seed attaches: every pinned file read
 *   through the intake service's existing doors
 *   (`WorkshopPinnedContextFileReader`), with the files left out and why.
 * - **A write belongs to the workspace it was asked in** (D5; PR #202 F01).
 *   `askLiveRoom()` captures the accepted room (the coordinator's live
 *   session and the list's file) when the writer asks; its `still` is the
 *   `beforeCommit` every write passes the store (Slice 3's writes). A seed
 *   captures its sibling, `askSeedWorkspace()`, which also accepts the
 *   first room, before the coordinator has settled a live session.
 *
 * Logs carry counts and categories, never a path, a name or a file's text.
 */

import type { FileSystem, LogSink } from '@/platform';
import type { WorkshopSessionRecallScope } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import {
  askedProjectMemoryWorkspace,
  type ProjectMemoryWorkspaceIdentity
} from '@/application/services/workshop/memory/ProjectMemoryWorkspaceIdentity';
import type {
  WorkshopPinnedContextRead,
  WorkshopPinnedContextStore,
  WorkshopPinnedContextUnavailableReason
} from '@/infrastructure/storage/WorkshopPinnedContextStore';
import {
  WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
  type WorkshopPinnedContextPathPlatform,
  type WorkshopPinnedContextRefusal
} from '@shared/types/workshopPinnedContext';
import { fileSystemErrorCategory } from '@/infrastructure/storage/fileSystemErrors';
import {
  WorkshopPinnedContextFileReader,
  type WorkshopPinnedContextIntakePort,
  type WorkshopPinnedFileFault,
  type WorkshopPinnedFileRead,
  type WorkshopPinnedFileSource
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import {
  workshopPinnedFileFaultWords,
  workshopPinnedListRefusalWords,
  workshopPinnedListUnavailableWords
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextWords';

const LOG = '[WorkshopPinnedContext]';

/** The store's reads and its live availability, nothing else. */
export type WorkshopPinnedContextStorePort = Pick<WorkshopPinnedContextStore, 'availability' | 'read'>;

/** The accepted workspace, as the coordinator reads it now. */
export type WorkshopPinnedContextScopePort = () => WorkshopSessionRecallScope;

/** The room the first start seeds: no live session is settled yet. */
const FIRST_ROOM = 'first-room';

/** One pinned entry, resolved now, as the tab draws its row. */
export interface WorkshopPinnedContextRow {
  readonly path: string;
  readonly label: string;
  /** Unknown for a file that is gone. */
  readonly source?: WorkshopPinnedFileSource;
  /** `ready`, or `head-sliced` (attached as its first `words` of `totalWords`), `missing`, `unreadable`. */
  readonly state: 'ready' | 'head-sliced' | 'missing' | 'unreadable';
  /** The words an attach would bring; 0 when it brings none. */
  readonly words: number;
  readonly totalWords?: number;
  readonly fault?: WorkshopPinnedFileFault;
  /** The state in the tab's words: "Not found", "Can't read: …", "Attached as its first …". */
  readonly stateWords?: string;
}

/** The list as the tab draws it. */
export type WorkshopPinnedContextDescription =
  | { readonly state: 'listed'; readonly revision: string; readonly rows: readonly WorkshopPinnedContextRow[]; readonly words: number }
  | { readonly state: 'unreadable'; readonly revision: string; readonly reason: WorkshopPinnedContextRefusal; readonly entry?: number; readonly words: string }
  | { readonly state: 'unavailable'; readonly reason: WorkshopPinnedContextUnavailableReason | 'workspace-changed'; readonly words: string }
  | { readonly state: 'busy' | 'io'; readonly words: string };

/** What a seed attaches: every pinned file, in pinned order, or why the list gave none. */
export type WorkshopPinnedContextSeedRead =
  | { readonly state: 'listed'; readonly files: readonly WorkshopPinnedFileRead[] }
  /** Nothing is pinned, or there is no single folder (ADR D2: never seed then). */
  | { readonly state: 'nothing' }
  /** The list file is there and cannot be read now, as a category for the log. */
  | { readonly state: 'list-unreadable'; readonly category: 'unreadable' | 'busy' | 'io' | 'failed' }
  /**
   * The project folder changed while the seed read (PR #208 F01): the list or
   * a file would have come from another root. Nothing it read is installed.
   */
  | { readonly state: 'workspace-changed' };

/** The workspace's one folder and its list's file, captured together. */
export interface WorkshopPinnedContextWhere {
  readonly rootPath: string;
  readonly filePath: string;
}

export interface WorkshopPinnedContextAsk {
  /** Where the ask was made, when there was an accepted workspace to ask in. */
  readonly where: WorkshopPinnedContextWhere | undefined;
  /** False when there was no accepted workspace to ask in. */
  readonly accepted: boolean;
  /** Whether that workspace is still the accepted one: a write's `beforeCommit`, a seed's install check. */
  readonly still: () => boolean;
}

export interface WorkshopPinnedContextLibraryOptions {
  platform: WorkshopPinnedContextPathPlatform;
}

export class WorkshopPinnedContextLibrary {
  private readonly reader: WorkshopPinnedContextFileReader;

  constructor(
    private readonly store: WorkshopPinnedContextStorePort,
    intake: WorkshopPinnedContextIntakePort,
    fileSystem: Pick<FileSystem, 'stat'>,
    private readonly scope: WorkshopPinnedContextScopePort,
    private readonly outputChannel: LogSink,
    options: WorkshopPinnedContextLibraryOptions
  ) {
    this.reader = new WorkshopPinnedContextFileReader(intake, fileSystem, options.platform);
  }

  /**
   * The accepted room a write is asked in: the coordinator's live session and
   * the list's file, captured now. Its `still` is the write's `beforeCommit`.
   */
  askLiveRoom(): WorkshopPinnedContextAsk {
    return this.ask(() => {
      const scope = this.scope();
      return scope.available ? scope.liveSessionId : undefined;
    });
  }

  /**
   * The workspace a seed is prepared in. As `askLiveRoom`, but the first room
   * is prepared while the coordinator is still settling it (`not-ready`), so
   * that counts as its own room, which only the first start can be in.
   */
  askSeedWorkspace(): WorkshopPinnedContextAsk {
    return this.ask(() => {
      const scope = this.scope();
      return scope.available ? scope.liveSessionId : scope.reason === 'not-ready' ? FIRST_ROOM : undefined;
    });
  }

  /** The list, every entry resolved now, in the tab's words (ADR D8; Slice 0d). */
  async describe(): Promise<WorkshopPinnedContextDescription> {
    // One root for the whole description: the list and every file under it (PR #208 F01).
    const where = this.store.availability();
    if (!where.available) {
      return { state: 'unavailable', reason: where.reason, words: workshopPinnedListUnavailableWords(where.reason) };
    }
    const read = await this.store.read({ filePath: where.filePath });
    switch (read.state) {
      case 'absent':
        return { state: 'listed', revision: read.revision, rows: [], words: 0 };
      case 'ok': {
        const { reads } = await this.reader.readAll(where.rootPath, read.list.files);
        if (reads.some(movedUnderTheRead)) {
          this.log('Description withdrawn: the workspace changed while pinned files were read');
          return { state: 'unavailable', reason: 'workspace-changed', words: workshopPinnedListUnavailableWords('workspace-changed') };
        }
        const rows = reads.map(rowOf);
        return { state: 'listed', revision: read.revision, rows, words: rows.reduce((total, row) => total + row.words, 0) };
      }
      case 'unreadable':
        return {
          state: 'unreadable',
          revision: read.revision,
          reason: read.reason,
          ...(read.entry !== undefined ? { entry: read.entry } : {}),
          words: workshopPinnedListRefusalWords(read.reason, read.entry, WORKSHOP_PINNED_CONTEXT_FILE_BYTES)
        };
      case 'unavailable':
        return { state: 'unavailable', reason: read.reason, words: workshopPinnedListUnavailableWords(read.reason) };
      case 'busy':
        return { state: 'busy', words: 'Pinned context is being changed in another window. Try again in a moment.' };
      case 'io':
        return { state: 'io', words: 'pinned-context.json couldn’t be read. Try again, or check the project folder.' };
    }
  }

  /**
   * Every pinned file read for a seed, through the intake doors, in pinned
   * order, from `where` only: the root and list file `askSeedWorkspace`
   * captured (PR #208 F01). Never rejects.
   */
  async readForSeed(where: WorkshopPinnedContextWhere): Promise<WorkshopPinnedContextSeedRead> {
    let read: WorkshopPinnedContextRead;
    try {
      read = await this.store.read({ filePath: where.filePath });
    } catch (error) {
      this.log(`List read failed for a seed (${fileSystemErrorCategory(error)})`);
      return { state: 'list-unreadable', category: 'failed' };
    }
    switch (read.state) {
      case 'absent':
        return { state: 'nothing' };
      case 'unavailable':
        if (read.reason === 'workspace-changed') {
          this.log('Seed read withdrawn: the workspace changed before the list was read');
          return { state: 'workspace-changed' };
        }
        return { state: 'nothing' };
      case 'unreadable':
        this.log(`List unreadable for a seed (${read.reason})`);
        return { state: 'list-unreadable', category: 'unreadable' };
      case 'busy':
      case 'io':
        this.log(`List not read for a seed (${read.state})`);
        return { state: 'list-unreadable', category: read.state };
      case 'ok':
        break;
    }
    if (read.list.files.length === 0) {
      return { state: 'nothing' };
    }
    try {
      const { reads, catalogUnreadable } = await this.reader.readAll(where.rootPath, read.list.files);
      if (catalogUnreadable) {
        this.log('Catalog unreadable for a seed; pinned files read as workspace files');
      }
      const moved = reads.filter(movedUnderTheRead).length;
      if (moved > 0) {
        this.log(`Seed read withdrawn: the workspace changed while pinned files were read (files=${moved})`);
        return { state: 'workspace-changed' };
      }
      return { state: 'listed', files: reads };
    } catch (error) {
      this.log(`Pinned files not read for a seed (${fileSystemErrorCategory(error)})`);
      return { state: 'list-unreadable', category: 'failed' };
    }
  }

  /**
   * The workspace now, captured once: its root and list file, and the room's
   * identity from them. `still` reads the room and the folder live each time.
   */
  private ask(roomNow: () => string | undefined): WorkshopPinnedContextAsk {
    const availability = this.store.availability();
    const where = availability.available ? { rootPath: availability.rootPath, filePath: availability.filePath } : undefined;
    const { asked, still } = askedProjectMemoryWorkspace(() => this.identity(roomNow()));
    const accepted = where !== undefined && asked !== undefined && asked.directory === where.filePath;
    return { where: accepted ? where : undefined, accepted, still };
  }

  private identity(room: string | undefined): ProjectMemoryWorkspaceIdentity | undefined {
    if (room === undefined) {
      return undefined;
    }
    const where = this.store.availability();
    return where.available ? { room, directory: where.filePath } : undefined;
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

/** A read that would have come from another root than the one it was asked for. */
function movedUnderTheRead(read: WorkshopPinnedFileRead): boolean {
  return read.state === 'unreadable' && read.fault === 'workspace-changed';
}

function rowOf(read: WorkshopPinnedFileRead): WorkshopPinnedContextRow {
  const base = { path: read.entry.path, label: read.label };
  switch (read.state) {
    case 'missing':
      return { ...base, state: 'missing', words: 0, stateWords: 'Not found' };
    case 'unreadable':
      return {
        ...base,
        source: read.source,
        state: 'unreadable',
        words: 0,
        fault: read.fault,
        stateWords: `Can’t read: ${workshopPinnedFileFaultWords(read.fault)}`
      };
    case 'ready': {
      const truncation = read.input.truncation;
      if (!truncation) {
        return { ...base, source: read.source, state: 'ready', words: read.input.words };
      }
      return {
        ...base,
        source: read.source,
        state: 'head-sliced',
        words: read.input.words,
        totalWords: truncation.totalWords,
        stateWords: `Attached as its first ${truncation.keptWords.toLocaleString('en-US')} of ` +
          `${truncation.totalWords.toLocaleString('en-US')} words`
      };
    }
  }
}

