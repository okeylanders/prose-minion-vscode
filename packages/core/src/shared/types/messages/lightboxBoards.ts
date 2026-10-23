/**
 * Lightbox saved boards (ADR 2026-10-19 D12 and its addendum of 2026-10-22;
 * Slice 5A; epic decisions 27–32; Slice 5A.1, decisions 33–36).
 *
 * A board saves itself to `prose-minion/boards/<source-slug>-<source-hash>/<timestamp>.board.json`
 * in format 1 (`LightboxBoardCodec`), and the rail's Boards section lists the
 * saved boards of the source on screen. These messages carry the rail, never
 * a board: an opened board arrives as `LIGHTBOX_BOARD`, as any board does.
 *
 * - **Correlation (the 4E passage pattern).** Every request carries a
 *   webview-minted `requestId`; the answer echoes the id and names the board
 *   its shelf describes, and the webview takes only the answer it is still
 *   waiting for and shows a shelf only beside the board it describes. A
 *   committed save is pushed with `requestId: null`, and taken only while
 *   its board is on screen.
 * - **Restore on mount (epic decision 30).** A request that names no board
 *   (the webview has none yet) lets the host reopen the last board on screen,
 *   once per session and only while no source has been chosen; the board
 *   arrives as `LIGHTBOX_BOARD`, and the answer describes it.
 * - **Files by the host's id.** A saved board is named by its `fileId`,
 *   which the host minted when it listed the file. The webview never names a
 *   path, and the host checks an id against its own folder before it reads or
 *   deletes anything.
 * - **Opening is a source choice.** It takes the host's source ticket, so a
 *   newer source wins over it and it wins over an older one (PR #148 F-01).
 *   An open the host refuses at once (a run is reading the board it would
 *   replace) says why in `notice`; one that fails after reading says so as a
 *   standing refusal, like any source.
 * - **Names (Slice 5A.1, epic decision 33).** A board may carry the writer's
 *   name for it. `LIGHTBOX_RENAME_BOARD` names a saved file in place, or the
 *   board on screen, and is answered with the shelf like every other
 *   request.
 *
 * Nothing here carries the source's text. A board's name is the writer's
 * own words, so it is treated as that text is: the shelf carries it to the
 * rail, and nothing logs or persists it.
 */

import { MessageEnvelope, MessageType } from './base';
import type { LightboxLensId } from './lightboxReadings';

/**
 * Where the open source's boards are kept. `project`: the workspace's one
 * folder, under `displayPath`; `lastSaveFailed` says the latest save could
 * not be written (it is logged), so boards since then live for this session
 * only. `session`: none are saved, because no folder is open or several are
 * (the rule the Workshop's project lens library follows, epic decision 28).
 */
export type LightboxBoardsAvailability =
  | { kind: 'project'; displayPath: string; lastSaveFailed: boolean }
  | { kind: 'session'; reason: 'no-workspace' | 'multi-root' };

/** One saved board of the open source, as the rail lists it. */
export interface LightboxSavedBoardSummary {
  /** The host's name for the file. Opaque: the webview hands it back, never a path. */
  fileId: string;
  /** The writer's name for the board it holds (Slice 5A.1); absent when it is unnamed. */
  name?: string;
  /** Epoch ms when it was saved. */
  savedAt: number;
  wordCount: number;
  /** The lenses it holds readings of, in rail order; empty for a board saved before any reading. */
  lenses: LightboxLensId[];
  /** Of `lenses`, those read against an earlier text (stale). */
  staleLenses: LightboxLensId[];
  /** Every call's recorded cost, summed, in US dollars; absent when no call recorded one. */
  costUsd?: number;
  /**
   * The models that read it, as each group's provider reported them, once
   * each, in group order (Slice 5A.1); absent for a board no model read.
   */
  models?: string[];
  /** It holds the board on screen: the board was opened from it, or last saved to it. */
  onScreen: boolean;
}

/**
 * Whether the file a saved board was measured from still holds its text:
 * `same` or `changed` by content hash, `unreadable` when the file could not
 * be read now, `none` for a selection, which has no file to compare.
 */
export type LightboxSnapshotFile = 'same' | 'changed' | 'unreadable' | 'none';

/** The board on screen when it was opened from a saved file, or restored from one after a reload. */
export interface LightboxSnapshotState {
  fileId: string;
  savedAt: number;
  file: LightboxSnapshotFile;
  /** Parts the codec could not read and left out (tiles and group notes), counted; 0 for a whole board. */
  dropped: number;
}

/** The rail's Boards section for one board's source. */
export interface LightboxBoardShelf {
  availability: LightboxBoardsAvailability;
  /** The name of the board the shelf describes, the board on screen (Slice 5A.1); absent when it is unnamed. */
  name?: string;
  /** Newest first. */
  boards: LightboxSavedBoardSummary[];
  /** Files in the source's folder that could not be read as boards; left as they are. */
  unreadable: number;
  /** Set when the board on screen is a saved board, opened or restored. */
  snapshot?: LightboxSnapshotState;
  /** Why an open or a delete did not happen, in host words. */
  notice?: string;
}

/** The rail asks for the saved boards of the board on screen's source. */
export interface LightboxRequestBoardsPayload {
  requestId: string;
  /** The board on screen; `null` when the webview has none yet (a mount). */
  boardId: string | null;
}

/** Open a saved board, replacing the board on screen. The answer describes the board then on screen. */
export interface LightboxOpenBoardPayload {
  requestId: string;
  fileId: string;
}

/** Delete a saved board's file, after the rail's confirm step. */
export interface LightboxDeleteBoardPayload {
  requestId: string;
  boardId: string;
  fileId: string;
}

/**
 * Name a board, or rename it (Slice 5A.1). `boardId` is the board on screen,
 * whose shelf answers. `fileId` names the saved file to rename in place;
 * `null` names the board on screen itself, and the file that holds it when
 * one does. Naming the file that holds the board on screen names that board
 * too, so its later saves carry the name; naming any other file changes only
 * that file. `name` is the writer's words: trimmed, one line, at most
 * `LIGHTBOX_BOARD_NAME_CHARACTERS`; empty unnames the board.
 */
export interface LightboxRenameBoardPayload {
  requestId: string;
  boardId: string;
  fileId: string | null;
  name: string;
}

/**
 * The shelf, answering one request by its id, or pushed after an adoption
 * or a save (`requestId: null`). `boardId` names the board the shelf
 * describes: the one asked about, or, after an open, the board then on
 * screen; `null` when there is none. `adoption` is that board's adoption
 * generation, ascending per session (PR #163 F-02): a board keeps its id
 * across saved snapshots, so the webview never takes a shelf of an earlier
 * adoption over the one it holds for the same board. `observation` orders
 * shelves within an adoption (PR #163 F-05): ascending per session, taken
 * when the host began the shelf, so the webview never takes one observed
 * before the one it holds for the same board.
 */
export interface LightboxBoardsPayload {
  requestId: string | null;
  boardId: string | null;
  adoption: number | null;
  observation: number;
  shelf: LightboxBoardShelf;
}

export interface LightboxRequestBoardsMessage extends MessageEnvelope<LightboxRequestBoardsPayload> {
  type: MessageType.LIGHTBOX_REQUEST_BOARDS;
}

export interface LightboxOpenBoardMessage extends MessageEnvelope<LightboxOpenBoardPayload> {
  type: MessageType.LIGHTBOX_OPEN_BOARD;
}

export interface LightboxDeleteBoardMessage extends MessageEnvelope<LightboxDeleteBoardPayload> {
  type: MessageType.LIGHTBOX_DELETE_BOARD;
}

export interface LightboxRenameBoardMessage extends MessageEnvelope<LightboxRenameBoardPayload> {
  type: MessageType.LIGHTBOX_RENAME_BOARD;
}

export interface LightboxBoardsMessage extends MessageEnvelope<LightboxBoardsPayload> {
  type: MessageType.LIGHTBOX_BOARDS;
}

/** The rail's four requests, for the barrel's inbound union. */
export type LightboxBoardsRequestMessage =
  | LightboxRequestBoardsMessage
  | LightboxOpenBoardMessage
  | LightboxDeleteBoardMessage
  | LightboxRenameBoardMessage;
