/**
 * A file edit's identity, class and baseline (ADR 2026-11-05 D4–D6): the
 * host rules staging takes them by and Apply checks them again by. Nothing
 * here reads a path or URI a model or the webview gave.
 *
 * - **One physical file or a refusal.** `{ group, path }`, matched without
 *   letter case as `resource.read` matches it, must name exactly one
 *   absolute file across every root's candidates. The same file through
 *   nested roots is one file; equal paths in two roots, or two spellings
 *   on a case-sensitive disk, are `ambiguous-target`.
 * - **The identity** is the file's `file:` URL (host-written) and its
 *   display path.
 * - **The class** is prose when any membership of the file, in any group
 *   through any root, is `chapters` or `manuscript`, or the file is an
 *   excerpt document.
 * - **The baseline** is the SHA-256 and length of the planner's content:
 *   after front matter (Markdown files by extension), whitespace around it
 *   trimmed.
 */

import { createHash } from 'crypto';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';
import { FILE_EDIT_PROSE_GROUPS } from '@/domain/models/FileEdit';
import type { FileEditBaseline, FileEditClass } from '@/domain/models/FileEditStaging';
import { FileType, type FileSystem } from '@/platform/FileSystem';
import type { Workspace } from '@/platform/Workspace';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { markdownFrontMatterEnd } from '@/utils/draftEdit/markdownBlockRegions';
import { textEditContentSpan } from '@/utils/textEdits/planTextEdits';

/** The room's excerpt document now, as staging and Apply read it. */
export interface FileEditExcerptPort {
  /**
   * The excerpt's source document, authorized as "Re-read from file"
   * authorizes it; undefined when there is no excerpt, it was pasted, or its
   * source no longer authorizes.
   */
  currentDocument(): Promise<{ readonly fsPath: string; readonly relativePath: string } | undefined>;
}

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['.md', '.txt']);

export function isTextFilePath(fsPath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
}

export function documentUriOf(fsPath: string): string {
  return pathToFileURL(fsPath).toString();
}

/** The absolute path a host-written `file:` URL names; undefined for anything else. */
export function fsPathOf(documentUri: string): string | undefined {
  try {
    return path.normalize(fileURLToPath(documentUri));
  } catch {
    return undefined;
  }
}

/** Whether two absolute paths are one file by name (letter case folded on Windows). */
export function samePath(left: string, right: string, platform: NodeJS.Platform = process.platform): boolean {
  const a = path.normalize(left);
  const b = path.normalize(right);
  return platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Whether a host's document URI names the identity's file. */
export function sameDocument(hostUri: string, documentUri: string): boolean {
  const host = fsPathOf(hostUri);
  const identity = fsPathOf(documentUri);
  return host !== undefined && identity !== undefined ? samePath(host, identity) : hostUri === documentUri;
}

export type FileEditCandidateLookup =
  | { readonly kind: 'found'; readonly candidate: ContextResourceCandidate }
  | { readonly kind: 'missing' }
  | { readonly kind: 'ambiguous' };

/** `{ group, path }` among every candidate: exactly one physical file, or why not. */
export function findFileEditCandidate(
  candidates: readonly ContextResourceCandidate[],
  group: string,
  resourcePath: string
): FileEditCandidateLookup {
  const folded = resourcePath.toLowerCase();
  const matches = candidates.filter((each) => each.group === group && each.relativePath.toLowerCase() === folded);
  if (matches.length === 0) {
    return { kind: 'missing' };
  }
  const files = matches.filter((each, index) => matches.findIndex((other) => samePath(other.absolutePath, each.absolutePath)) === index);
  if (files.length > 1) {
    return { kind: 'ambiguous' };
  }
  // Nested roots name one file twice: keep the spelling asked for when one has it.
  return { kind: 'found', candidate: matches.find((each) => each.relativePath === resourcePath) ?? matches[0] };
}

/** Every configured membership of one physical file. */
export function membershipsOf(candidates: readonly ContextResourceCandidate[], fsPath: string): ContextResourceCandidate[] {
  return candidates.filter((each) => samePath(each.absolutePath, fsPath));
}

export function classOf(memberships: readonly ContextResourceCandidate[], isExcerptDocument: boolean): FileEditClass {
  return isExcerptDocument || memberships.some((each) => FILE_EDIT_PROSE_GROUPS.has(each.group)) ? 'prose' : 'notes';
}

/** Where a rewrite's content begins: after front matter in a Markdown file. */
export function fileEditSkipLeading(text: string, fsPath: string): number {
  return path.extname(fsPath).toLowerCase() === '.md' ? markdownFrontMatterEnd(text) : 0;
}

export function fileEditContent(text: string, fsPath: string): string {
  const span = textEditContentSpan(text, fileEditSkipLeading(text, fsPath));
  return text.slice(span.start, span.end);
}

export function fileEditBaseline(text: string, fsPath: string): FileEditBaseline {
  const content = fileEditContent(text, fsPath);
  return { sha256: createHash('sha256').update(content, 'utf8').digest('hex'), length: content.length };
}

/**
 * Inside an open workspace folder, with no symbolic link on the way down
 * from it: the resolver's checks, for a path the catalog may not list (the
 * excerpt's document).
 */
export async function containedWithoutLinks(
  fsPath: string,
  workspace: Pick<Workspace, 'workspaceFolders'>,
  fileSystem: Pick<FileSystem, 'stat'>
): Promise<boolean> {
  const root = workspace.workspaceFolders().find((folder) => isPathWithinRoot(folder.path, fsPath));
  if (!root) {
    return false;
  }
  let current = root.path;
  for (const segment of path.relative(root.path, fsPath).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if (((await fileSystem.stat(current)).type & FileType.SymbolicLink) !== 0) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/** Whether a path is still inside a current workspace folder: the synchronous half, for the last boundary. */
export function insideWorkspace(fsPath: string, workspace: Pick<Workspace, 'workspaceFolders'>): boolean {
  return workspace.workspaceFolders().some((folder) => isPathWithinRoot(folder.path, fsPath));
}

/** A live text the gateway may edit: text, and under the bound. */
export function liveTextFault(text: string, maxBytes: number): 'not-text' | 'too-large' | undefined {
  if (text.includes('\u0000')) {
    return 'not-text';
  }
  return Buffer.byteLength(text, 'utf8') > maxBytes ? 'too-large' : undefined;
}
