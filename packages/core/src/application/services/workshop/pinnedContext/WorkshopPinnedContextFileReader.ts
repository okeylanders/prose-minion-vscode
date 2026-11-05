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
 * **Only from the captured root** (PR #208 F01). Every read is of a path
 * under the root the caller captured, checked before anything is read; a
 * file that would come from elsewhere is `workspace-changed`, never read.
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
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';

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
 * - `ambiguous`: no catalog row names the path exactly, and several distinct
 *   rows name it by its normalized key, so none is chosen (PR #208 F03);
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

/** A catalog row the entry names: exactly, or alone by its normalized key; or why none is chosen. */
type CatalogMatch =
  | { kind: 'row'; summary: ContextResourceSummary }
  | { kind: 'ambiguous' }
  | { kind: 'none' };

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
    let catalog: WorkshopContextIntakeCatalog | undefined;
    try {
      catalog = await this.intake.openCatalog();
    } catch {
      catalog = undefined;
    }
    const rows = catalog?.entries() ?? [];
    const reads: WorkshopPinnedFileRead[] = [];
    for (const entry of entries) {
      reads.push(await this.readOne(rootPath, entry, catalog, this.match(entry, rows)));
    }
    return { reads, catalogUnreadable: catalog === undefined };
  }

  /** The exact stored path first; a normalized match only when one distinct row has it (PR #208 F03). */
  private match(entry: WorkshopPinnedContextEntry, rows: readonly ContextResourceSummary[]): CatalogMatch {
    const exact = rows.find((row) => row.path === entry.path);
    if (exact) {
      return { kind: 'row', summary: exact };
    }
    const wanted = workshopPinnedContextPathKey(entry.path, this.platform);
    const keyed = rows.filter((row) => workshopPinnedContextPathKey(row.path, this.platform) === wanted);
    const distinct = new Set(keyed.map((row) => row.path));
    if (distinct.size > 1) {
      return { kind: 'ambiguous' };
    }
    return keyed.length > 0 ? { kind: 'row', summary: keyed[0] } : { kind: 'none' };
  }

  private async readOne(
    rootPath: string,
    entry: WorkshopPinnedContextEntry,
    catalog: WorkshopContextIntakeCatalog | undefined,
    match: CatalogMatch
  ): Promise<WorkshopPinnedFileRead> {
    const named = path.join(rootPath, ...entry.path.split('/'));
    const listed = match.kind === 'row' && isPathWithinRoot(rootPath, match.summary.absolutePath) ? match.summary : undefined;
    const identity: WorkshopPinnedFileIdentity = {
      entry,
      label: workshopPinnedFileLabel(entry.path),
      sourceUris: [...new Set([named, ...(listed ? [listed.absolutePath] : [])].map((file) => pathToFileURL(file).toString()))]
    };
    if (match.kind === 'ambiguous') {
      return { ...identity, state: 'unreadable', source: { kind: 'workspace' }, fault: 'ambiguous' };
    }
    if (match.kind === 'row' && !listed) {
      // The catalog listed another root's file: the workspace moved under the read.
      return { ...identity, state: 'unreadable', source: { kind: 'catalog', group: match.summary.group }, fault: 'workspace-changed' };
    }
    try {
      return catalog && listed
        ? await this.readListed(identity, catalog, listed)
        : await this.readWorkspaceFile(rootPath, identity, named);
    } catch {
      return {
        ...identity,
        state: 'unreadable',
        source: listed ? { kind: 'catalog', group: listed.group } : { kind: 'workspace' },
        fault: 'read-failed'
      };
    }
  }

  /**
   * Through the catalog's own door. The provider reads the absolute path it
   * listed when the catalog opened, which `readOne` checked is under the
   * captured root before anything is read.
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
   * a path it hands back outside the captured one is never read.
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
    if (!isPathWithinRoot(rootPath, authorization.fsPath)) {
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
