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
  WorkshopPinnedContextStore
} from '@/infrastructure/storage/WorkshopPinnedContextStore';
import {
  WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
  type WorkshopPinnedContextEntry,
  type WorkshopPinnedContextPathPlatform
} from '@shared/types/workshopPinnedContext';
import { fileSystemErrorCategory } from '@/infrastructure/storage/fileSystemErrors';
import {
  WorkshopPinnedContextFileReader,
  type WorkshopPinnedContextIntakePort,
  type WorkshopPinnedFileRead
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import {
  WORKSHOP_PINNED_WORDS,
  workshopPinnedFileFaultWords,
  workshopPinnedListRefusalWords,
  workshopPinnedListUnavailableWords
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextWords';
import { WorkshopPinnedContextWrites } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextWrites';
import type {
  WorkshopPinnedContextAsk,
  WorkshopPinnedContextDescription,
  WorkshopPinnedContextOpenTarget,
  WorkshopPinnedContextRow,
  WorkshopPinnedContextSeedRead,
  WorkshopPinnedContextTabPort,
  WorkshopPinnedContextWriteResult
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';
import type { ConfiguredResourceRef } from '@messages';

const LOG = '[WorkshopPinnedContext]';

/** The store's reads, its live availability, and the tab's writes (Slice 3). */
export type WorkshopPinnedContextStorePort = Pick<WorkshopPinnedContextStore, 'availability' | 'read' | 'update'>;

/** The accepted workspace, as the coordinator reads it now. */
export type WorkshopPinnedContextScopePort = () => WorkshopSessionRecallScope;

/** The room the first start seeds: no live session is settled yet. */
const FIRST_ROOM = 'first-room';

export type {
  WorkshopPinnedContextAsk,
  WorkshopPinnedContextDescription,
  WorkshopPinnedContextRow,
  WorkshopPinnedContextSeedRead
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';

export interface WorkshopPinnedContextLibraryOptions {
  platform: WorkshopPinnedContextPathPlatform;
}

export class WorkshopPinnedContextLibrary implements WorkshopPinnedContextTabPort {
  readonly platform: WorkshopPinnedContextPathPlatform;
  private readonly reader: WorkshopPinnedContextFileReader;
  private readonly writes: WorkshopPinnedContextWrites;

  constructor(
    private readonly store: WorkshopPinnedContextStorePort,
    intake: WorkshopPinnedContextIntakePort,
    fileSystem: Pick<FileSystem, 'stat'>,
    private readonly scope: WorkshopPinnedContextScopePort,
    private readonly outputChannel: LogSink,
    options: WorkshopPinnedContextLibraryOptions
  ) {
    this.platform = options.platform;
    this.reader = new WorkshopPinnedContextFileReader(intake, fileSystem, options.platform);
    this.writes = new WorkshopPinnedContextWrites(store, intake, this.reader, options.platform, outputChannel);
  }

  /*
   * The tab's changes (Slice 3). Each asks for the live room first, before
   * anything awaits, and passes its `still` to the store as `beforeCommit`.
   */

  pinResources(revision: string, items: readonly ConfiguredResourceRef[]): Promise<WorkshopPinnedContextWriteResult> {
    return this.writes.pinResources(this.askLiveRoom(), revision, items);
  }

  pinPaths(revision: string, entries: readonly WorkshopPinnedContextEntry[]): Promise<WorkshopPinnedContextWriteResult> {
    return this.writes.pinPaths(this.askLiveRoom(), revision, entries);
  }

  pinPickedFile(
    revision: string,
    pick: (projectFolder: string) => Promise<string | undefined>
  ): Promise<WorkshopPinnedContextWriteResult | { readonly kind: 'cancelled' }> {
    return this.writes.pinPicked(this.askLiveRoom(), revision, pick);
  }

  unpin(revision: string, entryPath: string): Promise<WorkshopPinnedContextWriteResult> {
    return this.writes.unpin(this.askLiveRoom(), revision, entryPath);
  }

  move(revision: string, entryPath: string, direction: 'up' | 'down'): Promise<WorkshopPinnedContextWriteResult> {
    return this.writes.move(this.askLiveRoom(), revision, entryPath, direction);
  }

  openTarget(entryPath?: string): Promise<WorkshopPinnedContextOpenTarget> {
    return this.writes.openTarget(entryPath);
  }

  /**
   * The accepted room a write is asked in: the coordinator's live session and
   * the list's file, captured now. Its `still` is the write's `beforeCommit`.
   */
  askLiveRoom(): WorkshopPinnedContextAsk {
    return this.ask(() => {
      const scope = this.scope();
      return scope.available ? this.identity(scope.liveSessionId) : undefined;
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
      if (scope.available) {
        return this.identity(scope.liveSessionId);
      }
      return scope.reason === 'not-ready' ? this.identity(FIRST_ROOM) : undefined;
    });
  }

  /** The list, every entry resolved now, in the tab's words (ADR D8; Slice 0d). */
  async describe(): Promise<WorkshopPinnedContextDescription> {
    const read = await this.store.read();
    switch (read.state) {
      case 'absent':
        return { state: 'listed', revision: read.revision, rows: [], words: 0, absent: true };
      case 'ok': {
        const where = this.store.availability();
        if (!where.available) {
          return { state: 'unavailable', reason: where.reason, words: workshopPinnedListUnavailableWords(where.reason) };
        }
        const { reads } = await this.reader.readAll(where.rootPath, read.list.files);
        const rows = reads.map(rowOf);
        return { state: 'listed', revision: read.revision, rows, words: rows.reduce((total, row) => total + row.words, 0), absent: false };
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
        return { state: 'busy', words: WORKSHOP_PINNED_WORDS.busy };
      case 'io':
        return { state: 'io', words: WORKSHOP_PINNED_WORDS.io };
    }
  }

  /** Every pinned file read for a seed, through the intake doors, in pinned order. Never rejects. */
  async readForSeed(): Promise<WorkshopPinnedContextSeedRead> {
    let read: WorkshopPinnedContextRead;
    try {
      read = await this.store.read();
    } catch (error) {
      this.log(`List read failed for a seed (${fileSystemErrorCategory(error)})`);
      return { state: 'list-unreadable', category: 'failed' };
    }
    switch (read.state) {
      case 'absent':
      case 'unavailable':
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
    const where = this.store.availability();
    if (!where.available) {
      return { state: 'nothing' };
    }
    try {
      const { reads, catalogUnreadable } = await this.reader.readAll(where.rootPath, read.list.files);
      if (catalogUnreadable) {
        this.log('Catalog unreadable for a seed; pinned files read as workspace files');
      }
      return { state: 'listed', files: reads };
    } catch (error) {
      this.log(`Pinned files not read for a seed (${fileSystemErrorCategory(error)})`);
      return { state: 'list-unreadable', category: 'failed' };
    }
  }

  private ask(current: () => ProjectMemoryWorkspaceIdentity | undefined): WorkshopPinnedContextAsk {
    const { asked, still } = askedProjectMemoryWorkspace(current);
    return { accepted: asked !== undefined, still };
  }

  private identity(room: string): ProjectMemoryWorkspaceIdentity | undefined {
    const where = this.store.availability();
    return where.available ? { room, directory: where.filePath } : undefined;
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
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

