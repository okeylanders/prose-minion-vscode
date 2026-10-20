/**
 * LightboxWriterBaseline — the writer's own average, for "What stands out in
 * the numbers" (Slice 4B; ADR 2026-10-19 D5). Built once at the composition
 * root and given to `LightboxService`. Deterministic: no model, no network.
 *
 * - **Source.** The configured resources catalog the project picker browses
 *   (`WorkshopContextIntakeService.openCatalog`): the `chapters` group's
 *   Markdown and text files, or the `manuscript` group's when `chapters` has
 *   none. The board's own file is left out, so the comparison is this
 *   chapter against the rest. (A whole-book manuscript file that also holds
 *   this chapter cannot be split, so the chapter then counts once inside it.)
 * - **Bounded.** At most `LIGHTBOX_BASELINE_FILES` files, in path order,
 *   each at most `LIGHTBOX_BASELINE_FILE_BYTES`. Files are read whole, and
 *   no file is started once `LIGHTBOX_BASELINE_WORDS` words are counted, so
 *   the last file read can carry the total past that bound (by less than one
 *   file). The summary says how many files and words were used, and is
 *   `capped` whenever a bound limited the reading: files left unread, or the
 *   words read past the word bound (PR #155).
 * - **Cached.** Each file's counts are kept by absolute path, with its size
 *   and modified time, so measuring again reads only files that changed.
 * - **Measured** with the board's own detectors (`countLightboxFigures`).
 * - **Absent** with a host-owned note when there is nothing to read or the
 *   catalog cannot be read. A file that cannot be read is skipped.
 *
 * Logs name counts and outcomes, never a file's text or a path's contents.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FileSystem, LogSink } from '@/platform';
import { FileType } from '@/platform';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { isLightboxTextFile } from '@shared/constants/lightbox';
import { splitLightboxParagraphs } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  addLightboxFigureCounts,
  countLightboxFigures,
  emptyLightboxFigureCounts,
  LIGHTBOX_BASELINE_NOTES,
  type LightboxFigureCounts,
  type LightboxWriterAverages
} from '@/infrastructure/lightbox/LightboxNumbers';

export const LIGHTBOX_BASELINE_FILES = 40;
export const LIGHTBOX_BASELINE_FILE_BYTES = 1_000_000;
export const LIGHTBOX_BASELINE_WORDS = 300_000;
/** Files whose counts are kept between measures. */
const CACHE_ENTRIES = 200;

/** What the board's own source is, so it is left out of its average. */
export interface LightboxBaselineExclusion {
  absolutePath?: string;
  sourceUri?: string;
}

export interface LightboxWriterBaselinePorts {
  catalog: Pick<WorkshopContextIntakeService, 'openCatalog'>;
  fileSystem: Pick<FileSystem, 'stat' | 'readFile'>;
  outputChannel: LogSink;
}


interface CachedFile {
  size: number;
  mtime: number;
  counts: LightboxFigureCounts;
}

const LOG = '[LightboxWriterBaseline]';

export class LightboxWriterBaseline {
  private readonly cache = new Map<string, CachedFile>();

  constructor(private readonly ports: LightboxWriterBaselinePorts) {}

  /** The writer's average over their other chapters, or why there is none. */
  async measure(exclude: LightboxBaselineExclusion = {}): Promise<LightboxWriterAverages> {
    let entries;
    try {
      entries = (await this.ports.catalog.openCatalog()).entries();
    } catch {
      this.ports.outputChannel.appendLine(`${LOG} The configured resources catalog could not be read`);
      return { summary: { kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.unreadable } };
    }
    const excluded = exclusionPath(exclude);
    const ofGroup = (group: 'chapters' | 'manuscript') => entries
      .filter((entry) => entry.group === group && isLightboxTextFile(entry.path))
      .filter((entry) => !excluded || !samePath(entry.absolutePath, excluded))
      .sort((a, b) => a.path.localeCompare(b.path));
    const chapters = ofGroup('chapters');
    const group = chapters.length > 0 ? 'chapters' : 'manuscript';
    const files = chapters.length > 0 ? chapters : ofGroup('manuscript');
    if (files.length === 0) {
      return { summary: { kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.noFiles } };
    }

    const counts = emptyLightboxFigureCounts();
    let used = 0;
    let capped = files.length > LIGHTBOX_BASELINE_FILES;
    let skipped = 0;
    for (const file of files.slice(0, LIGHTBOX_BASELINE_FILES)) {
      if (counts.words >= LIGHTBOX_BASELINE_WORDS) {
        capped = true;
        break;
      }
      const measured = await this.countsOf(file.absolutePath);
      if (!measured) {
        skipped += 1;
        continue;
      }
      addLightboxFigureCounts(counts, measured);
      used += 1;
    }
    // Files are read whole: the last one may have carried the total past the word bound.
    capped = capped || counts.words > LIGHTBOX_BASELINE_WORDS;
    this.ports.outputChannel.appendLine(
      `${LOG} ${group}: ${used} file(s), ${counts.words} words` +
        (skipped > 0 ? `, ${skipped} skipped` : '') + (capped ? ', capped' : '')
    );
    if (used === 0) {
      return { summary: { kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.nothingRead } };
    }
    return { summary: { kind: 'measured', group, files: used, words: counts.words, capped }, counts };
  }

  /** One file's counts, from the cache when its size and time are unchanged; undefined when it cannot be read. */
  private async countsOf(absolutePath: string): Promise<LightboxFigureCounts | undefined> {
    try {
      const stat = await this.ports.fileSystem.stat(absolutePath);
      if (stat.type !== FileType.File || stat.size > LIGHTBOX_BASELINE_FILE_BYTES) {
        return undefined;
      }
      const cached = this.cache.get(absolutePath);
      if (cached && cached.size === stat.size && cached.mtime === stat.mtime) {
        return cached.counts;
      }
      const text = new TextDecoder('utf-8').decode(await this.ports.fileSystem.readFile(absolutePath)).replace(/^﻿/, '');
      const counts = countLightboxFigures(text, splitLightboxParagraphs(text).map((paragraph) => paragraph.text));
      this.cache.delete(absolutePath);
      this.cache.set(absolutePath, { size: stat.size, mtime: stat.mtime, counts });
      while (this.cache.size > CACHE_ENTRIES) {
        this.cache.delete(this.cache.keys().next().value as string);
      }
      return counts;
    } catch {
      return undefined;
    }
  }
}

function exclusionPath(exclude: LightboxBaselineExclusion): string | undefined {
  if (exclude.absolutePath) {
    return exclude.absolutePath;
  }
  if (exclude.sourceUri?.startsWith('file:')) {
    try {
      return fileURLToPath(exclude.sourceUri);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The same file: equal normalized paths, or equal ignoring case (a case-insensitive file system). */
function samePath(a: string, b: string): boolean {
  const left = path.normalize(a);
  const right = path.normalize(b);
  return left === right || left.toLowerCase() === right.toLowerCase();
}
