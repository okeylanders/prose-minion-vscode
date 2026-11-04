/**
 * The project memory folder's files (epic 2026-11-04, Slice 1): their
 * names, the folder read whole, and each file decoded. Split from
 * `ProjectMemoryStore`, which owns the queue and calls this inside it.
 *
 * - **Names.** A new memory's file is `<slug>-<short id>.md`: the title's
 *   slug at creation (ASCII letters and digits, at most `SLUG_CHARACTERS`)
 *   and the six hex digits of its id. A file is never renamed (a title edit
 *   is a rewrite in place), and its identity is never read from its name:
 *   a file is found by the id it holds, so one the writer renamed or made
 *   by hand reads as well.
 * - **What is listed.** Every `*.md` file of the folder but `INDEX.md`
 *   (derived for the writer, never read back) and hidden files (a write's
 *   staging, a claim). A folder that is not there holds nothing; one that
 *   cannot be read is `unknown`, never empty.
 * - **One bad file never fails the folder.** A file too large, not UTF-8,
 *   or not format 1 is listed as unreadable with its reason. Two readable
 *   files with one id (a copied file) are a **conflict**: both are listed
 *   together, neither is read as a memory. Unreadable and conflicting files
 *   are never rewritten or deleted. Not recursive.
 * - **Held files.** A file a live claim holds (another window rewriting or
 *   deleting it) is not standing; its claim is read, so the listing can say
 *   which memory is busy.
 * - **Logs** never name a file (`projectMemoryLogName`): its slug is the
 *   writer's text, and identity is never read from a name. The store's own
 *   lines name memories by id.
 */

import * as path from 'node:path';
import { FileType, type FileSystem } from '@/platform';
import { PROJECT_MEMORY_FILE_BYTES, type ProjectMemory } from '@shared/types/projectMemory';
import { decodeProjectMemory, type ProjectMemoryInvalidReason, type ProjectMemoryKey } from '@/infrastructure/storage/ProjectMemoryCodec';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';
import { storedFileExists } from '@/infrastructure/storage/StoredFileClaims';

/** The folder, from the workspace's one root. */
export const PROJECT_MEMORY_DISPLAY_PATH = 'prose-minion/memory';

/**
 * A claim on a memory file: its saved name, hidden, then when it was taken
 * and the writer's id (`StoredFileClaims`). The saved name's extension is
 * matched in any case, as `isMemoryFileName` lists it (PR #194 F-03), so a
 * claim on `note.MD` is seen, kept busy and put back like one on `note.md`.
 */
export const PROJECT_MEMORY_CLAIM = /^\.([^/\\]+\.[Mm][Dd])\.claim-(\d{13})-[A-Za-z0-9-]+$/;

const SLUG_CHARACTERS = 48;
const INDEX_FILE = 'index.md';

export type ProjectMemoryUnreadableReason =
  | ProjectMemoryInvalidReason
  /** Larger than `PROJECT_MEMORY_FILE_BYTES`. */
  | 'too-large'
  /** Not UTF-8 text. */
  | 'not-text'
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

/** Readable files that hold one id (the writer copied a file): neither is read as a memory. */
export interface ProjectMemoryConflict {
  readonly id: string;
  readonly fileNames: readonly string[];
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
    /** Ids more than one readable file holds, by id. */
    conflicts: ProjectMemoryConflict[];
  }
  | { kind: 'unknown' };

/** Read every memory file of `folder`, each decoded; files sorted by name. */
export async function readProjectMemoryFolder(fileSystem: FileSystem, folder: string): Promise<ProjectMemoryFolderRead> {
  let entries: Array<[string, FileType]>;
  try {
    entries = await fileSystem.readDirectory(folder);
  } catch (error) {
    return isMissingFileSystemPathError(error)
      ? { kind: 'read', files: [], unreadable: [], held: [], claimed: false, moved: false, conflicts: [] }
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
    } else if ((counts.get(result.memory.id) ?? 0) <= 1) {
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
  const conflicts = [...counts].filter(([, count]) => count > 1).map(([id]) => id).sort().map((id) => ({
    id,
    fileNames: read.flatMap((result) => ('memory' in result && result.memory.id === id ? [result.fileName] : []))
  }));
  return { kind: 'read', files, unreadable, held, claimed: claims.length > 0, moved, conflicts };
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

/** A file or a claim as a log line names it: never by its name, whose slug is the writer's text. */
export function projectMemoryLogName(): string {
  return 'a memory file';
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
  const decoded = decodeProjectMemoryBytes(bytes);
  if (decoded.kind === 'unreadable') {
    return decoded.key ? { fileName, reason: decoded.reason, key: decoded.key } : { fileName, reason: decoded.reason };
  }
  return { fileName, memory: decoded.memory, bytes };
}

/** A memory file's bytes, read as a listing reads them: within the byte bound, UTF-8, format 1. */
export function decodeProjectMemoryBytes(bytes: Uint8Array):
  | { kind: 'memory'; memory: ProjectMemory }
  | { kind: 'unreadable'; reason: Exclude<ProjectMemoryUnreadableReason, 'read-failed'>; key?: ProjectMemoryKey } {
  if (bytes.byteLength > PROJECT_MEMORY_FILE_BYTES) {
    return { kind: 'unreadable', reason: 'too-large' };
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { kind: 'unreadable', reason: 'not-text' };
  }
  const decoded = decodeProjectMemory(text);
  if (decoded.kind === 'invalid') {
    return decoded.key ? { kind: 'unreadable', reason: decoded.reason, key: decoded.key } : { kind: 'unreadable', reason: decoded.reason };
  }
  return { kind: 'memory', memory: decoded.memory };
}
