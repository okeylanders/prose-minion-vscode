/**
 * LightboxBoardStore — saved Lightbox boards on disk (ADR 2026-10-19 D12
 * addendum; Slice 5A; epic decisions 27, 28 and 30). Built once at the
 * composition root and carried in `CoreServices`.
 *
 * - **Where.** `prose-minion/boards/<source-slug>/<timestamp>.board.json`, in
 *   the workspace's one folder. No folder, or several, keeps boards for the
 *   session only, read live on every operation (the rule the Workshop's
 *   project lens library follows, epic decision 28). A slug holds only `[a-z0-9-]`, and
 *   every path is checked with `isPathWithinRoot` before it is touched.
 * - **Writes** run through one queue, so they never interleave, and are
 *   atomic: a board is staged in a temporary sibling, the caller's commit
 *   point (`beforeCommit`) runs synchronously with nothing awaited between it
 *   and the rename, and the rename never overwrites (the
 *   `DictionaryHistoryStore` pattern). `onCommitted` runs synchronously once
 *   the file stands, before the next operation, so what the caller records
 *   about it (the board on screen, the reload pointer) is true for every
 *   later read.
 * - **Never a file it cannot read.** Every save is a new file, and a file
 *   that does not decode is never deleted or overwritten; listings count it.
 *   A board that would not read back whole is not written.
 * - **The reload pointer** is the one new port, `LightboxBoardMemory`: the
 *   workspace's memento in VS Code, holding the file id of the last board
 *   on screen and the folder it belongs to.
 * - **Logs** carry file ids, counts and reasons, never the writer's text.
 */

import * as path from 'node:path';
import type {
  LightboxBoard,
  LightboxBoardsAvailability,
  LightboxLensId,
  LightboxReadingGroup,
  LightboxSource
} from '@messages';
import { FileType, type FileSystem, type LogSink, type Workspace } from '@/platform';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import {
  LIGHTBOX_BOARD_INVALID_REASONS,
  decodeLightboxBoardFile,
  encodeLightboxBoardFile,
  type LightboxBoardFile
} from '@/infrastructure/storage/LightboxBoardCodec';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LOG = '[LightboxBoardStore]';

/** Where boards are saved, as the rail names it. */
export const LIGHTBOX_BOARDS_DISPLAY_PATH = 'prose-minion/boards';
/** The reload pointer's key in the workspace memento. */
export const LIGHTBOX_BOARD_POINTER_KEY = 'proseMinion.lightbox.lastBoardOnScreen';
/** A file id: a slug folder and a timestamped name, both the host's own. */
const FILE_ID = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json)$/;
const FILE_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json$/;

/**
 * The reload pointer's port: a key-value memento scoped to the workspace
 * (`context.workspaceState` in VS Code). Structurally a `vscode.Memento`.
 */
export interface LightboxBoardMemory {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

/** Which source a saved board belongs to, portably: its kind, its workspace-relative path and, for a selection, its lines. */
export type LightboxSavedSourceRef = Pick<LightboxSource, 'kind' | 'displayPath' | 'startLine' | 'endLine'>;

/** One readable file of a source's folder, summarised. */
export interface LightboxSavedBoardEntry {
  fileId: string;
  savedAt: number;
  /** `lightboxSavedSourceKey` of the board's first source. */
  sourceKey: string;
  contentHash: string;
  wordCount: number;
  lenses: LightboxLensId[];
  staleLenses: LightboxLensId[];
  costUsd?: number;
}

export interface LightboxBoardListing {
  /** The source's saved boards, newest first. */
  entries: LightboxSavedBoardEntry[];
  /** Files in the source's folder that could not be read as boards; left as they are. */
  unreadable: number;
}

export type LightboxBoardRead =
  | { kind: 'board'; fileId: string; file: LightboxBoardFile; dropped: number; droppedAt: string[] }
  | { kind: 'missing' }
  /** `reason` is host words (`LIGHTBOX_BOARD_INVALID_REASONS`, or the store's own). */
  | { kind: 'unreadable'; reason: string }
  | { kind: 'unavailable' };

export type LightboxBoardSaveResult =
  | { kind: 'saved'; fileId: string }
  /** `onlyIfNewText`: a saved board of this source already holds this text; the newest such. */
  | { kind: 'held'; fileId: string }
  /** The commit point declined it; nothing was written. */
  | { kind: 'withdrawn' }
  | { kind: 'session' }
  | { kind: 'failed' };

export type LightboxBoardDeleteResult = { kind: 'deleted' } | { kind: 'missing' } | { kind: 'unreadable' } | { kind: 'unavailable' } | { kind: 'failed' };

export interface LightboxBoardSaveInput {
  board: LightboxBoard;
  /** The text the board was measured from. */
  text: string;
}

export interface LightboxBoardSaveOptions {
  /** Save only when no saved board of the source holds this text (a source's first measured board). */
  onlyIfNewText?: boolean;
  /** The commit point: called synchronously after staging, immediately before the rename. `false` withdraws the save. */
  beforeCommit?: () => boolean;
  /** Called synchronously once the file stands, before the store's next operation. */
  onCommitted?: (fileId: string) => void;
}

export interface LightboxBoardStoreOptions {
  memory?: LightboxBoardMemory;
  now?: () => Date;
  /** A file larger than this is not read (counted unreadable). */
  maximumFileBytes?: number;
  /** At most this many files of a folder are read, newest first. */
  maximumListed?: number;
}

type Location =
  | { kind: 'project'; root: string; directory: string }
  | { kind: 'session'; reason: 'no-workspace' | 'multi-root' };

interface CachedSummary {
  size: number;
  mtime: number;
  entry: LightboxSavedBoardEntry | 'unreadable';
}

/** Portable identity of a saved board's source: one folder's file, by its workspace-relative path. */
export function lightboxSavedSourceKey(source: LightboxSavedSourceRef): string {
  return source.kind === 'selection'
    ? `selection:${source.displayPath}:${source.startLine ?? ''}-${source.endLine ?? ''}`
    : `file:${source.displayPath}`;
}

/** The folder a source's boards are kept in: its path in `[a-z0-9-]` only, so it can never leave the boards folder. */
export function lightboxBoardSlug(source: LightboxSavedSourceRef): string {
  // Letters lose their accents (NFKD, then the combining marks), and every other run of characters becomes one hyphen.
  const words = source.displayPath.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = words.slice(0, 80).replace(/-+$/, '') || 'untitled';
  return source.kind === 'selection' ? `${base}-lines-${source.startLine ?? 0}-${source.endLine ?? 0}` : base;
}

export class LightboxBoardStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly summaries = new Map<string, CachedSummary>();
  private readonly now: () => Date;
  private readonly maximumFileBytes: number;
  private readonly maximumListed: number;
  private lastSaveFailed = false;
  private temporaryCounter = 0;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    private readonly options: LightboxBoardStoreOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.maximumFileBytes = options.maximumFileBytes ?? 32 * 1024 * 1024;
    this.maximumListed = options.maximumListed ?? 200;
  }

  /** Where boards are saved now, read live. */
  availability(): LightboxBoardsAvailability {
    const location = this.location();
    return location.kind === 'session'
      ? { kind: 'session', reason: location.reason }
      : { kind: 'project', displayPath: LIGHTBOX_BOARDS_DISPLAY_PATH, lastSaveFailed: this.lastSaveFailed };
  }

  /** The source's saved boards, newest first, and how many files of its folder could not be read. */
  list(source: LightboxSavedSourceRef): Promise<LightboxBoardListing> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { entries: [], unreadable: 0 };
      }
      const key = lightboxSavedSourceKey(source);
      const listing = await this.readFolder(location, lightboxBoardSlug(source));
      return { entries: listing.entries.filter((entry) => entry.sourceKey === key), unreadable: listing.unreadable };
    });
  }

  /** A saved board's file, decoded. */
  read(fileId: string): Promise<LightboxBoardRead> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'unavailable' };
      }
      const filePath = this.pathOf(location, fileId);
      if (!filePath) {
        return { kind: 'missing' };
      }
      return this.readFile(fileId, filePath);
    });
  }

  /** Write a new file holding the board: staged, then committed by a rename that never overwrites. */
  save(input: LightboxBoardSaveInput, options: LightboxBoardSaveOptions = {}): Promise<LightboxBoardSaveResult> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'session' };
      }
      const slug = lightboxBoardSlug(input.board.source);
      if (options.onlyIfNewText) {
        const key = lightboxSavedSourceKey(input.board.source);
        const same = (await this.readFolder(location, slug)).entries
          .find((entry) => entry.sourceKey === key && entry.contentHash === input.board.source.contentHash);
        if (same) {
          return { kind: 'held', fileId: same.fileId };
        }
      }
      const savedAt = this.now();
      const json = encodeLightboxBoardFile({ board: input.board, text: input.text, savedAt });
      const check = decodeLightboxBoardFile(json);
      if (check.kind !== 'board' || check.dropped > 0) {
        this.log.appendLine(`${LOG} A board would not read back whole (${check.kind === 'invalid' ? `${check.reason} at ${check.at ?? 'the file'}` : `${check.dropped} parts dropped`}); it was not saved.`);
        return { kind: 'failed' };
      }
      return this.writeNew(location, slug, savedAt, encoder.encode(json), options);
    });
  }

  /** Delete a saved board's file, if it reads as one; a file that does not is left as it is. */
  delete(fileId: string): Promise<LightboxBoardDeleteResult> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'unavailable' };
      }
      const filePath = this.pathOf(location, fileId);
      if (!filePath) {
        return { kind: 'missing' };
      }
      const read = await this.readFile(fileId, filePath);
      if (read.kind !== 'board') {
        return { kind: read.kind === 'missing' ? 'missing' : 'unreadable' };
      }
      try {
        await this.fileSystem.delete(filePath);
      } catch (error) {
        this.log.appendLine(`${LOG} Could not delete ${fileId}: ${errorMessage(error)}`);
        return { kind: 'failed' };
      }
      this.summaries.delete(fileId);
      if (this.lastOnScreen() === fileId) {
        this.rememberOnScreen(undefined);
      }
      this.log.appendLine(`${LOG} Deleted ${fileId}.`);
      return { kind: 'deleted' };
    });
  }

  /** The file id of the last board on screen in this folder, if one was recorded. */
  lastOnScreen(): string | undefined {
    const location = this.location();
    const recorded = this.options.memory?.get<{ root?: unknown; fileId?: unknown }>(LIGHTBOX_BOARD_POINTER_KEY);
    return location.kind === 'project' && recorded?.root === location.root && typeof recorded.fileId === 'string' && FILE_ID.test(recorded.fileId)
      ? recorded.fileId
      : undefined;
  }

  /** Record the file holding the board on screen (or none), for a reload to reopen. */
  rememberOnScreen(fileId: string | undefined): void {
    const location = this.location();
    const memory = this.options.memory;
    if (location.kind !== 'project' || !memory || this.lastOnScreen() === fileId) {
      return;
    }
    Promise.resolve(memory.update(LIGHTBOX_BOARD_POINTER_KEY, fileId ? { root: location.root, fileId } : undefined))
      .catch((error: unknown) => this.log.appendLine(`${LOG} Could not record the board on screen: ${errorMessage(error)}`));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private location(): Location {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {
      return { kind: 'session', reason: 'no-workspace' };
    }
    if (folders.length !== 1) {
      return { kind: 'session', reason: 'multi-root' };
    }
    return { kind: 'project', root: folders[0].path, directory: path.join(folders[0].path, 'prose-minion', 'boards') };
  }

  /** The path a file id names, inside the boards folder, or undefined for an id that is not the host's. */
  private pathOf(location: Extract<Location, { kind: 'project' }>, fileId: string): string | undefined {
    const match = FILE_ID.exec(fileId);
    if (!match) {
      return undefined;
    }
    const filePath = path.join(location.directory, match[1], match[2]);
    return isPathWithinRoot(location.directory, filePath) ? filePath : undefined;
  }

  private async readFile(fileId: string, filePath: string): Promise<LightboxBoardRead> {
    let bytes: Uint8Array;
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (stat.size > this.maximumFileBytes) {
        return { kind: 'unreadable', reason: 'It is larger than a saved board can be.' };
      }
      bytes = await this.fileSystem.readFile(filePath);
    } catch (error) {
      if (isMissingFileSystemPathError(error)) {
        return { kind: 'missing' };
      }
      this.log.appendLine(`${LOG} Could not read ${fileId}: ${errorMessage(error)}`);
      return { kind: 'unreadable', reason: 'It could not be read.' };
    }
    const decoded = decodeLightboxBoardFile(decoder.decode(bytes));
    if (decoded.kind === 'invalid') {
      this.log.appendLine(`${LOG} ${fileId} is not read: ${decoded.reason}${decoded.at ? ` at ${decoded.at}` : ''}` +
        `${decoded.formatVersion !== undefined ? ` (format ${decoded.formatVersion})` : ''}.`);
      return { kind: 'unreadable', reason: LIGHTBOX_BOARD_INVALID_REASONS[decoded.reason] };
    }
    if (decoded.dropped > 0) {
      this.log.appendLine(`${LOG} ${fileId}: ${decoded.dropped} parts could not be read and were left out (${decoded.droppedAt.join(', ')}).`);
    }
    return { kind: 'board', fileId, file: decoded.file, dropped: decoded.dropped, droppedAt: decoded.droppedAt };
  }

  /** A slug folder's readable boards, newest first, each read once per size and modification time. */
  private async readFolder(location: Extract<Location, { kind: 'project' }>, slug: string): Promise<LightboxBoardListing> {
    const folder = path.join(location.directory, slug);
    let names: string[];
    try {
      names = (await this.fileSystem.readDirectory(folder))
        .filter(([name, type]) => type === FileType.File && FILE_NAME.test(name))
        .map(([name]) => name);
    } catch (error) {
      if (!isMissingFileSystemPathError(error)) {
        this.log.appendLine(`${LOG} Could not list ${LIGHTBOX_BOARDS_DISPLAY_PATH}/${slug}: ${errorMessage(error)}`);
      }
      return { entries: [], unreadable: 0 };
    }
    const entries: LightboxSavedBoardEntry[] = [];
    let unreadable = 0;
    for (const name of names.sort().reverse().slice(0, this.maximumListed)) {
      const fileId = `${slug}/${name}`;
      const summary = await this.summaryOf(fileId, path.join(folder, name));
      if (summary === 'unreadable') {
        unreadable += 1;
      } else if (summary) {
        entries.push(summary);
      }
    }
    entries.sort((left, right) => right.savedAt - left.savedAt || (left.fileId < right.fileId ? 1 : -1));
    return { entries, unreadable };
  }

  private async summaryOf(fileId: string, filePath: string): Promise<LightboxSavedBoardEntry | 'unreadable' | undefined> {
    let stat: { size: number; mtime: number };
    try {
      stat = await this.fileSystem.stat(filePath);
    } catch {
      return undefined;
    }
    const cached = this.summaries.get(fileId);
    if (cached && cached.size === stat.size && cached.mtime === stat.mtime) {
      return cached.entry;
    }
    const read = await this.readFile(fileId, filePath);
    if (read.kind === 'missing' || read.kind === 'unavailable') {
      return undefined;
    }
    const entry = read.kind === 'board' ? summarise(fileId, read.file) : 'unreadable';
    this.summaries.set(fileId, { size: stat.size, mtime: stat.mtime, entry });
    return entry;
  }

  private async writeNew(
    location: Extract<Location, { kind: 'project' }>,
    slug: string,
    savedAt: Date,
    bytes: Uint8Array,
    options: LightboxBoardSaveOptions
  ): Promise<LightboxBoardSaveResult> {
    const folder = path.join(location.directory, slug);
    const name = await this.freeName(folder, savedAt);
    const fileId = `${slug}/${name}`;
    const finalPath = path.join(folder, name);
    const temporaryPath = path.join(folder, `.${name}.tmp-${++this.temporaryCounter}`);
    if (!isPathWithinRoot(location.directory, finalPath) || !isPathWithinRoot(location.directory, temporaryPath)) {
      this.log.appendLine(`${LOG} Refused to write outside ${LIGHTBOX_BOARDS_DISPLAY_PATH}.`);
      return { kind: 'failed' };
    }
    try {
      await this.fileSystem.createDirectory(folder);
      await this.fileSystem.writeFile(temporaryPath, bytes);
    } catch (error) {
      return this.failWrite(temporaryPath, error);
    }
    // The commit point: nothing is awaited between it and the rename that commits.
    if (options.beforeCommit && !options.beforeCommit()) {
      await this.deleteQuietly(temporaryPath);
      return { kind: 'withdrawn' };
    }
    try {
      await this.fileSystem.rename(temporaryPath, finalPath, { overwrite: false });
    } catch (error) {
      return this.failWrite(temporaryPath, error);
    }
    if (this.lastSaveFailed) {
      this.log.appendLine(`${LOG} Boards are saved again after an earlier failure.`);
    }
    this.lastSaveFailed = false;
    this.log.appendLine(`${LOG} Saved ${fileId} (${bytes.byteLength} bytes).`);
    options.onCommitted?.(fileId);
    return { kind: 'saved', fileId };
  }

  /** The timestamp's name, or the first numbered one free: a save never takes an existing file's name. */
  private async freeName(folder: string, savedAt: Date): Promise<string> {
    const stamp = savedAt.toISOString().replace(/[:.]/g, '-');
    for (let attempt = 1; ; attempt++) {
      const name = attempt === 1 ? `${stamp}.board.json` : `${stamp}-${attempt}.board.json`;
      try {
        await this.fileSystem.stat(path.join(folder, name));
      } catch {
        return name;
      }
    }
  }

  private async failWrite(temporaryPath: string, error: unknown): Promise<LightboxBoardSaveResult> {
    this.lastSaveFailed = true;
    this.log.appendLine(`${LOG} Could not save a board; it stays for this session: ${errorMessage(error)}`);
    await this.deleteQuietly(temporaryPath);
    return { kind: 'failed' };
  }

  /** Best effort: a leftover temporary file is never read as a board. */
  private async deleteQuietly(filePath: string): Promise<void> {
    try {
      await this.fileSystem.delete(filePath);
    } catch {
      // The write may have failed before the file existed.
    }
  }
}

/** A saved board as the rail lists it: when, its words, the lenses read (and which are stale), and its cost. */
function summarise(fileId: string, file: LightboxBoardFile): LightboxSavedBoardEntry {
  const { board } = file;
  const source = board.sources[0];
  const read = (lens: LightboxLensId, group: LightboxReadingGroup) => group.lenses.includes(lens)
    && (group.tiles.some((tile) => tile.lens === lens) || group.frictions.some((friction) => friction.lens === lens));
  const lenses = LIGHTBOX_LENSES.map((lens) => lens.id).filter((lens) => board.readings.some((group) => read(lens, group)));
  const stale = new Set(board.readings.flatMap((group) => group.staleLenses?.map((mark) => mark.lens) ?? []));
  const costs = board.readings.flatMap((group) => (group.usage?.costUsd !== undefined ? [group.usage.costUsd] : []));
  return {
    fileId,
    savedAt: Date.parse(file.savedAt),
    sourceKey: lightboxSavedSourceKey(source),
    contentHash: source.contentHash,
    wordCount: board.sources.reduce((sum, entry) => sum + entry.wordCount, 0),
    lenses,
    staleLenses: lenses.filter((lens) => stale.has(lens)),
    // Summed to the micro-dollar: the rail shows an approximate cost.
    ...(costs.length > 0 ? { costUsd: Math.round(costs.reduce((sum, cost) => sum + cost, 0) * 1e6) / 1e6 } : {})
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
