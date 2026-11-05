/**
 * Where a persona file edit lands (ADR 2026-11-05 D4.2, D11): its target
 * resolved fresh, host-side, or refused by reason. Nothing here reads a
 * path or URI a model or the webview gave:
 *
 * - **A configured resource** is looked up by `{ group, path }` in a fresh
 *   catalog, through the same provider and the same lookup `resource.read`
 *   uses (`findConfiguredResource`), so the gateway can never edit a file a
 *   persona could not have read.
 * - **The excerpt** is the room's own, from host session state, and only at
 *   the version the proposal was made against; its source is authorized as
 *   "Re-read from file" authorizes it.
 * - **Either way** the file must stand inside an open workspace folder, be a
 *   text file (`.md` or `.txt`, the catalog's rule), and be under the size
 *   bound. Its live text is checked again once it is open.
 */

import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  DEFAULT_CONTEXT_GROUPS,
  type ContextResourceProviderFactory
} from '@/domain/models/ContextGeneration';
import {
  FILE_EDIT_GROUP_KINDS,
  type FileEditRefusal,
  type FileEditTarget,
  type FileEditTargetKind
} from '@/domain/models/FileEdit';
import type { Workspace } from '@/platform/Workspace';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup } from '@shared/types/context';
import {
  findConfiguredResource,
  isSafeConfiguredResourcePath
} from '@/application/services/workshop/WorkshopConfiguredResourceLookup';

/** The room's excerpt as the gateway may edit it, from host session state. */
export type FileEditExcerptState =
  | { readonly kind: 'none' }
  | { readonly kind: 'manual'; readonly version: number }
  /** Its source authorized now (inside the workspace, no symbolic link), and the excerpt's own text. */
  | { readonly kind: 'file'; readonly version: number; readonly text: string; readonly fsPath: string }
  /** Its source no longer authorizes: moved, outside the workspace, unreadable. */
  | { readonly kind: 'unauthorized'; readonly version: number };

/** The room's excerpt, read when an edit is asked for (never cached). */
export interface FileEditExcerptPort {
  current(): Promise<FileEditExcerptState>;
}

export interface FileEditTargetDependencies {
  readonly catalog: ContextResourceProviderFactory;
  readonly excerpt: FileEditExcerptPort;
  readonly workspace: Pick<Workspace, 'workspaceFolders'>;
}

export type FileEditResolvedTarget = {
  readonly kind: FileEditTargetKind;
  /** A `file:` URL for the host to open; never shown or logged. */
  readonly locator: string;
  /** The excerpt's text, which the live document must still hold. */
  readonly excerptText?: string;
};

export type FileEditTargetResolution =
  | { readonly kind: 'resolved'; readonly target: FileEditResolvedTarget }
  | { readonly kind: 'refused'; readonly reason: FileEditRefusal };

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['.md', '.txt']);

export async function resolveFileEditTarget(
  target: FileEditTarget,
  dependencies: FileEditTargetDependencies
): Promise<FileEditTargetResolution> {
  return target.kind === 'resource'
    ? resolveResource(target, dependencies)
    : resolveExcerpt(target.excerptVersion, dependencies);
}

async function resolveResource(
  target: Extract<FileEditTarget, { kind: 'resource' }>,
  dependencies: FileEditTargetDependencies
): Promise<FileEditTargetResolution> {
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
  let entries;
  try {
    entries = (await dependencies.catalog.createProvider(DEFAULT_CONTEXT_GROUPS)).listResources();
  } catch {
    return refused('catalog-unreadable');
  }
  const lookup = findConfiguredResource(entries, target.group, target.path);
  if (lookup.kind !== 'found') {
    return refused(lookup.kind === 'ambiguous' ? 'ambiguous-path' : 'not-configured');
  }
  if (lookup.resource.sizeBytes > PROMPT_BUDGETS.workshopFileEdits.fileBytes) {
    return refused('too-large');
  }
  const located = locate(lookup.resource.absolutePath, dependencies);
  return 'reason' in located ? located : { kind: 'resolved', target: { kind: FILE_EDIT_GROUP_KINDS[target.group], locator: located.locator } };
}

async function resolveExcerpt(excerptVersion: number, dependencies: FileEditTargetDependencies): Promise<FileEditTargetResolution> {
  const excerpt = await dependencies.excerpt.current();
  if (excerpt.kind === 'none') {
    return refused('no-excerpt');
  }
  if (excerpt.version !== excerptVersion) {
    return refused('excerpt-stale');
  }
  if (excerpt.kind === 'manual') {
    return refused('excerpt-manual');
  }
  if (excerpt.kind === 'unauthorized') {
    return refused('outside-workspace');
  }
  const located = locate(excerpt.fsPath, dependencies);
  return 'reason' in located
    ? located
    : { kind: 'resolved', target: { kind: 'prose', locator: located.locator, excerptText: excerpt.text } };
}

/** Inside an open workspace folder, and a text file by the catalog's rule. */
function locate(fsPath: string, dependencies: FileEditTargetDependencies): { readonly locator: string } | { readonly kind: 'refused'; readonly reason: FileEditRefusal } {
  if (!dependencies.workspace.workspaceFolders().some((folder) => isPathWithinRoot(folder.path, fsPath))) {
    return refused('outside-workspace');
  }
  if (!TEXT_EXTENSIONS.has(path.extname(fsPath).toLowerCase())) {
    return refused('not-text');
  }
  return { locator: pathToFileURL(fsPath).toString() };
}

function refused(reason: FileEditRefusal): { readonly kind: 'refused'; readonly reason: FileEditRefusal } {
  return { kind: 'refused', reason };
}
