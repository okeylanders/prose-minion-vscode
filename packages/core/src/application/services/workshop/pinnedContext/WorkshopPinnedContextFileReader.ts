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
 * - `read-failed`: the read itself failed.
 */
export type WorkshopPinnedFileFault = 'not-a-file' | 'too-large' | 'empty' | 'refused' | 'read-failed';

/** One pinned file as read now, in pinned order. */
export type WorkshopPinnedFileRead =
  | {
      readonly state: 'ready';
      readonly entry: WorkshopPinnedContextEntry;
      readonly label: string;
      readonly source: WorkshopPinnedFileSource;
      /** What an attach adds: `origin: 'writer'`, head-sliced at the budget. */
      readonly input: WorkshopContextAttachmentInput;
    }
  | {
      readonly state: 'missing';
      readonly entry: WorkshopPinnedContextEntry;
      readonly label: string;
    }
  | {
      readonly state: 'unreadable';
      readonly entry: WorkshopPinnedContextEntry;
      readonly label: string;
      readonly source: WorkshopPinnedFileSource;
      readonly fault: WorkshopPinnedFileFault;
    };

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

export class WorkshopPinnedContextFileReader {
  constructor(
    private readonly intake: WorkshopPinnedContextIntakePort,
    private readonly fileSystem: Pick<FileSystem, 'stat'>,
    private readonly platform: WorkshopPinnedContextPathPlatform
  ) {}

  /**
   * Read every entry, in order, against one fresh catalog. A catalog that
   * cannot be opened reads every entry as a workspace file; the second
   * return value says so, for the log.
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
    const byKey = new Map<string, ContextResourceSummary>();
    for (const summary of catalog?.entries() ?? []) {
      const key = workshopPinnedContextPathKey(summary.path, this.platform);
      if (!byKey.has(key)) {
        byKey.set(key, summary);
      }
    }
    const reads: WorkshopPinnedFileRead[] = [];
    for (const entry of entries) {
      const summary = byKey.get(workshopPinnedContextPathKey(entry.path, this.platform));
      reads.push(await this.readOne(rootPath, entry, catalog && summary ? { catalog, summary } : undefined));
    }
    return { reads, catalogUnreadable: catalog === undefined };
  }

  private async readOne(
    rootPath: string,
    entry: WorkshopPinnedContextEntry,
    listed: { catalog: WorkshopContextIntakeCatalog; summary: ContextResourceSummary } | undefined
  ): Promise<WorkshopPinnedFileRead> {
    const label = workshopPinnedFileLabel(entry.path);
    try {
      return listed
        ? await this.readListed(entry, label, listed.catalog, listed.summary)
        : await this.readWorkspaceFile(rootPath, entry, label);
    } catch {
      return {
        state: 'unreadable',
        entry,
        label,
        source: listed ? { kind: 'catalog', group: listed.summary.group } : { kind: 'workspace' },
        fault: 'read-failed'
      };
    }
  }

  private async readListed(
    entry: WorkshopPinnedContextEntry,
    label: string,
    catalog: WorkshopContextIntakeCatalog,
    summary: ContextResourceSummary
  ): Promise<WorkshopPinnedFileRead> {
    const source: WorkshopPinnedFileSource = { kind: 'catalog', group: summary.group };
    const loaded = await catalog.load({ group: summary.group, path: summary.path }, BOUNDS);
    switch (loaded.kind) {
      case 'loaded':
        return {
          state: 'ready',
          entry,
          label,
          source,
          input: {
            kind: 'file',
            origin: 'writer',
            label,
            content: loaded.resource.text,
            words: loaded.resource.words,
            sourceUri: pathToFileURL(summary.absolutePath).toString(),
            relativePath: summary.path,
            configuredResource: { group: summary.group, path: summary.path },
            ...(loaded.resource.truncation ? { truncation: { ...loaded.resource.truncation } } : {})
          }
        };
      case 'missing':
        return { state: 'missing', entry, label };
      case 'too-large':
        return { state: 'unreadable', entry, label, source, fault: 'too-large' };
      case 'empty':
        return { state: 'unreadable', entry, label, source, fault: 'empty' };
      case 'unreadable':
        return { state: 'unreadable', entry, label, source, fault: 'read-failed' };
    }
  }

  private async readWorkspaceFile(
    rootPath: string,
    entry: WorkshopPinnedContextEntry,
    label: string
  ): Promise<WorkshopPinnedFileRead> {
    const source: WorkshopPinnedFileSource = { kind: 'workspace' };
    const fsPath = path.join(rootPath, ...entry.path.split('/'));
    try {
      await this.fileSystem.stat(fsPath);
    } catch (error) {
      return isMissingFileSystemPathError(error)
        ? { state: 'missing', entry, label }
        : { state: 'unreadable', entry, label, source, fault: 'read-failed' };
    }
    const authorization = await this.intake.authorizeExcerptReread({
      kind: 'file',
      sourceUri: pathToFileURL(fsPath).toString(),
      relativePath: entry.path
    });
    if (authorization.kind === 'refused') {
      return { state: 'unreadable', entry, label, source, fault: 'refused' };
    }
    const loaded = await this.intake.loadFile(authorization.fsPath, entry.path, BOUNDS, 'attach');
    if (loaded.kind === 'refused') {
      return { state: 'unreadable', entry, label, source, fault: intakeFault(loaded.refusal.reason) };
    }
    const configured = authorization.source.configuredResource;
    return {
      state: 'ready',
      entry,
      label,
      source: configured ? { kind: 'catalog', group: configured.group } : source,
      input: {
        kind: 'file',
        origin: 'writer',
        label,
        content: loaded.file.text,
        words: loaded.file.words,
        sourceUri: authorization.source.sourceUri,
        relativePath: entry.path,
        ...(configured ? { configuredResource: { ...configured } } : {}),
        ...(loaded.file.truncation ? { truncation: { ...loaded.file.truncation } } : {})
      }
    };
  }
}
