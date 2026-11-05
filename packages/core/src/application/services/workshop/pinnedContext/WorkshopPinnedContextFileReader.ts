/**
 * Reads pinned files through the intake service's existing doors (ADR
 * 2026-11-04 D3), never a reader of its own:
 *
 * - a path in the configured catalog is read through
 *   `WorkshopContextIntakeCatalog.load` and keeps its catalog key, as
 *   Choose from project does;
 * - any other path is read as a workspace file: re-authorized through
 *   `authorizeExcerptReread` (contained in the folder, no symbolic link) and
 *   read through `loadFile`, as a context refresh does.
 *
 * **Only the captured root's own files** (PR #208 F01). Every read is of a
 * file the root the caller captured names itself: a catalog row listed under
 * that root, or the exact path built from it. That is checked before
 * anything is read. A file that would come from elsewhere, including from a
 * root nested inside it, is `workspace-changed`, never read.
 *
 * Both use `CONTEXT_ATTACHMENTS`' bounds: `fileBytes`, and the head slice at
 * the context budget's words. The only other thing it asks the host is a
 * `stat`, so a file that is gone reads as `missing` rather than as a failed
 * read. Nothing here throws: any failure is an `unreadable` entry.
 *
 * Nothing it returns for logs carries a path or a name; the labels are the
 * writer's, for the result line and the tab.
 */

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FileSystem } from '@/platform';
import type { ContextPathGroup } from '@shared/types/context';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { WorkshopContextAttachmentInput } from '@/application/services/workshop/WorkshopSessionRecords';
import type {
  WorkshopContextIntakeCatalog,
  WorkshopContextIntakeService,
  WorkshopIntakeRefusal
} from '@/application/services/workshop/WorkshopContextIntakeService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  workshopPinnedContextPathKey,
  type WorkshopPinnedContextEntry,
  type WorkshopPinnedContextPathPlatform
} from '@shared/types/workshopPinnedContext';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

/** The intake service's doors the reader uses, and no others. */
export type WorkshopPinnedContextIntakePort = Pick<
  WorkshopContextIntakeService,
  'openCatalog' | 'authorizeExcerptReread' | 'loadFile'
>;

/** Where a pinned file was read from: the catalog (with its group), or the workspace. */
export type WorkshopPinnedFileSource =
  | { readonly kind: 'catalog'; readonly group: ContextPathGroup }
  | { readonly kind: 'workspace' };

/**
 * Why a pinned file that exists could not be read, as a category:
 * - `not-a-file`: the path names a folder or something else;
 * - `too-large`: more bytes than `CONTEXT_ATTACHMENTS.fileBytes`;
 * - `empty`: nothing but whitespace;
 * - `refused`: outside the project, or reached through a symbolic link;
 * - `read-failed`: the read itself failed;
 * - `ambiguous`: no catalog row names the path exactly, no file is there by
 *   its exact spelling, and several distinct rows name it by its normalized
 *   key, so none is chosen (PR #208 F03, PR #210 F01);
 * - `workspace-changed`: the file would have come from outside the root the
 *   read was asked for, so it was not read (PR #208 F01). A caller installs
 *   nothing from a read that holds one.
 */
export type WorkshopPinnedFileFault =
  | 'not-a-file' | 'too-large' | 'empty' | 'refused' | 'read-failed' | 'ambiguous' | 'workspace-changed';

interface WorkshopPinnedFileIdentity {
  readonly entry: WorkshopPinnedContextEntry;
  readonly label: string;
  /**
   * The file URIs this entry names under the captured root, whatever the read
   * found (PR #208 F04): the path the entry spells, and the catalog row it
   * resolved to when that differs. A carried copy is recognized by these even
   * when its read failed. Never a URI outside the root.
   */
  readonly sourceUris: readonly string[];
}

/** One pinned file as read now, in pinned order. */
export type WorkshopPinnedFileRead =
  | (WorkshopPinnedFileIdentity & {
      readonly state: 'ready';
      readonly source: WorkshopPinnedFileSource;
      /** What an attach adds: `origin: 'writer'`, head-sliced at the budget. */
      readonly input: WorkshopContextAttachmentInput;
    })
  | (WorkshopPinnedFileIdentity & { readonly state: 'missing' })
  | (WorkshopPinnedFileIdentity & {
      readonly state: 'unreadable';
      readonly source: WorkshopPinnedFileSource;
      readonly fault: WorkshopPinnedFileFault;
    });

const BOUNDS = {
  maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
  maxWords: PROMPT_BUDGETS.contextAttachments.words
} as const;

/** The pill's label for a pinned path: its base name, as the attach paths name files. */
export function workshopPinnedFileLabel(entryPath: string): string {
  return entryPath.split('/').filter(Boolean).pop() ?? entryPath;
}

function intakeFault(reason: WorkshopIntakeRefusal['reason']): WorkshopPinnedFileFault {
  switch (reason) {
    case 'not-file':
      return 'not-a-file';
    case 'too-large':
      return 'too-large';
    case 'empty':
      return 'empty';
    case 'inspect-failed':
    case 'read-failed':
    case 'decode-failed':
      return 'read-failed';
  }
}

/**
 * Whether a catalog row was listed under `rootPath` itself: its `path` is
 * relative to the workspace folder it was listed under, so it is this root's
 * row only when the root and that path give its absolute path back. A row
 * listed under another root fails, even one nested inside this root, whose
 * absolute path lies under it (PR #208 F01, the coordinator's review).
 */
export function workshopPinnedListedUnderRoot(rootPath: string, row: ContextResourceSummary): boolean {
  return path.relative(rootPath, row.absolutePath).split(path.sep).join('/') === row.path;
}

/**
 * The one source an entry names under a captured root (PR #210 F01, F05),
 * decided by one rule, in this order:
 *
 * 1. the catalog row whose path is the entry's exactly;
 * 2. else the exact file the entry spells under the root, when it exists
 *    (read through the workspace door), so a file chosen by its own path is
 *    never traded for a neighbour spelled the same way after normalization;
 * 3. only when that exact file is absent, the catalog row the entry names by
 *    its normalized key, when exactly one distinct row does (PR #208 F03).
 *
 * A catalog row is the root's only when it was listed under that root itself
 * (`workshopPinnedListedUnderRoot`; PR #208 F01). Describe, seed, Attach
 * missing, pin validation and Open all resolve through this.
 */
export type WorkshopPinnedSourceResolution =
  | { readonly kind: 'catalog'; readonly summary: ContextResourceSummary; readonly fsPath: string }
  | { readonly kind: 'workspace'; readonly fsPath: string }
  | { readonly kind: 'missing' }
  /** No file is chosen, or the one there could not even be looked at; `fsPath` is set when a file exists there to open for repair. */
  | {
      readonly kind: 'unreadable';
      readonly fault: 'ambiguous' | 'workspace-changed' | 'read-failed';
      readonly group?: ContextPathGroup;
      readonly fsPath?: string;
    };

export class WorkshopPinnedContextFileReader {
  constructor(
    private readonly intake: WorkshopPinnedContextIntakePort,
    private readonly fileSystem: Pick<FileSystem, 'stat'>,
    private readonly platform: WorkshopPinnedContextPathPlatform
  ) {}

  /**
   * Read every entry, in order, against one fresh catalog, from under
   * `rootPath` only: the root the caller captured, never the live one
   * (PR #208 F01). A catalog that cannot be opened reads every entry as a
   * workspace file; the second return value says so, for the log.
   */
  async readAll(
    rootPath: string,
    entries: readonly WorkshopPinnedContextEntry[]
  ): Promise<{ reads: WorkshopPinnedFileRead[]; catalogUnreadable: boolean }> {
    const catalog = await this.openCatalog();
    const rows = catalog?.entries() ?? [];
    const reads: WorkshopPinnedFileRead[] = [];
    for (const entry of entries) {
      reads.push(await this.readResolved(rootPath, entry, catalog, await this.resolveAmong(rootPath, entry, rows)));
    }
    return { reads, catalogUnreadable: catalog === undefined };
  }

  /** The source one entry names under `rootPath`, against a fresh catalog: what Open opens (PR #210 F05). */
  async resolve(rootPath: string, entry: WorkshopPinnedContextEntry): Promise<WorkshopPinnedSourceResolution> {
    const catalog = await this.openCatalog();
    return this.resolveAmong(rootPath, entry, catalog?.entries() ?? []);
  }

  private async openCatalog(): Promise<WorkshopContextIntakeCatalog | undefined> {
    try {
      return await this.intake.openCatalog();
    } catch {
      return undefined;
    }
  }

  private async resolveAmong(
    rootPath: string,
    entry: WorkshopPinnedContextEntry,
    rows: readonly ContextResourceSummary[]
  ): Promise<WorkshopPinnedSourceResolution> {
    const exact = rows.find((row) => row.path === entry.path);
    if (exact) {
      return this.listedRow(rootPath, exact);
    }
    const named = path.join(rootPath, ...entry.path.split('/'));
    try {
      await this.fileSystem.stat(named);
      return { kind: 'workspace', fsPath: named };
    } catch (error) {
      if (!isMissingFileSystemPathError(error)) {
        return { kind: 'unreadable', fault: 'read-failed', fsPath: named };
      }
    }
    // The exact file is absent: a normalized catalog spelling, only when it is the one.
    const wanted = workshopPinnedContextPathKey(entry.path, this.platform);
    const keyed = rows.filter((row) => workshopPinnedContextPathKey(row.path, this.platform) === wanted);
    if (new Set(keyed.map((row) => row.path)).size > 1) {
      return { kind: 'unreadable', fault: 'ambiguous' };
    }
    return keyed.length > 0 ? this.listedRow(rootPath, keyed[0]) : { kind: 'missing' };
  }

  /** A catalog row, when it was listed under the captured root itself (PR #208 F01). */
  private listedRow(rootPath: string, row: ContextResourceSummary): WorkshopPinnedSourceResolution {
    return workshopPinnedListedUnderRoot(rootPath, row)
      ? { kind: 'catalog', summary: row, fsPath: row.absolutePath }
      // The catalog was listed under another root, nested or not: the workspace moved under the read.
      : { kind: 'unreadable', fault: 'workspace-changed', group: row.group };
  }

  private async readResolved(
    rootPath: string,
    entry: WorkshopPinnedContextEntry,
    catalog: WorkshopContextIntakeCatalog | undefined,
    resolution: WorkshopPinnedSourceResolution
  ): Promise<WorkshopPinnedFileRead> {
    const named = path.join(rootPath, ...entry.path.split('/'));
    const resolved = resolution.kind === 'catalog' ? [resolution.fsPath] : [];
    const identity: WorkshopPinnedFileIdentity = {
      entry,
      label: workshopPinnedFileLabel(entry.path),
      sourceUris: [...new Set([named, ...resolved].map((file) => pathToFileURL(file).toString()))]
    };
    switch (resolution.kind) {
      case 'missing':
        return { ...identity, state: 'missing' };
      case 'unreadable':
        return {
          ...identity,
          state: 'unreadable',
          source: resolution.group ? { kind: 'catalog', group: resolution.group } : { kind: 'workspace' },
          fault: resolution.fault
        };
      case 'catalog':
      case 'workspace':
        break;
    }
    try {
      return resolution.kind === 'catalog' && catalog
        ? await this.readListed(identity, catalog, resolution.summary)
        : await this.readWorkspaceFile(rootPath, identity, named);
    } catch {
      return {
        ...identity,
        state: 'unreadable',
        source: resolution.kind === 'catalog' ? { kind: 'catalog', group: resolution.summary.group } : { kind: 'workspace' },
        fault: 'read-failed'
      };
    }
  }

  /**
   * Through the catalog's own door. The provider reads the absolute path it
   * listed when the catalog opened, which `readOne` checked was listed under
   * the captured root itself before anything is read.
   */
  private async readListed(
    identity: WorkshopPinnedFileIdentity,
    catalog: WorkshopContextIntakeCatalog,
    summary: ContextResourceSummary
  ): Promise<WorkshopPinnedFileRead> {
    const source: WorkshopPinnedFileSource = { kind: 'catalog', group: summary.group };
    const loaded = await catalog.load({ group: summary.group, path: summary.path }, BOUNDS);
    switch (loaded.kind) {
      case 'loaded':
        return {
          ...identity,
          state: 'ready',
          source,
          input: {
            kind: 'file',
            origin: 'writer',
            label: identity.label,
            content: loaded.resource.text,
            words: loaded.resource.words,
            sourceUri: pathToFileURL(summary.absolutePath).toString(),
            relativePath: summary.path,
            configuredResource: { group: summary.group, path: summary.path },
            ...(loaded.resource.truncation ? { truncation: { ...loaded.resource.truncation } } : {})
          }
        };
      case 'missing':
        return { ...identity, state: 'missing' };
      case 'too-large':
        return { ...identity, state: 'unreadable', source, fault: 'too-large' };
      case 'empty':
        return { ...identity, state: 'unreadable', source, fault: 'empty' };
      case 'unreadable':
        return { ...identity, state: 'unreadable', source, fault: 'read-failed' };
    }
  }

  /**
   * Through the workspace door, at the path the entry names under the
   * captured root. Authorization may recover a path against the live root;
   * any path it hands back other than the one asked for is never read.
   */
  private async readWorkspaceFile(
    rootPath: string,
    identity: WorkshopPinnedFileIdentity,
    fsPath: string
  ): Promise<WorkshopPinnedFileRead> {
    const source: WorkshopPinnedFileSource = { kind: 'workspace' };
    try {
      await this.fileSystem.stat(fsPath);
    } catch (error) {
      return isMissingFileSystemPathError(error)
        ? { ...identity, state: 'missing' }
        : { ...identity, state: 'unreadable', source, fault: 'read-failed' };
    }
    const authorization = await this.intake.authorizeExcerptReread({
      kind: 'file',
      sourceUri: pathToFileURL(fsPath).toString(),
      relativePath: identity.entry.path
    });
    if (authorization.kind === 'refused') {
      return { ...identity, state: 'unreadable', source, fault: 'refused' };
    }
    // Only the path the seed built from its own root (PR #208 F01, the coordinator's review).
    // Authorization's first two branches return it as given; only its recovery of a stale
    // URI returns another, under the live root, which may even sit inside the captured one.
    if (path.normalize(authorization.fsPath) !== path.normalize(fsPath)) {
      return { ...identity, state: 'unreadable', source, fault: 'workspace-changed' };
    }
    const loaded = await this.intake.loadFile(authorization.fsPath, identity.entry.path, BOUNDS, 'attach');
    if (loaded.kind === 'refused') {
      return { ...identity, state: 'unreadable', source, fault: intakeFault(loaded.refusal.reason) };
    }
    return {
      ...identity,
      state: 'ready',
      source,
      input: {
        kind: 'file',
        origin: 'writer',
        label: identity.label,
        content: loaded.file.text,
        words: loaded.file.words,
        sourceUri: pathToFileURL(authorization.fsPath).toString(),
        relativePath: identity.entry.path,
        ...(loaded.file.truncation ? { truncation: { ...loaded.file.truncation } } : {})
      }
    };
  }
}
