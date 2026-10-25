/**
 * The saved boards as the writer reads them (Slice 5A; Slice 5A.1; Slice
 * 5A.2, epic decision 46): the Boards menu in the header, Workshop-style,
 * and the browser it opens. Pure: the host's shelf in, words out, so every
 * sentence is tested without a webview. Nothing here carries the source's
 * text; a board's name is the writer's words, held only as the shelf holds
 * it.
 *
 * - **The menu's trigger** names the board on screen (its name, or, before
 *   its first save, its chapter's file name) and says whether it is saved:
 *   "Saved", "Not saved yet", "Save failed", "Name not saved" (its name is
 *   not the one its file holds: a rename whose file could not be changed,
 *   PR #167 F-03), or "This session only".
 * - **Rows** are every chapter's saved boards, newest first, as the host
 *   lists them: the name, the chapter, when it was saved, the lenses read,
 *   any stale, an approximate cost, the models that read it
 *   (`lightboxModelsNote`), and which one is on screen. The menu shows the
 *   newest five.
 * - **The browser** groups them by date (Today, This week, Earlier, as the
 *   Workshop's sessions do) or by chapter, and searches names and chapter
 *   paths.
 * - **The notice above the board** (decision 34): a snapshot whose file
 *   changed, with "Read the current text"; also one whose file could not be
 *   compared, one with parts left out, and one opened from outside the
 *   boards folder, which its next save copies in, and which, once saved
 *   here, says so (PR #167 N-02).
 */

import type { LightboxBoardShelf, LightboxSavedBoardSource, LightboxSavedBoardSummary, LightboxSnapshotState } from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { lightboxBoardSourceLabel } from '@shared/constants/lightboxBoardName';
import { groupSavedItemsByDate, type SavedItemGroup } from '@utils/savedItemGroups';

export interface LightboxBoardRow {
  fileId: string;
  name: string;
  /** The chapter it was measured from: its workspace-relative path, and a selection's lines. */
  chapter: string;
  /** The chapter, for grouping: two selections of one file are two chapters. */
  chapterKey: string;
  savedAt: number;
  /** When it was saved, as the browser shows it. */
  when: string;
  /** The same moment for `<time dateTime>`. */
  dateTime: string;
  /** "Measured only", "Every lens read", or how many were. */
  lenses: string;
  /** How many of its lenses were read against an earlier text, when any were. */
  stale?: string;
  /** Its recorded cost, approximately, when a call recorded one. */
  cost?: string;
  /** The models that read it, shortened ("Read by model-v1"); absent for a board no model read. */
  models?: string;
  /** Their ids as the provider reported them, for the line's tooltip. */
  modelIds?: string;
  onScreen: boolean;
}

export type LightboxBoardsSaveState = 'saved' | 'saving' | 'error' | 'session';

/** The Boards menu: its trigger, its notes, and the newest boards. */
export interface LightboxBoardsMenuView {
  /** The trigger's words: the board on screen's name, its chapter's file name before its first save, or "Boards". */
  label: string;
  /** Whether the board on screen is saved; absent until the host has answered for it, or with no board. */
  status?: { state: LightboxBoardsSaveState; text: string };
  /** The newest boards, of every chapter. */
  recent: LightboxBoardRow[];
  /** Where boards are kept, when that is not simply the project. */
  availability?: string;
  /** Whether a board is on screen to rename. */
  canRename: boolean;
}

/** The browser: every row, the notes above them, and the caption below. */
export interface LightboxBoardsBrowserView {
  rows: LightboxBoardRow[];
  notes: Array<{ text: string; tone: 'quiet' | 'warn' | 'alert' }>;
  /** Boards are saved (one folder open): rename, delete and the file picker's store apply. */
  saving: boolean;
  empty: string;
  caption: string;
}

export interface LightboxSnapshotView {
  /** `warn` when the board on screen may not match its file now. */
  tone: 'quiet' | 'warn';
  opened: string;
  file: string;
  /** Offer "Read the current text": the file is there, and holds another text. */
  readCurrentText: boolean;
  dropped?: string;
}

export interface LightboxBoardsViewOptions {
  /** The zone dates are shown in; the webview's own by default (tests pin one). */
  timeZone?: string;
}

/** How many boards the menu shows, as the Workshop's menu shows its recent rooms. */
export const LIGHTBOX_RECENT_BOARDS = 5;

const EVERY_LENS = LIGHTBOX_LENSES.length;
/** A shortened model name is at most this long. */
const MODEL_CHARACTERS = 32;

/** The board on screen's chapter, as a default name would call it: the trigger's words before a first save. */
export type LightboxBoardsOnScreen = LightboxSavedBoardSource | null;

/** The Boards menu for the board on screen (`onScreen`, its source; `null`: none), from the host's shelf (`null` until it answers). */
export function buildLightboxBoardsMenu(
  shelf: LightboxBoardShelf | null,
  onScreen: LightboxBoardsOnScreen,
  options: LightboxBoardsViewOptions = {}
): LightboxBoardsMenuView {
  const rows = shelf ? lightboxBoardRows(shelf, options) : [];
  const view: LightboxBoardsMenuView = {
    label: shelf?.name ?? (onScreen ? lightboxBoardSourceLabel(onScreen) : 'Boards'),
    recent: rows.slice(0, LIGHTBOX_RECENT_BOARDS),
    canRename: onScreen !== null && shelf !== null,
    ...(shelf ? availabilityNote(shelf) : {})
  };
  if (shelf && onScreen) {
    view.status = saveStatus(shelf);
  }
  return view;
}

/** The browser's rows and notes, from the host's shelf (`null` until it answers). */
export function buildLightboxBoardsBrowser(shelf: LightboxBoardShelf | null, options: LightboxBoardsViewOptions = {}): LightboxBoardsBrowserView {
  if (!shelf) {
    return { rows: [], notes: [], saving: false, empty: 'Looking for saved boards…', caption: '' };
  }
  const notes: LightboxBoardsBrowserView['notes'] = [];
  const { availability } = availabilityNote(shelf);
  if (availability) {
    notes.push({ text: availability, tone: 'warn' });
  }
  if (shelf.notice) {
    notes.push({ text: shelf.notice, tone: 'alert' });
  }
  if (shelf.unreadable > 0) {
    notes.push({
      tone: 'quiet',
      text: shelf.unreadable === 1
        ? '1 file in the boards folder could not be read as a board. It was left as it is.'
        : `${shelf.unreadable} files in the boards folder could not be read as boards. They were left as they are.`
    });
  }
  if ((shelf.unreadableFolders ?? 0) > 0) {
    notes.push({
      tone: 'warn',
      text: shelf.unreadableFolders === 1
        ? '1 chapter\'s folder could not be read, so its boards are not listed. The output log says why.'
        : `${shelf.unreadableFolders} chapters' folders could not be read, so their boards are not listed. The output log says why.`
    });
  }
  const saving = shelf.availability.kind === 'project';
  return {
    rows: lightboxBoardRows(shelf, options),
    notes,
    saving,
    empty: saving
      ? 'No saved boards yet. A board saves itself when it is first measured, and again after each reading, in a file of its own.'
      : 'Boards are kept for this session only, so there are none to open here.',
    caption: saving
      ? `Saved in ${shelf.availability.kind === 'project' ? shelf.availability.displayPath : ''}, one file per board. "Read the current text" starts a new one. Nothing is deleted unless you delete it.`
      : 'Open one folder, and boards save themselves there.'
  };
}

/** Every saved board as a row, newest first, as the host listed them. */
export function lightboxBoardRows(shelf: LightboxBoardShelf, options: LightboxBoardsViewOptions = {}): LightboxBoardRow[] {
  const when = lightboxWhenFormat(options.timeZone);
  return shelf.boards.map((board) => rowOf(board, when));
}

/** The browser's rows matching `query`, by name or chapter path, ignoring case; every row for an empty query. */
export function searchLightboxBoardRows(rows: readonly LightboxBoardRow[], query: string): LightboxBoardRow[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...rows];
  }
  return rows.filter((row) => {
    const text = `${row.name}\n${row.chapter}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Rows by date: Today, This week, Earlier (the Workshop's buckets), newest first within each. */
export function lightboxBoardsByDate(rows: readonly LightboxBoardRow[], now: Date = new Date()): Array<SavedItemGroup<LightboxBoardRow>> {
  return groupSavedItemsByDate(rows, (row) => row.savedAt, now);
}

/** Rows by chapter: each chapter once, in the order of its newest board. */
export function lightboxBoardsByChapter(rows: readonly LightboxBoardRow[]): Array<SavedItemGroup<LightboxBoardRow>> {
  const groups = new Map<string, SavedItemGroup<LightboxBoardRow>>();
  for (const row of rows) {
    const group = groups.get(row.chapterKey) ?? { key: `chapter:${row.chapterKey}`, label: row.chapter, items: [] };
    group.items.push(row);
    groups.set(row.chapterKey, group);
  }
  return [...groups.values()];
}

/**
 * The note above the board (Slice 5A.1, epic decision 34; widened in Slice
 * 5A.2 as the rail went): a snapshot whose file has changed, offering "Read
 * the current text"; one whose file could not be compared; one with parts
 * left out; one opened from a file outside the boards folder. A snapshot of
 * an unchanged file, or a selection, says nothing.
 */
export function lightboxSnapshotNotice(
  shelf: LightboxBoardShelf | null,
  options: LightboxBoardsViewOptions = {}
): LightboxSnapshotView | undefined {
  // A board opened from outside that has saved here since has a file of its own, on screen (PR #167 N-02).
  const savedHere = shelf?.boards.some((board) => board.onScreen) ?? false;
  const snapshot = shelf?.snapshot && snapshotOf(shelf.snapshot, lightboxWhenFormat(options.timeZone), savedHere);
  return snapshot && (snapshot.tone === 'warn' || snapshot.dropped || shelf?.snapshot?.outside) ? snapshot : undefined;
}

/**
 * The models that read a board, once each and shortened: "Read by model-v1",
 * "… and model-b", "… and 2 more". Each is counted by its whole name without
 * the provider before it is cut for show, so two models whose names begin
 * alike still count as two (PR #164 N-02).
 */
export function lightboxModelsNote(models: readonly string[] | undefined): string | undefined {
  const short = [...new Set((models ?? []).map(modelName))].map(shortModelName);
  if (short.length === 0) {
    return undefined;
  }
  return short.length <= 2
    ? `Read by ${short.join(' and ')}`
    : `Read by ${short[0]}, ${short[1]} and ${short.length - 2} more`;
}

/** A chapter as a row names it: its path, and a selection's lines. */
export function lightboxBoardChapter(source: LightboxSavedBoardSource): string {
  if (source.kind !== 'selection' || source.startLine === undefined) {
    return source.displayPath;
  }
  return source.endLine !== undefined && source.endLine !== source.startLine
    ? `${source.displayPath} · lines ${source.startLine}–${source.endLine}`
    : `${source.displayPath} · line ${source.startLine}`;
}

function availabilityNote(shelf: LightboxBoardShelf): { availability?: string } {
  if (shelf.availability.kind === 'session') {
    const why = shelf.availability.reason === 'no-workspace' ? 'no folder is open' : 'several folders are open';
    return { availability: `Boards are kept for this session only: ${why}. Open one folder to save them.` };
  }
  if (shelf.availability.lastSaveFailed) {
    return { availability: 'The last save could not be written (the output log says why). Until one is, this board is kept for this session only.' };
  }
  return {};
}

function saveStatus(shelf: LightboxBoardShelf): LightboxBoardsMenuView['status'] {
  if (shelf.availability.kind === 'session') {
    return { state: 'session', text: 'This session only' };
  }
  if (shelf.availability.lastSaveFailed) {
    return { state: 'error', text: 'Save failed' };
  }
  const own = shelf.boards.find((board) => board.onScreen);
  if (!own) {
    return { state: 'session', text: 'Not saved yet' };
  }
  // The board's name is not the one its file holds: the rename reached the board, not the file (PR #167 F-03).
  return shelf.name !== undefined && own.name !== shelf.name ? { state: 'error', text: 'Name not saved' } : { state: 'saved', text: 'Saved' };
}

/** A model id without its provider: "provider/model-v1" → "model-v1". */
function modelName(model: string): string {
  return model.slice(model.lastIndexOf('/') + 1) || model;
}

/** A model's name as the row shows it: at most 32 characters. */
function shortModelName(name: string): string {
  return name.length > MODEL_CHARACTERS ? `${name.slice(0, MODEL_CHARACTERS - 1)}…` : name;
}

function rowOf(board: LightboxSavedBoardSummary, when: Intl.DateTimeFormat): LightboxBoardRow {
  const models = lightboxModelsNote(board.models);
  const { kind, displayPath, startLine, endLine } = board.source;
  return {
    fileId: board.fileId,
    name: board.name,
    chapter: lightboxBoardChapter(board.source),
    chapterKey: `${kind}:${displayPath}:${startLine ?? ''}-${endLine ?? ''}`,
    savedAt: board.savedAt,
    when: when.format(board.savedAt),
    dateTime: new Date(board.savedAt).toISOString(),
    lenses: lensesNote(board.lenses.length),
    ...(board.staleLenses.length > 0 ? { stale: `${board.staleLenses.length} stale` } : {}),
    ...(board.costUsd !== undefined ? { cost: costNote(board.costUsd) } : {}),
    ...(models ? { models, modelIds: (board.models ?? []).join(', ') } : {}),
    onScreen: board.onScreen
  };
}

function snapshotOf(snapshot: LightboxSnapshotState, when: Intl.DateTimeFormat, savedHere: boolean): LightboxSnapshotView {
  const outside = `Opened from a board file outside the boards folder, saved ${when.format(snapshot.savedAt)}.`;
  const opened = !snapshot.outside
    ? `Opened from the board saved ${when.format(snapshot.savedAt)}.`
    : savedHere
      ? `${outside} It is saved in the boards folder now, as a file of its own; the file it came from is as it was.`
      : `${outside} Its next save writes it there, as a file of its own.`;
  const dropped = snapshot.dropped === 0 ? {}
    : { dropped: snapshot.dropped === 1 ? '1 part of it could not be read and was left out.' : `${snapshot.dropped} parts of it could not be read and were left out.` };
  switch (snapshot.file) {
    case 'same':
      return { tone: 'quiet', opened, file: 'The file still holds the text it was read from.', readCurrentText: false, ...dropped };
    case 'changed':
      return {
        tone: 'warn',
        opened,
        file: 'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.',
        readCurrentText: true,
        ...dropped
      };
    case 'unreadable':
      return { tone: 'warn', opened, file: 'Its chapter could not be read to compare it with this board, so Bring is held back.', readCurrentText: false, ...dropped };
    case 'none':
      return { tone: 'quiet', opened, file: 'It was a selection, so there is no file to compare.', readCurrentText: false, ...dropped };
  }
}

function lensesNote(count: number): string {
  if (count === 0) {
    return 'Measured only';
  }
  if (count >= EVERY_LENS) {
    return 'Every lens read';
  }
  return count === 1 ? '1 lens read' : `${count} lenses read`;
}

function costNote(costUsd: number): string {
  return costUsd < 0.005 ? 'under $0.01' : `≈ $${costUsd.toFixed(2)}`;
}

/** How the board's surfaces tell a time: "Oct 23, 2026, 9:08 AM", in `timeZone` (the viewer's own when absent). */
export function lightboxWhenFormat(timeZone: string | undefined): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  });
}
