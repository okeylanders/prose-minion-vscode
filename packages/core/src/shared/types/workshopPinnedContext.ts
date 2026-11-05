/**
 * Workshop Pinned Context: the files a project attaches to every new
 * Workshop room, in order (ADR 2026-11-04, D5 and D6; epic Slice 1). The
 * list lives in `<workspace>/prose-minion/pinned-context.json`, format 1
 * (`WorkshopPinnedContextCodec`). Slice 2b's library and match rule, and
 * Slice 3's messages, read these shapes from here.
 *
 * The list is writer data: the writer may edit the file by hand, and a
 * released change to its meaning takes a new `format` (ADR 2026-07-30's
 * release rule).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/** The one format this build reads and writes. */
export const WORKSHOP_PINNED_CONTEXT_FORMAT = 1;

/** The most files the list holds (D6); a longer file is unreadable whole. */
export const WORKSHOP_PINNED_CONTEXT_FILES = PROMPT_BUDGETS.workshopPinnedContext.files;

/** The largest file read or written; a larger one is unreadable whole (`too-large`). */
export const WORKSHOP_PINNED_CONTEXT_FILE_BYTES = PROMPT_BUDGETS.workshopPinnedContext.fileBytes;

/** Where the list lives, relative to the workspace folder, as the tab names it. */
export const WORKSHOP_PINNED_CONTEXT_DISPLAY_PATH = 'prose-minion/pinned-context.json';

/**
 * One pinned file: a workspace-relative, `/`-separated, normalized path
 * (`workshopPinnedContextPathFault` holds the rule). The catalog group is
 * never stored; it is derived at read time (D5).
 */
export interface WorkshopPinnedContextEntry {
  readonly path: string;
}

/** The pinned files, in pinned order, each once. */
export interface WorkshopPinnedContextList {
  readonly files: readonly WorkshopPinnedContextEntry[];
}

/**
 * Why a file is unreadable as a whole, in words the tab can say:
 * - `json`: not UTF-8 JSON;
 * - `format`: not an object with `format: 1` and a `files` array of objects;
 * - `unknown-key`: a key format 1 does not define, at the root or in an entry;
 * - `path`: an entry's path is missing, not a string, or breaks the path rule;
 * - `duplicate`: two entries name one file;
 * - `too-many`: more entries than `WORKSHOP_PINNED_CONTEXT_FILES`;
 * - `too-large`: more bytes than `WORKSHOP_PINNED_CONTEXT_FILE_BYTES`, refused
 *   before it is decoded.
 */
export const WORKSHOP_PINNED_CONTEXT_REFUSALS = ['json', 'format', 'unknown-key', 'path', 'duplicate', 'too-many', 'too-large'] as const;
export type WorkshopPinnedContextRefusal = typeof WORKSHOP_PINNED_CONTEXT_REFUSALS[number];

/**
 * How the host compares paths: `windows` folds case (its file system does),
 * `posix` compares them as written. Passed in, never read from the process,
 * so both are tested on any machine.
 */
export type WorkshopPinnedContextPathPlatform = 'windows' | 'posix';

/** The host's platform as a path comparison names it. */
export function workshopPinnedContextPlatformOf(platform: string): WorkshopPinnedContextPathPlatform {
  return platform === 'win32' ? 'windows' : 'posix';
}

/**
 * The one key two paths are compared by: Unicode NFC (a hand edit on macOS
 * may write NFD), then case-folded on Windows. Two entries with one key are
 * a duplicate; Slice 2b matches a room's files by it too.
 */
export function workshopPinnedContextPathKey(entryPath: string, platform: WorkshopPinnedContextPathPlatform): string {
  const composed = entryPath.normalize('NFC');
  return platform === 'windows' ? composed.toLowerCase() : composed;
}

/**
 * What is wrong with a path, or undefined when it keeps the rule: not
 * empty; `/`-separated with no backslash; no leading `/` and no drive
 * letter; no empty, `.` or `..` segment (so no trailing `/` either); and no
 * control character.
 */
export function workshopPinnedContextPathFault(entryPath: string): 'empty' | 'backslash' | 'absolute' | 'drive' | 'segment' | 'control' | undefined {
  if (entryPath.length === 0) {
    return 'empty';
  }
  if (/[\u0000-\u001f\u007f]/.test(entryPath)) {
    return 'control';
  }
  if (entryPath.includes('\\')) {
    return 'backslash';
  }
  if (entryPath.startsWith('/')) {
    return 'absolute';
  }
  if (/^[A-Za-z]:/.test(entryPath)) {
    return 'drive';
  }
  if (entryPath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return 'segment';
  }
  return undefined;
}
