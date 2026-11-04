/**
 * The project memory folder's files (epic 2026-11-04, Slice 1): their
 * names, the folder read whole, and each file decoded. Split from
 * `ProjectMemoryStore`, which owns the queue and calls this inside it.
 *
 * - **Names.** A new memory's file is `<slug>-<short id>.md`: the title's
 *   slug (ASCII letters and digits, at most `SLUG_CHARACTERS`) and the six
 *   hex digits of its id. A file is found by the id it holds, never by its
 *   name, so a file the writer renamed or made by hand reads as well.
 * - **What is listed.** Every `*.md` file of the folder but `INDEX.md`
 *   (derived for the writer, never read back) and hidden files (a write's
 *   staging, a claim). A folder that is not there holds nothing; one that
 *   cannot be read is `unknown`, never empty.
 * - **One bad file never fails the folder.** A file too large, not UTF-8,
 *   or not format 1 is listed as unreadable with its reason; two files with
 *   one id are both unreadable (`duplicate-id`). Unreadable files are never
 *   rewritten or deleted.
 * - **Held files.** A file a live claim holds (another window rewriting or
 *   deleting it) is not standing; its claim is read, so the listing can say
 *   which memory is busy.
 * - **Logs** name a file by its memory id (`projectMemoryLogName`), never
 *   by its name, whose slug is the writer's text.
 */

import * as path from 'node:path';
import { FileType, type FileSystem } from '@/platform';
import type { ProjectMemory } from '@shared/types/projectMemory';
import { decodeProjectMemory, type ProjectMemoryInvalidReason, type ProjectMemoryKey } from '@/infrastructure/storage/ProjectMemoryCodec';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';
import { storedFileExists } from '@/infrastructure/storage/StoredFileClaims';

/** The folder, from the workspace's one root. */
export const PROJECT_MEMORY_DISPLAY_PATH = 'prose-minion/memory';

/** A claim on a memory file: its saved name, hidden, then when it was taken and the writer's id (`StoredFileClaims`). */
export const PROJECT_MEMORY_CLAIM = /^\.([^/\\]+\.md)\.claim-(\d{13})-[A-Za-z0-9-]+$/;

/** A file larger than this is not read (listed as `too-large`). */
export const PROJECT_MEMORY_FILE_BYTES = 256 * 1024;

const SLUG_CHARACTERS = 48;
const INDEX_FILE = 'index.md';

export type ProjectMemoryUnreadableReason =
  | ProjectMemoryInvalidReason
  /** Larger than `PROJECT_MEMORY_FILE_BYTES`. */
  | 'too-large'
  /** Not UTF-8 text. */
  | 'not-text'
  /** Another file holds the same id; neither is read. */
  | 'duplicate-id'
  /** Listed, but could not be read. */
  | 'read-failed';

/** A memory file that reads, with the bytes it was read from (a rewrite claims only these). */
export interface ProjectMemoryFile {
  readonly fileName: string;
  readonly memory: ProjectMemory;
  readonly bytes: Uint8Array;
}

export interface ProjectMemoryUnreadableFile {
  readonly fileName: string;
  readonly reason: ProjectMemoryUnreadableReason;
  /** The format key the fault was found at, when there is one. */
  readonly key?: ProjectMemoryKey;
}

/** A memory another window holds under a live claim now. */
export interface ProjectMemoryHeldFile {
  readonly fileName: string;
  /** The id the claimed file holds, when it reads. */
  readonly id?: string;
}

export type ProjectMemoryFolderRead =
  | {
    kind: 'read';
    files: ProjectMemoryFile[];
    unreadable: ProjectMemoryUnreadableFile[];
    held: ProjectMemoryHeldFile[];
    /** Whether the folder holds claims at all, so the store settles them and reads again. */
    claimed: boolean;
    /** Whether a listed file was gone when it was read (another window moved it): the store reads again. */
    moved: boolean;
    /** The ids more than one file holds (each such file is unreadable, `duplicate-id`). */
    duplicateIds: string[];
  }
  | { kind: 'unknown' };

/** Read every memory file of `folder`, each decoded; files sorted by name. */
export async function readProjectMemoryFolder(fileSystem: FileSystem, folder: string): Promise<ProjectMemoryFolderRead> {
  let entries: Array<[string, FileType]>;
  try {
    entries = await fileSystem.readDirectory(folder);
  } catch (error) {
    return isMissingFileSystemPathError(error)
      ? { kind: 'read', files: [], unreadable: [], held: [], claimed: false, moved: false, duplicateIds: [] }
      : { kind: 'unknown' };
  }
  const names = entries.map(([name]) => name);
  const memoryNames = entries
    .filter(([name, type]) => type === FileType.File && isMemoryFileName(name))
    .map(([name]) => name)
    .sort();
  const read = await Promise.all(memoryNames.map((fileName) => readOne(fileSystem, path.join(folder, fileName), fileName)));
  const counts = new Map<string, number>();
  for (const result of read) {
    if ('memory' in result) {
      counts.set(result.memory.id, (counts.get(result.memory.id) ?? 0) + 1);
    }
  }
  const moved = read.some((result) => 'vanished' in result);
  const files: ProjectMemoryFile[] = [];
  const unreadable: ProjectMemoryUnreadableFile[] = [];
  for (const result of read) {
    if (!('memory' in result)) {
      unreadable.push('key' in result && result.key ? { fileName: result.fileName, reason: result.reason, key: result.key } : { fileName: result.fileName, reason: result.reason });
    } else if ((counts.get(result.memory.id) ?? 0) > 1) {
      unreadable.push({ fileName: result.fileName, reason: 'duplicate-id' });
    } else {
      files.push(result);
    }
  }
  const claims = names.flatMap((name) => {
    const saved = PROJECT_MEMORY_CLAIM.exec(name)?.[1];
    return saved ? [{ claim: name, saved }] : [];
  });
  const held: ProjectMemoryHeldFile[] = [];
  for (const { claim, saved } of claims) {
    if (names.includes(saved) || held.some((entry) => entry.fileName === saved)) {
      continue;
    }
    const claimed = await readOne(fileSystem, path.join(folder, claim), saved);
    held.push('memory' in claimed ? { fileName: saved, id: claimed.memory.id } : { fileName: saved });
  }
  const duplicateIds = [...counts].filter(([, count]) => count > 1).map(([id]) => id).sort();
  return { kind: 'read', files, unreadable, held, claimed: claims.length > 0, moved, duplicateIds };
}

/** Whether `name` is a memory file the folder lists: `*.md`, not hidden, not `INDEX.md`. */
export function isMemoryFileName(name: string): boolean {
  return /\.md$/i.test(name) && !name.startsWith('.') && name.toLowerCase() !== INDEX_FILE;
}

/** A new memory's file name: the title's slug and the id's six hex digits. */
export function projectMemoryFileName(title: string, id: string): string {
  return `${projectMemorySlug(title)}-${id.replace(/^mem-/, '')}.md`;
}

/** The title as ASCII words joined by hyphens; `memory` when none is left. */
export function projectMemorySlug(title: string): string {
  const slug = title.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_CHARACTERS)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : 'memory';
}

/** A file or a claim as a log line names it: by the id its name ends with, never by its slug. */
export function projectMemoryLogName(name: string): string {
  const id = /-([0-9a-f]{6})\.md(?:\.claim-.*)?$/.exec(name)?.[1];
  return id ? `mem-${id}'s file` : 'a memory file';
}

/** `stem.md`, or the first numbered `stem-N.md` free: a claim put back never takes a standing file's name. */
export async function freeProjectMemoryFileName(fileSystem: FileSystem, folder: string, fileName: string): Promise<string> {
  const stem = fileName.replace(/\.md$/i, '');
  for (let attempt = 2; ; attempt++) {
    const name = `${stem}-${attempt}.md`;
    if (!(await storedFileExists(fileSystem, path.join(folder, name)))) {
      return name;
    }
  }
}

type OneRead = ProjectMemoryFile | ProjectMemoryUnreadableFile | { fileName: string; reason: 'read-failed'; vanished: true };

async function readOne(fileSystem: FileSystem, filePath: string, fileName: string): Promise<OneRead> {
  let bytes: Uint8Array;
  try {
    bytes = await fileSystem.readFile(filePath);
  } catch (error) {
    return isMissingFileSystemPathError(error) ? { fileName, reason: 'read-failed', vanished: true } : { fileName, reason: 'read-failed' };
  }
  if (bytes.byteLength > PROJECT_MEMORY_FILE_BYTES) {
    return { fileName, reason: 'too-large' };
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { fileName, reason: 'not-text' };
  }
  const decoded = decodeProjectMemory(text);
  if (decoded.kind === 'invalid') {
    return decoded.key ? { fileName, reason: decoded.reason, key: decoded.key } : { fileName, reason: decoded.reason };
  }
  return { fileName, memory: decoded.memory, bytes };
}
