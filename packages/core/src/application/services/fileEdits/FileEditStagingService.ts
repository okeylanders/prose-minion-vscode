/**
 * Staging a file edit (ADR 2026-11-05 D4): when a reply is read, each frame's
 * target becomes a host-owned identity, a class and a baseline, or a refusal
 * with its reason. Host only; nothing is written, opened or shown.
 *
 * - **A resource** is found among every candidate (`listCandidates`, read
 *   fresh): exactly one physical file, or `not-configured` /
 *   `ambiguous-target`. Candidates already passed the catalog's containment
 *   and symbolic-link checks.
 * - **The excerpt** is the room's excerpt document at this moment, authorized
 *   as "Re-read from file" authorizes it, inside a workspace folder with no
 *   link on the way; a pasted excerpt, or none, is `excerpt-not-a-file`.
 * - **The baseline** is read from the live buffer when the document is open
 *   (`DocumentEditor.peek`), else from the file.
 *
 * It never rejects. Logs carry the target kind and the refusal, never a path.
 */

import { DEFAULT_CONTEXT_GROUPS, type ContextResourceCandidate, type ContextResourceCandidateReader } from '@/domain/models/ContextGeneration';
import type {
  FileEditIdentity,
  FileEditStaging,
  FileEditStagingRefusal,
  FileEditStagingResult,
  FileEditStagingTarget
} from '@/domain/models/FileEditStaging';
import type { DocumentEditor } from '@/platform/DocumentEditor';
import type { FileSystem } from '@/platform/FileSystem';
import type { LogSink } from '@/platform/LogSink';
import type { Workspace } from '@/platform/Workspace';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup } from '@shared/types/context';
import { isSafeConfiguredResourcePath } from '@/application/services/workshop/WorkshopConfiguredResourceLookup';
import {
  classOf,
  containedWithoutLinks,
  documentUriOf,
  fileEditBaseline,
  findFileEditCandidate,
  isTextFilePath,
  liveTextFault,
  membershipsOf,
  samePath,
  type FileEditExcerptPort
} from './fileEditIdentity';

export interface FileEditStagingDependencies {
  readonly candidates: ContextResourceCandidateReader;
  readonly excerpt: FileEditExcerptPort;
  readonly workspace: Pick<Workspace, 'workspaceFolders'>;
  readonly fileSystem: Pick<FileSystem, 'stat' | 'readFile'>;
  readonly documents: Pick<DocumentEditor, 'peek'>;
  readonly log: LogSink;
}

const BYTES = PROMPT_BUDGETS.workshopFileEdits.fileBytes;

export class FileEditStagingService implements FileEditStaging {
  constructor(private readonly dependencies: FileEditStagingDependencies) {}

  async stage(target: FileEditStagingTarget): Promise<FileEditStagingResult> {
    let result: FileEditStagingResult;
    try {
      result = await this.stageTarget(target);
    } catch {
      result = refused('unreadable');
    }
    this.dependencies.log.appendLine(`[FileEdit] staged target=${target.kind === 'resource' ? `group=${target.group}` : 'excerpt'} ` +
      (result.kind === 'staged' ? `class=${result.class}` : `refused=${result.reason}`));
    return result;
  }

  private async stageTarget(target: FileEditStagingTarget): Promise<FileEditStagingResult> {
    const excerpt = await this.dependencies.excerpt.currentDocument();
    let candidates: ContextResourceCandidate[] | undefined;
    try {
      candidates = await this.dependencies.candidates.listCandidates(DEFAULT_CONTEXT_GROUPS);
    } catch {
      candidates = undefined;
    }

    let identity: FileEditIdentity;
    let fsPath: string;
    if (target.kind === 'resource') {
      if (typeof target.group !== 'string' || !isContextPathGroup(target.group)) {
        return refused('unknown-group');
      }
      if (
        typeof target.path !== 'string'
        || target.path.length > PROMPT_BUDGETS.workshopResource.pathCharacters
        || !isSafeConfiguredResourcePath(target.path)
      ) {
        return refused('unsafe-path');
      }
      if (!candidates) {
        return refused('catalog-unreadable');
      }
      const lookup = findFileEditCandidate(candidates, target.group, target.path);
      if (lookup.kind !== 'found') {
        return refused(lookup.kind === 'ambiguous' ? 'ambiguous-target' : 'not-configured');
      }
      if (lookup.candidate.sizeBytes > BYTES) {
        return refused('too-large');
      }
      fsPath = lookup.candidate.absolutePath;
      identity = { kind: 'file', documentUri: documentUriOf(fsPath), relativePath: lookup.candidate.relativePath };
    } else {
      if (!excerpt) {
        return refused('excerpt-not-a-file');
      }
      if (!(await containedWithoutLinks(excerpt.fsPath, this.dependencies.workspace, this.dependencies.fileSystem))) {
        return refused('outside-workspace');
      }
      fsPath = excerpt.fsPath;
      identity = { kind: 'excerpt', documentUri: documentUriOf(fsPath), relativePath: excerpt.relativePath };
    }
    if (!isTextFilePath(fsPath)) {
      return refused('not-text');
    }

    const text = await this.liveText(identity.documentUri, fsPath);
    if (text === undefined) {
      return refused('unreadable');
    }
    const fault = liveTextFault(text, BYTES);
    if (fault) {
      return refused(fault);
    }
    const isExcerptDocument = identity.kind === 'excerpt' || (excerpt !== undefined && samePath(excerpt.fsPath, fsPath));
    return {
      kind: 'staged',
      target: identity,
      class: classOf(membershipsOf(candidates ?? [], fsPath), isExcerptDocument),
      baseline: fileEditBaseline(text, fsPath)
    };
  }

  /** The live buffer when the document is open, else the file as VS Code would read it (no byte-order mark). */
  private async liveText(documentUri: string, fsPath: string): Promise<string | undefined> {
    const open = this.dependencies.documents.peek(documentUri);
    if (open) {
      return open.text;
    }
    try {
      return Buffer.from(await this.dependencies.fileSystem.readFile(fsPath)).toString('utf8').replace(/^﻿/, '');
    } catch {
      return undefined;
    }
  }
}

function refused(reason: FileEditStagingRefusal): FileEditStagingResult {
  return { kind: 'refused', reason };
}
