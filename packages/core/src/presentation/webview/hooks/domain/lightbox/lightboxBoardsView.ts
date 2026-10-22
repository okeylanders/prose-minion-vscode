/**
 * The rail's Boards section as the writer reads it (Slice 5A; epic decision
 * 31): each saved board's date and time, the lenses it holds, any stale, its
 * approximate cost and whether it is the board on screen; where boards are
 * kept; and, for a board opened from a file, whether that file still holds
 * its text. Pure: the host's shelf in, words out, so every sentence is tested
 * without a webview. Nothing here carries the writer's text.
 *
 * The host lists every saved board of the source. The rail shows the newest
 * page of them and says so when there are more: "Showing the newest 20 of
 * 23", and a button that shows older ones (PR #163 F-04). The page always
 * reaches the board on screen. The head counts them all.
 */

import type { LightboxBoardShelf, LightboxSavedBoardSummary, LightboxSnapshotState } from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';

export interface LightboxSavedBoardRow {
  fileId: string;
  /** The date and time it was saved, as the rail shows it. */
  when: string;
  /** The same moment for `<time dateTime>`. */
  dateTime: string;
  /** "Measured only", "Every lens read", or how many were. */
  lenses: string;
  /** How many of its lenses were read against an earlier text, when any were. */
  stale?: string;
  /** Its recorded cost, approximately, when a call recorded one. */
  cost?: string;
  onScreen: boolean;
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

/** How many rows the rail shows at first, and how many more each "Show older" adds. */
export const LIGHTBOX_BOARDS_PAGE = 20;

/** When the shelf holds more boards than are shown: how many are, and the button that shows older ones. */
export interface LightboxBoardsPage {
  note: string;
  more: string;
  /** How many rows "Show older" shows: a page more than are shown now, however the page was reached (PR #163 N-03). */
  next: number;
}

export interface LightboxBoardsView {
  /** The head's chip: how many are saved, or that boards are kept for the session only. */
  status: string;
  /** Where boards are kept, when that is not simply the project. */
  availability?: string;
  /** The newest boards, as many as are shown. */
  rows: LightboxSavedBoardRow[];
  /** Present only when older boards are not shown. */
  page?: LightboxBoardsPage;
  empty?: string;
  unreadable?: string;
  notice?: string;
  snapshot?: LightboxSnapshotView;
  caption?: string;
}

export interface LightboxBoardsViewOptions {
  /** The zone dates are shown in; the webview's own by default (tests pin one). */
  timeZone?: string;
  /** How many of the newest boards are shown; one page by default. */
  shown?: number;
}

const EVERY_LENS = LIGHTBOX_LENSES.length;

/** The Boards section for the board on screen (`hasBoard`), from the host's shelf for it (`null` until it answers). */
export function buildLightboxBoardsView(
  shelf: LightboxBoardShelf | null,
  hasBoard: boolean,
  options: LightboxBoardsViewOptions = {}
): LightboxBoardsView {
  if (!hasBoard) {
    return { status: 'none', rows: [], empty: 'Board a chapter, and the boards saved from it show here.' };
  }
  if (!shelf) {
    return { status: '…', rows: [], empty: 'Looking for saved boards…' };
  }
  const when = whenFormat(options.timeZone);
  const total = shelf.boards.length;
  // The newest page, and always as far as the board on screen.
  const shown = Math.max(options.shown ?? LIGHTBOX_BOARDS_PAGE, shelf.boards.findIndex((board) => board.onScreen) + 1);
  const rows = shelf.boards.slice(0, shown).map((board) => rowOf(board, when));
  const view: LightboxBoardsView = {
    status: shelf.availability.kind === 'session' ? 'this session' : `${total} saved`,
    rows,
    ...(rows.length < total ? {
      page: {
        note: `Showing the newest ${rows.length} of ${total}.`,
        more: `Show ${Math.min(LIGHTBOX_BOARDS_PAGE, total - rows.length)} older`,
        next: Math.min(total, rows.length + LIGHTBOX_BOARDS_PAGE)
      }
    } : {}),
    ...(shelf.notice ? { notice: shelf.notice } : {}),
    ...(shelf.snapshot ? { snapshot: snapshotOf(shelf.snapshot, when) } : {})
  };
  if (shelf.availability.kind === 'session') {
    const why = shelf.availability.reason === 'no-workspace' ? 'no folder is open' : 'several folders are open';
    return { ...view, availability: `Boards are kept for this session only: ${why}. Open one folder to save them.` };
  }
  if (shelf.availability.lastSaveFailed) {
    view.availability = 'The last save could not be written (the output log says why). Until one is, this board is kept for this session only.';
  }
  if (total === 0) {
    view.empty = 'No saved boards of this source yet. A board saves itself when it is first measured, and after each reading.';
  }
  if (shelf.unreadable > 0) {
    view.unreadable = shelf.unreadable === 1
      ? '1 file here could not be read as a board. It was left as it is.'
      : `${shelf.unreadable} files here could not be read as boards. They were left as they are.`;
  }
  view.caption = `Saved in ${shelf.availability.displayPath}, one file per save. Nothing is deleted unless you delete it.`;
  return view;
}

function rowOf(board: LightboxSavedBoardSummary, when: Intl.DateTimeFormat): LightboxSavedBoardRow {
  return {
    fileId: board.fileId,
    when: when.format(board.savedAt),
    dateTime: new Date(board.savedAt).toISOString(),
    lenses: lensesNote(board.lenses.length),
    ...(board.staleLenses.length > 0 ? { stale: `${board.staleLenses.length} stale` } : {}),
    ...(board.costUsd !== undefined ? { cost: costNote(board.costUsd) } : {}),
    onScreen: board.onScreen
  };
}

function snapshotOf(snapshot: LightboxSnapshotState, when: Intl.DateTimeFormat): LightboxSnapshotView {
  const opened = `Opened from the board saved ${when.format(snapshot.savedAt)}.`;
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
      return { tone: 'warn', opened, file: 'The file could not be read to compare it with this board.', readCurrentText: false, ...dropped };
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

function whenFormat(timeZone: string | undefined): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  });
}
