/**
 * useLightboxBoards — the saved boards (Slice 5A; the Boards menu and
 * browser from Slice 5A.2), mirroring the host's `LightboxBoardsHandler`.
 *
 * On mount, and whenever the board on screen changes, it asks for that
 * board's shelf with `LIGHTBOX_REQUEST_BOARDS` (naming no board on a mount
 * with none, which lets the host restore the last board on screen once per
 * session). Open and Delete post `LIGHTBOX_OPEN_BOARD` and
 * `LIGHTBOX_DELETE_BOARD`; the opened board itself arrives as
 * `LIGHTBOX_BOARD`, through `useLightbox`.
 *
 * Correlation (the 4E passage pattern): every request carries a
 * webview-minted id, only the answer to the request still pending is taken,
 * and a newer request drops the older one. A shelf the host pushes after an
 * adoption or a save (`requestId: null`) is taken only for the board on
 * screen. A shelf is shown only beside the board it describes, and a board
 * keeps its id across saved snapshots, so a shelf of an earlier adoption is
 * never taken over a later one's for the same board (PR #163 F-02), nor,
 * within one adoption, a shelf the host observed before the one held
 * (PR #163 F-05). A Delete
 * forgets which board the held shelf answered for, so coming back to that
 * board asks again (PR #163 N-01).
 *
 * Rename (Slice 5A.1) posts `LIGHTBOX_RENAME_BOARD`, naming a saved file or
 * (`fileId: null`) the board on screen; the answer is the shelf, taken as
 * any request's is, and a rename forgets the held shelf as a Delete does.
 *
 * Slice 5A.2: the shelf lists every chapter's boards. "Open a board file…"
 * posts `LIGHTBOX_OPEN_BOARD_FILE`, and the host shows its picker; Delete
 * and Rename may name no board on screen (the browser works without one);
 * `refresh` asks for the shelf again, as the browser opens.
 *
 * PR #167: what an open, a delete or a rename left to say (the shelf's
 * `notice`) is the hook's `outcome`, taken from the answer to that request
 * even when a newer request has taken the shelf over, and shown by the app
 * until dismissed or replaced by the next such answer, so it outlives the
 * sheet or browser that asked. A rename from the name sheet names the
 * board and adoption the sheet was opened for (F-02).
 *
 * Nothing persists: the files are the host's, and a board's name, the
 * writer's words, lives only in the shelf the host sent.
 */

import * as React from 'react';
import { LightboxBoard, LightboxBoardShelf, LightboxBoardsMessage, MessageType } from '@messages';
import type { LightboxBoardsRenameTarget } from '@hooks/domain/lightbox/controllers/useLightboxBoardsSurface';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface UseLightboxBoardsArgs {
  board: LightboxBoard | null;
}

export interface LightboxBoardsState {
  /** The shelf of the board on screen, once the host has answered for it. */
  shelf: LightboxBoardShelf | null;
  /** The file being opened, until the host answers. */
  opening: string | null;
  /** "Open a board file…" is waiting for the host's picker and its answer (Slice 5A.2). */
  openingFile: boolean;
  /** The adoption the held shelf names for the board on screen (PR #163 F-02); null before one did. */
  adoption: number | null;
  /** What the last open, delete or rename left to say, until dismissed (PR #167 F-03). */
  outcome: string | null;
}

export interface LightboxBoardsActions {
  handleBoards: (message: LightboxBoardsMessage) => void;
  openBoard: (fileId: string) => void;
  /** Show the host's picker for a board file, and open the one picked (Slice 5A.2). */
  openBoardFile: () => void;
  /** Ask for the shelf again (the browser opening). */
  refresh: () => void;
  /** Delete a saved board's file; the rail asks the writer to confirm first. */
  deleteBoard: (fileId: string) => void;
  /** Name a saved board's file, or (`null`) the board on screen, or the one `target` names (PR #167 F-02); an empty name unnames it (Slice 5A.1). */
  renameBoard: (fileId: string | null, name: string, target?: LightboxBoardsRenameTarget) => void;
  /** Put away the outcome shown (PR #167 F-03). */
  dismissOutcome: () => void;
}

/** Nothing: the saved boards are files the host keeps. */
export type LightboxBoardsPersistence = Record<string, never>;

export type UseLightboxBoardsReturn = LightboxBoardsState & LightboxBoardsActions & {
  persistedState: LightboxBoardsPersistence;
};

const SOURCE = 'webview.lightbox.boards';
const NO_PERSISTENCE: LightboxBoardsPersistence = {};

interface ShelfAnswer {
  boardId: string | null;
  adoption: number | null;
  observation: number;
  shelf: LightboxBoardShelf;
}

/** Whether `next` was observed before `held`, the shelf held for the same board: an earlier adoption, or earlier within one. */
function observedBefore(next: ShelfAnswer, held: ShelfAnswer | null): boolean {
  if (!held || held.boardId !== next.boardId) {
    return false;
  }
  const heldAdoption = held.adoption ?? -1;
  const nextAdoption = next.adoption ?? -1;
  return nextAdoption < heldAdoption || (nextAdoption === heldAdoption && next.observation < held.observation);
}

export function useLightboxBoards({ board }: UseLightboxBoardsArgs): UseLightboxBoardsReturn {
  const vscode = useVSCodeApi();
  const boardId = board?.boardId ?? null;
  const [answer, setAnswer] = React.useState<ShelfAnswer | null>(null);
  const [opening, setOpening] = React.useState<string | null>(null);
  const [openingFile, setOpeningFile] = React.useState(false);
  const [outcome, setOutcome] = React.useState<string | null>(null);
  // The open, delete and rename requests still unanswered: each answer's notice is an outcome, taken or not.
  const mutations = React.useRef(new Set<string>());
  // The board on screen as last rendered: a pushed shelf is taken only for it.
  const onScreen = React.useRef(boardId);
  onScreen.current = boardId;
  const pending = React.useRef<string | null>(null);
  const held = React.useRef<ShelfAnswer | null>(null);
  // The board the shelf held was answered for: a board change asks again only when it differs.
  const answeredFor = React.useRef<string | null | undefined>(undefined);
  // Request ids: this webview's prefix, so a reloaded webview never takes an answer meant for the one before it.
  const ids = React.useRef({ prefix: `lbx-brd-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const send = React.useCallback((type: MessageType, payload: object) => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    pending.current = requestId;
    if (type !== MessageType.LIGHTBOX_REQUEST_BOARDS) {
      mutations.current.add(requestId);
    }
    vscode.postMessage({ type, source: SOURCE, payload: { requestId, ...payload }, timestamp: Date.now() });
  }, [vscode]);

  /** Ask for the shelf of the board on screen, unless the one held already describes it. */
  const requestShelfForBoard = React.useCallback(() => {
    setOpening(null);
    setOpeningFile(false);
    if (answeredFor.current === boardId && boardId !== null) {
      pending.current = null;
      return;
    }
    send(MessageType.LIGHTBOX_REQUEST_BOARDS, { boardId });
  }, [boardId, send]);

  React.useEffect(() => {
    requestShelfForBoard();
  }, [requestShelfForBoard]);

  /** Hold a shelf, unless the one held for the same board was observed after it. */
  const take = React.useCallback((next: ShelfAnswer): void => {
    if (observedBefore(next, held.current)) {
      return;
    }
    held.current = next;
    answeredFor.current = next.boardId;
    setAnswer(next);
  }, []);

  const handleBoards = React.useCallback((message: LightboxBoardsMessage) => {
    const payload = message.payload;
    if (!payload?.shelf) {
      return;
    }
    const next: ShelfAnswer = {
      boardId: payload.boardId, adoption: payload.adoption ?? null, observation: payload.observation ?? 0, shelf: payload.shelf
    };
    if (payload.requestId !== null && mutations.current.delete(payload.requestId)) {
      // An open's, a delete's or a rename's answer says how it went, whichever shelf is shown (PR #167 F-03).
      setOutcome(payload.shelf.notice ?? null);
    }
    if (payload.requestId === null) {
      if (payload.boardId !== null && payload.boardId === onScreen.current) {
        take(next);
      }
      return;
    }
    if (payload.requestId !== pending.current) {
      return;
    }
    pending.current = null;
    setOpening(null);
    setOpeningFile(false);
    take(next);
  }, [take]);

  const openBoard = React.useCallback((fileId: string) => {
    setOpening(fileId);
    send(MessageType.LIGHTBOX_OPEN_BOARD, { fileId });
  }, [send]);

  const openBoardFile = React.useCallback(() => {
    setOpeningFile(true);
    send(MessageType.LIGHTBOX_OPEN_BOARD_FILE, {});
  }, [send]);

  const refresh = React.useCallback(() => {
    answeredFor.current = undefined;
    send(MessageType.LIGHTBOX_REQUEST_BOARDS, { boardId });
  }, [boardId, send]);

  const deleteBoard = React.useCallback((fileId: string) => {
    // The held shelf lists the file until the answer lands: coming back to this board asks again (PR #163 N-01).
    answeredFor.current = undefined;
    send(MessageType.LIGHTBOX_DELETE_BOARD, { boardId, fileId });
  }, [boardId, send]);

  const renameBoard = React.useCallback((fileId: string | null, name: string, target?: LightboxBoardsRenameTarget) => {
    // The name sheet's board, by id and adoption (PR #167 F-02): never the board on screen when another came since.
    const named = fileId === null && target ? target.boardId : boardId;
    if (named !== null || fileId !== null) {
      // As for a Delete: the held shelf shows the old name until the answer lands, so coming back asks again.
      answeredFor.current = undefined;
      send(MessageType.LIGHTBOX_RENAME_BOARD, {
        boardId: named, fileId, name, ...(fileId === null && target && target.adoption !== null ? { adoption: target.adoption } : {})
      });
    }
  }, [boardId, send]);

  const dismissOutcome = React.useCallback(() => setOutcome(null), []);

  const shown = answer && answer.boardId === boardId ? answer : null;
  const shelf = shown?.shelf ?? null;
  return {
    shelf,
    opening,
    openingFile,
    adoption: shown?.adoption ?? null,
    outcome,
    handleBoards,
    openBoard,
    openBoardFile,
    refresh,
    deleteBoard,
    renameBoard,
    dismissOutcome,
    persistedState: NO_PERSISTENCE
  };
}
