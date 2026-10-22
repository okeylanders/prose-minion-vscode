/**
 * Lightbox saved boards (ADR 2026-10-19 D12 and its addendum of 2026-10-22;
 * Slice 5A; epic decisions 27–32).
 *
 * A board saves itself to `prose-minion/boards/<source-slug>/<timestamp>.board.json`
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
 *
 * Nothing here carries the writer's text: summaries are dates, counts, lens
 * ids and costs.
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
  /** Epoch ms when it was saved. */
  savedAt: number;
  wordCount: number;
  /** The lenses it holds readings of, in rail order; empty for a board saved before any reading. */
  lenses: LightboxLensId[];
  /** Of `lenses`, those read against an earlier text (stale). */
  staleLenses: LightboxLensId[];
  /** Every call's recorded cost, summed, in US dollars; absent when no call recorded one. */
  costUsd?: number;
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
 * The shelf, answering one request by its id, or pushed after a save
 * (`requestId: null`). `boardId` names the board the shelf describes: the
 * one asked about, or, after an open, the board then on screen; `null` when
 * there is none.
 */
export interface LightboxBoardsPayload {
  requestId: string | null;
  boardId: string | null;
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

export interface LightboxBoardsMessage extends MessageEnvelope<LightboxBoardsPayload> {
  type: MessageType.LIGHTBOX_BOARDS;
}

/** The rail's three requests, for the barrel's inbound union. */
export type LightboxBoardsRequestMessage = LightboxRequestBoardsMessage | LightboxOpenBoardMessage | LightboxDeleteBoardMessage;
