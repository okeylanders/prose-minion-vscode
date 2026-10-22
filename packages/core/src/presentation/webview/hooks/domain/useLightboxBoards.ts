/**
 * useLightboxBoards — the rail's saved boards (Slice 5A), mirroring the
 * host's `LightboxBoardsHandler`.
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
 * and a newer request drops the older one. A save the host pushes
 * (`requestId: null`) is taken only for the board on screen. A shelf is shown
 * only beside the board it describes.
 *
 * Nothing persists: the files are the host's.
 */

import * as React from 'react';
import { LightboxBoard, LightboxBoardShelf, LightboxBoardsMessage, MessageType } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface UseLightboxBoardsArgs {
  board: LightboxBoard | null;
}

export interface LightboxBoardsState {
  /** The shelf of the board on screen, once the host has answered for it. */
  shelf: LightboxBoardShelf | null;
  /** The file being opened, until the host answers. */
  opening: string | null;
}

export interface LightboxBoardsActions {
  handleBoards: (message: LightboxBoardsMessage) => void;
  openBoard: (fileId: string) => void;
  /** Delete a saved board's file; the rail asks the writer to confirm first. */
  deleteBoard: (fileId: string) => void;
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
  shelf: LightboxBoardShelf;
}

export function useLightboxBoards({ board }: UseLightboxBoardsArgs): UseLightboxBoardsReturn {
  const vscode = useVSCodeApi();
  const boardId = board?.boardId ?? null;
  const [answer, setAnswer] = React.useState<ShelfAnswer | null>(null);
  const [opening, setOpening] = React.useState<string | null>(null);
  // The board on screen as last rendered: a pushed shelf is taken only for it.
  const onScreen = React.useRef(boardId);
  onScreen.current = boardId;
  const pending = React.useRef<string | null>(null);
  // The board the shelf held was answered for: a board change asks again only when it differs.
  const answeredFor = React.useRef<string | null | undefined>(undefined);
  // Request ids: this webview's prefix, so a reloaded webview never takes an answer meant for the one before it.
  const ids = React.useRef({ prefix: `lbx-brd-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const send = React.useCallback((type: MessageType, payload: object) => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    pending.current = requestId;
    vscode.postMessage({ type, source: SOURCE, payload: { requestId, ...payload }, timestamp: Date.now() });
  }, [vscode]);

  /** Ask for the shelf of the board on screen, unless the one held already describes it. */
  const requestShelfForBoard = React.useCallback(() => {
    setOpening(null);
    if (answeredFor.current === boardId && boardId !== null) {
      pending.current = null;
      return;
    }
    send(MessageType.LIGHTBOX_REQUEST_BOARDS, { boardId });
  }, [boardId, send]);

  React.useEffect(() => {
    requestShelfForBoard();
  }, [requestShelfForBoard]);

  const handleBoards = React.useCallback((message: LightboxBoardsMessage) => {
    const payload = message.payload;
    if (!payload?.shelf) {
      return;
    }
    if (payload.requestId === null) {
      if (payload.boardId !== null && payload.boardId === onScreen.current) {
        answeredFor.current = payload.boardId;
        setAnswer({ boardId: payload.boardId, shelf: payload.shelf });
      }
      return;
    }
    if (payload.requestId !== pending.current) {
      return;
    }
    pending.current = null;
    answeredFor.current = payload.boardId;
    setOpening(null);
    setAnswer({ boardId: payload.boardId, shelf: payload.shelf });
  }, []);

  const openBoard = React.useCallback((fileId: string) => {
    setOpening(fileId);
    send(MessageType.LIGHTBOX_OPEN_BOARD, { fileId });
  }, [send]);

  const deleteBoard = React.useCallback((fileId: string) => {
    if (boardId !== null) {
      send(MessageType.LIGHTBOX_DELETE_BOARD, { boardId, fileId });
    }
  }, [boardId, send]);

  const shelf = answer && answer.boardId === boardId ? answer.shelf : null;
  return { shelf, opening, handleBoards, openBoard, deleteBoard, persistedState: NO_PERSISTENCE };
}
