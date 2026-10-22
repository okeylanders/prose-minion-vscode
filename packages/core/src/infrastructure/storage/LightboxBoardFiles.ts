/**
 * The saved boards' files: where a source's boards live, how a file id names
 * one, and how a folder is read and listed (ADR 2026-10-19 D12 addendum;
 * Slice 5A). Split from `LightboxBoardStore`, which owns the queue, the
 * writes and the reload pointer; this module reads, and never writes.
 *
 * - **One folder per source.** `prose-minion/boards/<source-slug>-<source-hash>/`:
 *   the slug is the source's path in `[a-z0-9-]`, for the writer to read; the
 *   hash is the first eight hex digits of the SHA-256 of the source's
 *   portable key, so two sources whose paths slug alike never share a folder
 *   (PR #163 F-04). Listings still filter by the key.
 * - **Complete listings.** A source's folder is read whole: every board in
 *   it is listed, newest first, and every file that does not read as a board
 *   is counted. A summary is read once per file size and modification time.
 *   Nothing is hidden by a cap; the rail pages what it shows, and says so.
 * - **Logs** carry file ids, counts and reasons, never the writer's text.
 */

import { createHash } from 'node:crypto';
import * as path from 'node:path';
import type { LightboxLensId, LightboxReadingGroup, LightboxSource } from '@messages';
import { FileType, type FileSystem, type LogSink } from '@/platform';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import {
  LIGHTBOX_BOARD_INVALID_REASONS,
  decodeLightboxBoardFile,
  type LightboxBoardFile
} from '@/infrastructure/storage/LightboxBoardCodec';

const decoder = new TextDecoder();
const LOG = '[LightboxBoardStore]';

/** Where boards are saved, as the rail names it. */
export const LIGHTBOX_BOARDS_DISPLAY_PATH = 'prose-minion/boards';
/** A file id: a source's folder and a timestamped name, both the host's own. */
export const LIGHTBOX_BOARD_FILE_ID = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json)$/;
const FILE_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json$/;
/**
 * A file a rewrite in place holds while it writes (Slice 5A.1): the saved
 * file's own name, hidden, then the writer's private id. Never listed.
 */
export const LIGHTBOX_BOARD_CLAIM = /^\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json)\.claim-[A-Za-z0-9-]+$/;

/** Which source a saved board belongs to, portably: its kind, its workspace-relative path and, for a selection, its lines. */
export type LightboxSavedSourceRef = Pick<LightboxSource, 'kind' | 'displayPath' | 'startLine' | 'endLine'>;

/** One readable file of a source's folder, summarised. */
export interface LightboxSavedBoardEntry {
  fileId: string;
  /** The writer's name for the board (Slice 5A.1). Writer text: never logged. */
  name?: string;
  savedAt: number;
  /** `lightboxSavedSourceKey` of the board's first source. */
  sourceKey: string;
  contentHash: string;
  wordCount: number;
  lenses: LightboxLensId[];
  staleLenses: LightboxLensId[];
  costUsd?: number;
  /** The models its groups' calls reported, once each, in group order; empty for a board no model read. */
  models: string[];
}

export interface LightboxBoardListing {
  /** The source's saved boards, every one, newest first. */
  entries: LightboxSavedBoardEntry[];
  /** Files in the source's folder that could not be read as boards; left as they are. */
  unreadable: number;
  /**
   * Claims whose saved name stands empty (Slice 5A.1): a rewrite in place
   * that stopped midway left its board under a hidden name. Present only
   * when there are some; the store puts them back and lists again.
   */
  leftClaims?: string[];
}

export type LightboxBoardRead =
  | { kind: 'board'; fileId: string; file: LightboxBoardFile; dropped: number; droppedAt: string[] }
  | { kind: 'missing' }
  /** `reason` is host words (`LIGHTBOX_BOARD_INVALID_REASONS`, or the store's own). */
  | { kind: 'unreadable'; reason: string }
  | { kind: 'unavailable' };

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

/** A source's path in `[a-z0-9-]` only, for the writer to read: it can never leave the boards folder. */
export function lightboxBoardSlug(source: LightboxSavedSourceRef): string {
  // Letters lose their accents (NFKD, then the combining marks), and every other run of characters becomes one hyphen.
  const words = source.displayPath.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = words.slice(0, 80).replace(/-+$/, '') || 'untitled';
  return source.kind === 'selection' ? `${base}-lines-${source.startLine ?? 0}-${source.endLine ?? 0}` : base;
}

/** The folder a source's boards are kept in: its slug, then a short hash of its key, so no two sources share one. */
export function lightboxBoardFolder(source: LightboxSavedSourceRef): string {
  const hash = createHash('sha256').update(lightboxSavedSourceKey(source), 'utf8').digest('hex').slice(0, 8);
  return `${lightboxBoardSlug(source)}-${hash}`;
}

/** The path a file id names, inside the boards folder, or undefined for an id that is not the host's. */
export function lightboxBoardFilePath(directory: string, fileId: string): string | undefined {
  const match = LIGHTBOX_BOARD_FILE_ID.exec(fileId);
  if (!match) {
    return undefined;
  }
  const filePath = path.join(directory, match[1], match[2]);
  return isPathWithinRoot(directory, filePath) ? filePath : undefined;
}

/** Reads saved boards: one file, or one source's folder whole. Writes nothing. */
export class LightboxBoardFiles {
  private readonly summaries = new Map<string, CachedSummary>();

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly log: LogSink,
    private readonly maximumFileBytes: number
  ) {}

  /** A saved board's file, decoded. */
  async read(fileId: string, filePath: string): Promise<LightboxBoardRead> {
    return (await this.readWithBytes(fileId, filePath)).read;
  }

  /** A saved board's file, decoded, with the bytes it was decoded from (a rewrite in place compares them). */
  async readWithBytes(fileId: string, filePath: string): Promise<{ read: LightboxBoardRead; bytes?: Uint8Array }> {
    let bytes: Uint8Array;
    try {
      const stat = await this.fileSystem.stat(filePath);
      if (stat.size > this.maximumFileBytes) {
        return { read: { kind: 'unreadable', reason: 'It is larger than a saved board can be.' } };
      }
      bytes = await this.fileSystem.readFile(filePath);
    } catch (error) {
      if (isMissingFileSystemPathError(error)) {
        return { read: { kind: 'missing' } };
      }
      this.log.appendLine(`${LOG} Could not read ${fileId}: ${errorMessage(error)}`);
      return { read: { kind: 'unreadable', reason: 'It could not be read.' } };
    }
    return { read: this.decode(fileId, bytes), bytes };
  }

  private decode(fileId: string, bytes: Uint8Array): LightboxBoardRead {
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

  /** Every readable board of `source` in its folder, newest first, and how many files there could not be read. */
  async list(directory: string, source: LightboxSavedSourceRef): Promise<LightboxBoardListing> {
    const folderName = lightboxBoardFolder(source);
    const folder = path.join(directory, folderName);
    let onDisk: Array<[string, FileType]>;
    try {
      onDisk = (await this.fileSystem.readDirectory(folder)).filter(([, type]) => type === FileType.File);
    } catch (error) {
      if (!isMissingFileSystemPathError(error)) {
        this.log.appendLine(`${LOG} Could not list ${LIGHTBOX_BOARDS_DISPLAY_PATH}/${folderName}: ${errorMessage(error)}`);
      }
      return { entries: [], unreadable: 0 };
    }
    const names = onDisk.map(([name]) => name).filter((name) => FILE_NAME.test(name));
    const leftClaims = onDisk.map(([name]) => name).filter((name) => {
      const saved = LIGHTBOX_BOARD_CLAIM.exec(name)?.[1];
      return saved !== undefined && !names.includes(saved);
    });
    const key = lightboxSavedSourceKey(source);
    const entries: LightboxSavedBoardEntry[] = [];
    let unreadable = 0;
    for (const name of names.sort().reverse()) {
      const summary = await this.summaryOf(`${folderName}/${name}`, path.join(folder, name));
      if (summary === 'unreadable') {
        unreadable += 1;
      } else if (summary?.sourceKey === key) {
        entries.push(summary);
      }
    }
    entries.sort((left, right) => right.savedAt - left.savedAt || (left.fileId < right.fileId ? 1 : -1));
    return { entries, unreadable, ...(leftClaims.length > 0 ? { leftClaims } : {}) };
  }

  /** A deleted file's summary is forgotten. */
  forget(fileId: string): void {
    this.summaries.delete(fileId);
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
    const read = await this.read(fileId, filePath);
    if (read.kind === 'missing' || read.kind === 'unavailable') {
      return undefined;
    }
    const entry = read.kind === 'board' ? summarise(fileId, read.file) : 'unreadable';
    this.summaries.set(fileId, { size: stat.size, mtime: stat.mtime, entry });
    return entry;
  }
}

/** A saved board as the rail lists it: its name, when, its words, the lenses read (and which are stale), its cost and its models. */
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
    ...(board.name !== undefined ? { name: board.name } : {}),
    savedAt: Date.parse(file.savedAt),
    sourceKey: lightboxSavedSourceKey(source),
    contentHash: source.contentHash,
    wordCount: board.sources.reduce((sum, entry) => sum + entry.wordCount, 0),
    lenses,
    staleLenses: lenses.filter((lens) => stale.has(lens)),
    // Summed to the micro-dollar: the rail shows an approximate cost.
    ...(costs.length > 0 ? { costUsd: Math.round(costs.reduce((sum, cost) => sum + cost, 0) * 1e6) / 1e6 } : {}),
    // The provider-reported model of each group that has one, once each.
    models: [...new Set(board.readings.flatMap((group) => (group.model ? [group.model] : [])))]
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
