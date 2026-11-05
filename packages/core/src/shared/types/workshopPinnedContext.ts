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

/**
 * The longest entry path (UTF-16 code units). The path rule refuses a longer
 * one, so the codec, every pin route and the tab's entry keys share it: a key
 * the host sends is always one it takes back (PR #210 F07).
 */
export const WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS = PROMPT_BUDGETS.workshopPinnedContext.pathCharacters;

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
 * The one key two paths are compared by. Two entries with one key are a
 * duplicate; Slice 2b matches a room's files by it too.
 *
 * - **NFC first, on every platform.** Deliberately conservative: NTFS (and
 *   most Linux file systems) treat NFC and NFD spellings as different names,
 *   but a list naming one file in both forms is refused, which loses
 *   nothing (a hand edit on macOS may write NFD).
 * - **On Windows, NTFS's own case rule** (PR #204 F-03), not Unicode case
 *   folding: each UTF-16 code unit is upper-cased through a simple
 *   one-to-one table. A code unit whose upper case is a single code unit
 *   takes it; any other (`ß` → `SS`, `ŉ` → `ʼN`) is kept as written, and
 *   so is each half of a surrogate pair, so an astral character is never
 *   folded. So `σ`, `ς` and `Σ` are one name; `ß` and `SS` are two; `ı`
 *   and `I` are one; `İ` and `I` are two.
 * - **Known limit.** The table a volume uses is written when it is
 *   formatted, and differs slightly by Windows version; this is the table
 *   JavaScript's simple upper case gives, which agrees on every letter a
 *   writer is likely to type.
 */
export function workshopPinnedContextPathKey(entryPath: string, platform: WorkshopPinnedContextPathPlatform): string {
  const composed = entryPath.normalize('NFC');
  return platform === 'windows' ? ntfsUpcase(composed) : composed;
}

/** Each UTF-16 code unit through a one-to-one upper-case table, as NTFS compares names. */
function ntfsUpcase(text: string): string {
  let result = '';
  for (let index = 0; index < text.length; index++) {
    const unit = text.charAt(index);
    const upper = unit.toUpperCase();
    result += upper.length === 1 ? upper : unit;
  }
  return result;
}

/**
 * What is wrong with a path, or undefined when it keeps the rule: not
 * empty; `/`-separated with no backslash; no leading `/` and no drive
 * letter; no empty, `.` or `..` segment (so no trailing `/` either); and no
 * control character, C0 (U+0000–U+001F), DEL or C1 (U+0080–U+009F; PR #204
 * N-01); and at most `WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS` long (PR #210
 * F07).
 */
export function workshopPinnedContextPathFault(entryPath: string): 'empty' | 'too-long' | 'backslash' | 'absolute' | 'drive' | 'segment' | 'control' | undefined {
  if (entryPath.length === 0) {
    return 'empty';
  }
  if (entryPath.length > WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS) {
    return 'too-long';
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(entryPath)) {
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
