/**
 * From scopes to files in hand (ADR 2026-11-20 D3, D3a, D4, D6), once per
 * plan. Nothing here is kept after the plan it serves.
 *
 * - **One listing per operation.** Every `group` and `file` scope resolves
 *   against one authoritative, root-aware listing (`listGroupFiles`). A
 *   scan that fails refuses the plan (`catalog-unreadable`): a plan never
 *   reads fewer files than its scopes name without saying so.
 * - **A `file` scope** is looked up in its own group's files: the exact
 *   relative path, else the one path equal to it but for letter case. A
 *   path two roots both hold is `ambiguous-file`, never the first root's.
 * - **A `pattern`** takes the same authoritative walk as a context path
 *   (`.md` and `.txt` only, the resolver's fixed excludes, symbolic links
 *   and escapes refused). Its unsafe forms were refused with the request.
 * - **`active-file` and `selection`** are read from the editor port on the
 *   host. A selection's lines are the document's when the port gives its
 *   start line, else counted within the selection.
 * - **Reading order is the host's:** scopes as given; inside a `group` or
 *   `pattern`, files in natural order of their paths.
 * - **De-duplicated by the host's file identity,** the first scope to name
 *   a file keeping it.
 * - **Bounds before reads.** More than `files` files, or a file over
 *   `fileBytes`, refuses the plan before any file is read. Each file is
 *   read once, as strict UTF-8; one that is not text is left out and
 *   counted, never a refusal.
 *
 * Host paths stay host-side. Nothing here logs.
 */

import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';
import { hostFileIdentity } from '@/infrastructure/context/ContextGroupFiles';
import type { EditorContext, FileSystem, Workspace } from '@/platform';
import { compareNaturalPaths } from '@/utils/naturalOrder';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types/context';
import type { PassageSearchRefusal, PassageSearchSourceFile } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchLeftOutFile } from '@services/search/passage/PassageSearchPlanning';
import { passageSearchRefusal } from '@services/search/passage/PassageSearchRefusals';
import type { PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';

/** The resolver's authoritative reads, as a port: each rejects when a scan fails. */
export interface PassageSearchFileListing {
  listGroupFiles(groups: ContextPathGroup[]): Promise<ContextResourceCandidate[]>;
  listPatternFiles(patterns: readonly string[]): Promise<ContextResourceCandidate[]>;
}

export interface PassageSearchScopeFilesPorts {
  readonly listing: PassageSearchFileListing;
  readonly fileSystem: Pick<FileSystem, 'readFile' | 'stat'>;
  readonly workspace: Pick<Workspace, 'workspaceFolders'>;
  readonly editor: Pick<EditorContext, 'getActiveSelection'>;
}

export type PassageSearchScopeFilesOutcome =
  | { readonly kind: 'files'; readonly files: readonly PassageSearchSourceFile[]; readonly leftOut: readonly PassageSearchLeftOutFile[] }
  | { readonly kind: 'refused'; readonly refusal: PassageSearchRefusal };

/** A file named by a scope, before it is read. */
interface NamedFile {
  readonly identity: string;
  readonly displayPath: string;
  readonly absolutePath?: string;
  /** Already in hand: a selection's text, or a text given by value. */
  readonly text?: string;
  /** Known from the listing; asked of the file system when absent. */
  readonly sizeBytes?: number;
  readonly lineOffset: number;
  readonly lines: 'document' | 'text';
}

class Refused extends Error {
  constructor(readonly refusal: PassageSearchRefusal) {
    super(refusal.reason);
  }
}

export class PassageSearchScopeFiles {
  constructor(private readonly ports: PassageSearchScopeFilesPorts) {}

  async resolve(scopes: readonly PassageSearchScope[]): Promise<PassageSearchScopeFilesOutcome> {
    try {
      const named = await this.name(scopes);
      const bounds = PROMPT_BUDGETS.passageSearch;
      if (named.length > bounds.files) {
        throw new Refused(passageSearchRefusal('too-many-files', named.length));
      }
      const sizes = await Promise.all(named.map((file) => this.sizeOf(file)));
      const tooLarge = sizes.filter((size) => size > bounds.fileBytes).length;
      if (tooLarge > 0) {
        throw new Refused(passageSearchRefusal('file-too-large', tooLarge));
      }
      const files: PassageSearchSourceFile[] = [];
      const leftOut: PassageSearchLeftOutFile[] = [];
      for (const file of named) {
        const text = file.text ?? await this.read(file.absolutePath!, bounds.fileBytes);
        if (text === undefined) {
          leftOut.push({ identity: file.identity, reason: 'unreadable' });
          continue;
        }
        files.push({
          identity: file.identity,
          displayPath: file.displayPath,
          ...(file.absolutePath !== undefined ? { absolutePath: file.absolutePath } : {}),
          text,
          lineOffset: file.lineOffset,
          lines: file.lines
        });
      }
      return { kind: 'files', files, leftOut };
    } catch (error) {
      if (error instanceof Refused) {
        return { kind: 'refused', refusal: error.refusal };
      }
      throw error;
    }
  }

  /** Every file the scopes name, in reading order, each once. Reads no file. */
  private async name(scopes: readonly PassageSearchScope[]): Promise<NamedFile[]> {
    const groups = [...new Set(scopes.flatMap((scope): ContextPathGroup[] =>
      scope.kind === 'group' ? [scope.group] : scope.kind === 'file' ? [scope.file.group] : []))];
    // One listing for the plan, asked only when a scope needs it.
    const listed = groups.length > 0 ? await this.listed(() => this.ports.listing.listGroupFiles(groups)) : [];
    const named = new Map<string, NamedFile>();
    const add = (file: NamedFile): void => {
      if (!named.has(file.identity)) {
        named.set(file.identity, file);
      }
    };
    for (const [index, scope] of scopes.entries()) {
      switch (scope.kind) {
        case 'active-file':
          add(this.activeFile());
          break;
        case 'selection':
          add(this.selection());
          break;
        case 'group':
          inReadingOrder(listed.filter((file) => file.group === scope.group)).forEach((file) => add(this.listedFile(file)));
          break;
        case 'file':
          add(this.listedFile(configuredFile(listed, scope.file.group, scope.file.path)));
          break;
        case 'pattern': {
          const matched = await this.listed(() => this.ports.listing.listPatternFiles([scope.pattern.trim()]));
          inReadingOrder(matched).forEach((file) => add(this.listedFile(file)));
          break;
        }
        case 'text':
          add({ identity: `text\u0000${index}`, displayPath: scope.label, text: scope.text, lineOffset: 0, lines: 'text' });
          break;
      }
    }
    return [...named.values()];
  }

  private async listed(read: () => Promise<ContextResourceCandidate[]>): Promise<ContextResourceCandidate[]> {
    try {
      return await read();
    } catch {
      throw new Refused(passageSearchRefusal('catalog-unreadable'));
    }
  }

  private listedFile(file: ContextResourceCandidate): NamedFile {
    const folders = this.ports.workspace.workspaceFolders();
    const root = folders.length > 1 ? folders.find((folder) => folder.path === file.workspaceFolderPath)?.name : undefined;
    return {
      identity: hostFileIdentity(file.absolutePath),
      displayPath: root ? `${root}/${file.relativePath}` : file.relativePath,
      absolutePath: file.absolutePath,
      sizeBytes: file.sizeBytes,
      lineOffset: 0,
      lines: 'document'
    };
  }

  private activeFile(): NamedFile {
    const editor = this.ports.editor.getActiveSelection();
    // An untitled document has no file to read; its text can be searched as a selection.
    if (!editor || editor.uriString.startsWith('untitled:') || editor.fsPath.trim().length === 0) {
      throw new Refused(passageSearchRefusal('no-active-file'));
    }
    return {
      identity: hostFileIdentity(editor.fsPath),
      displayPath: editor.relativePath,
      absolutePath: editor.fsPath,
      lineOffset: 0,
      lines: 'document'
    };
  }

  private selection(): NamedFile {
    const selection = this.ports.editor.getActiveSelection();
    if (!selection || selection.isEmpty || selection.text.length === 0) {
      throw new Refused(passageSearchRefusal('no-selection'));
    }
    const saved = selection.fsPath.trim().length > 0 && !selection.uriString.startsWith('untitled:');
    return {
      // Apart from its whole file: a selection is its own text, with its own lines.
      identity: `selection\u0000${selection.uriString}`,
      displayPath: selection.relativePath,
      ...(saved ? { absolutePath: selection.fsPath } : {}),
      text: selection.text,
      lineOffset: selection.startLine !== undefined ? selection.startLine - 1 : 0,
      lines: selection.startLine !== undefined ? 'document' : 'text'
    };
  }

  private async sizeOf(file: NamedFile): Promise<number> {
    if (file.text !== undefined) {
      return Buffer.byteLength(file.text, 'utf8');
    }
    if (file.sizeBytes !== undefined) {
      return file.sizeBytes;
    }
    try {
      return (await this.ports.fileSystem.stat(file.absolutePath!)).size;
    } catch {
      // Only the active file is sized here: one that cannot be stat'ed is no file to read.
      throw new Refused(passageSearchRefusal('no-active-file'));
    }
  }

  /** The file as strict UTF-8 text, a byte-order mark set aside; undefined when it cannot be read as text. */
  private async read(absolutePath: string, maxBytes: number): Promise<string | undefined> {
    let bytes: Uint8Array;
    try {
      bytes = await this.ports.fileSystem.readFile(absolutePath);
    } catch {
      return undefined;
    }
    // The size was checked from the listing; a file that grew since is refused by the bound, not read past it.
    if (bytes.byteLength > maxBytes) {
      throw new Refused(passageSearchRefusal('file-too-large', 1));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return undefined;
    }
  }
}

/** Natural order of the relative paths; the same path in two roots by root. */
function inReadingOrder(files: readonly ContextResourceCandidate[]): ContextResourceCandidate[] {
  return [...files].sort((a, b) =>
    compareNaturalPaths(a.relativePath, b.relativePath) || compareNaturalPaths(a.workspaceFolderPath, b.workspaceFolderPath));
}

/** The one file `{ group, path }` names in the listing (D3a). */
function configuredFile(listed: readonly ContextResourceCandidate[], group: ContextPathGroup, resourcePath: string): ContextResourceCandidate {
  const inGroup = listed.filter((file) => file.group === group);
  const exact = inGroup.filter((file) => file.relativePath === resourcePath);
  const folded = resourcePath.toLowerCase();
  const matches = exact.length > 0 ? exact : inGroup.filter((file) => file.relativePath.toLowerCase() === folded);
  if (matches.length === 0) {
    throw new Refused(passageSearchRefusal('unknown-file'));
  }
  if (matches.length > 1) {
    throw new Refused(passageSearchRefusal('ambiguous-file'));
  }
  return matches[0];
}
