/**
 * ProjectFolderScan — the project's folders, by name only (ADR 2026-11-19
 * D20). It reads folder and file names through `FileSystem.readDirectory`,
 * never a file's contents.
 *
 * - **Skipped:** any name starting with `.`, `node_modules`, the context
 *   resolver's exclusions (`dist`, `out`; `.git`, `.svn` and `.hg` are
 *   hidden already), `build`, Prose Minion's own `prose-minion/` folder,
 *   and symbolic links.
 * - **Bounded** by `PROMPT_BUDGETS.contextPaths`: `scanEntries` entries
 *   read, `scanDepth` levels below a root, `scanFolders` folders kept.
 *   Breadth first, so a bound leaves out the deepest folders, and the result
 *   says it stopped.
 * - **Each folder kept** gives its path, its `.md` and `.txt` counts and up
 *   to `sampleNames` names, each cut to `sampleNameCharacters`. A folder
 *   with no such file, and none below it, is left out.
 *
 * One scan serves the helper's input and, later, `locations.folders` (C2).
 * Logs carry counts only, never a name or a path.
 */

import * as path from 'path';
import { FileType, type FileSystem, type LogSink, type Workspace } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ProjectFolderSummary } from '@shared/types/projectFolders';

/** Folder names the scan never enters (beside every name that starts with `.`). */
export const PROJECT_FOLDER_SCAN_SKIPPED = ['node_modules', 'dist', 'out', 'build', 'prose-minion'] as const;

export type ProjectFolderScanStop = 'entries' | 'depth' | 'folders';

export interface ProjectFolderScanResult {
  readonly folders: readonly ProjectFolderSummary[];
  /** Directory entries read. */
  readonly entriesRead: number;
  /** Each bound the scan reached, in the order met; empty when it read everything. */
  readonly stopped: readonly ProjectFolderScanStop[];
  /** Folders whose listing could not be read. */
  readonly unreadable: number;
}

export type ProjectFolderScanBounds = typeof PROMPT_BUDGETS.contextPaths;

interface ScannedFolder {
  readonly display: string;
  readonly parent?: ScannedFolder;
  markdownFiles: number;
  textFiles: number;
  readonly sampleNames: string[];
  hasFilesBelow: boolean;
}

const SKIPPED = new Set<string>(PROJECT_FOLDER_SCAN_SKIPPED);
const LOG = '[ProjectFolderScan]';

function cutName(name: string, characters: number): string {
  const points = Array.from(name);
  return points.length <= characters ? name : points.slice(0, characters).join('');
}

function joinPath(base: string, name: string): string {
  return base === '.' ? name : `${base}/${name}`;
}

export class ProjectFolderScan {
  constructor(
    private readonly fileSystem: Pick<FileSystem, 'readDirectory'>,
    private readonly workspace: Pick<Workspace, 'workspaceFolders'>,
    private readonly log: Pick<LogSink, 'appendLine'>,
    private readonly bounds: ProjectFolderScanBounds = PROMPT_BUDGETS.contextPaths
  ) {}

  /** The scan, or `undefined` when no folder is open. */
  async scan(): Promise<ProjectFolderScanResult | undefined> {
    const roots = this.workspace.workspaceFolders();
    if (roots.length === 0) {
      return undefined;
    }
    const stopped = new Set<ProjectFolderScanStop>();
    const scanned: ScannedFolder[] = [];
    const queue: Array<{ absolute: string; folder: ScannedFolder; depth: number }> = roots.map((root) => {
      const folder: ScannedFolder = {
        display: roots.length > 1 ? root.name : '.',
        markdownFiles: 0,
        textFiles: 0,
        sampleNames: [],
        hasFilesBelow: false
      };
      return { absolute: root.path, folder, depth: 0 };
    });
    let entriesRead = 0;
    let unreadable = 0;

    while (queue.length > 0) {
      if (entriesRead >= this.bounds.scanEntries) {
        stopped.add('entries');
        break;
      }
      const next = queue.shift()!;
      scanned.push(next.folder);
      let entries: Array<[string, FileType]>;
      try {
        entries = await this.fileSystem.readDirectory(next.absolute);
      } catch {
        unreadable += 1;
        continue;
      }
      const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      for (const [name, type] of sorted) {
        if (entriesRead >= this.bounds.scanEntries) {
          stopped.add('entries');
          break;
        }
        entriesRead += 1;
        if (name.startsWith('.') || (type & FileType.SymbolicLink) !== 0) {
          continue;
        }
        if ((type & FileType.Directory) !== 0) {
          if (SKIPPED.has(name)) {
            continue;
          }
          if (next.depth >= this.bounds.scanDepth) {
            stopped.add('depth');
            continue;
          }
          queue.push({
            absolute: path.join(next.absolute, name),
            folder: {
              display: joinPath(next.folder.display, name),
              parent: next.folder,
              markdownFiles: 0,
              textFiles: 0,
              sampleNames: [],
              hasFilesBelow: false
            },
            depth: next.depth + 1
          });
          continue;
        }
        if ((type & FileType.File) === 0) {
          continue;
        }
        const lower = name.toLowerCase();
        const markdown = lower.endsWith('.md');
        if (!markdown && !lower.endsWith('.txt')) {
          continue;
        }
        if (markdown) {
          next.folder.markdownFiles += 1;
        } else {
          next.folder.textFiles += 1;
        }
        if (next.folder.sampleNames.length < this.bounds.sampleNames) {
          next.folder.sampleNames.push(cutName(name, this.bounds.sampleNameCharacters));
        }
      }
    }

    for (const folder of scanned) {
      if (folder.markdownFiles + folder.textFiles === 0) {
        continue;
      }
      for (let up = folder.parent; up && !up.hasFilesBelow; up = up.parent) {
        up.hasFilesBelow = true;
      }
    }
    const kept = scanned.filter((folder) => folder.markdownFiles + folder.textFiles > 0 || folder.hasFilesBelow);
    if (kept.length > this.bounds.scanFolders) {
      stopped.add('folders');
    }
    const folders = kept.slice(0, this.bounds.scanFolders).map((folder): ProjectFolderSummary => ({
      path: folder.display,
      markdownFiles: folder.markdownFiles,
      textFiles: folder.textFiles,
      sampleNames: [...folder.sampleNames]
    }));
    this.log.appendLine(
      `${LOG} ${entriesRead} entries read, ${scanned.length} folders listed, ${folders.length} kept`
      + `${unreadable > 0 ? `, ${unreadable} unreadable` : ''}${stopped.size > 0 ? `, stopped at ${[...stopped].join(', ')}` : ''}`
    );
    return { folders, entriesRead, stopped: [...stopped], unreadable };
  }
}
