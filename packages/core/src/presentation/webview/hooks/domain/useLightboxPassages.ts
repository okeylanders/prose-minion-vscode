/**
 * useLightboxPassages — the inspector's passages (Slice 4E), mirroring the
 * host's `LightboxPassageHandler`.
 *
 * When the pin has a passage (a paragraph, or a counted term the board
 * lists), it asks the host for it with `LIGHTBOX_REQUEST_PASSAGE`, naming the
 * board on screen by id and content hash, and takes `LIGHTBOX_PASSAGE` only
 * when it answers the request still pending, for that board and text
 * (PR #149 F-03, PR #154 F-01). A new pin, a new board or changed text asks
 * again and drops what was pending; a board message that changes only the
 * readings asks nothing; going back to the pin (or board) whose answer is
 * held asks nothing and drops what was pending too (PR #159 F-01). So the
 * pending request is always the pin on screen's, and an answer is taken only
 * for it. Until the answer lands, the well says it is waiting, or that the
 * text changed when the same pin was showing an older board's passage
 * (`buildLightboxPassageWellView`).
 *
 * Nothing persists. The chapter's text stays in memory while it is pinned;
 * the pin itself (ids, and the term a paragraph was reached from) is
 * `useLightbox`'s preference.
 */

import * as React from 'react';
import { LightboxBoard, LightboxPassageMessage, MessageType } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import {
  LightboxPassageAnswer,
  LightboxPassageWellView,
  buildLightboxPassageWellView,
  lightboxPassageItemKey,
  lightboxPassageItemOf,
  lightboxPassageRequestKey
} from '@hooks/domain/lightbox/lightboxPassages';

export interface UseLightboxPassagesArgs {
  board: LightboxBoard | null;
  /** The pinned item (`useLightbox`'s). */
  selected: LightboxItemRef | null;
}

export interface LightboxPassagesState {
  /** The pinned item's well, or null when it has no passage. */
  well: LightboxPassageWellView | null;
}

export interface LightboxPassagesActions {
  handlePassage: (message: LightboxPassageMessage) => void;
}

/** Nothing: the text is the host's, and the pin is persisted by `useLightbox`. */
export type LightboxPassagesPersistence = Record<string, never>;

export type UseLightboxPassagesReturn = LightboxPassagesState & LightboxPassagesActions & {
  persistedState: LightboxPassagesPersistence;
};

const SOURCE = 'webview.lightbox';
const NO_PERSISTENCE: LightboxPassagesPersistence = {};

/** The request this webview still waits for. */
interface PendingPassage {
  requestId: string;
  key: string;
  itemKey: string;
  boardId: string;
  contentHash: string;
}

export function useLightboxPassages({ board, selected }: UseLightboxPassagesArgs): UseLightboxPassagesReturn {
  const vscode = useVSCodeApi();
  const [answer, setAnswer] = React.useState<LightboxPassageAnswer | null>(null);
  const pending = React.useRef<PendingPassage | null>(null);
  const answered = React.useRef<string | null>(null);
  // Request ids: this webview's prefix, so a reloaded webview never takes an answer meant for the one before it.
  const ids = React.useRef({ prefix: `lbx-psg-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const item = React.useMemo(() => (board && selected ? lightboxPassageItemOf(board, selected) : null), [board, selected]);
  const key = board && item ? lightboxPassageRequestKey(board, item) : null;

  /**
   * Ask for the pin's passage once per board, text and item; with nothing to
   * ask, wait for nothing. What is pending is only ever the request for the
   * pin on screen: returning to a pin whose answer is held drops a request
   * made for another pin in between, so its late answer cannot replace the
   * one on screen (PR #159 F-01). That pin, pinned again, asks again.
   */
  const requestPassageForPin = React.useCallback(() => {
    if (!board || !item || !key) {
      pending.current = null;
      return;
    }
    if (pending.current?.key === key) {
      return;
    }
    if (answered.current === key) {
      pending.current = null;
      return;
    }
    ids.current.count += 1;
    const request: PendingPassage = {
      requestId: `${ids.current.prefix}-${ids.current.count}`,
      key,
      itemKey: lightboxPassageItemKey(item),
      boardId: board.boardId,
      contentHash: board.source.contentHash
    };
    pending.current = request;
    vscode.postMessage({
      type: MessageType.LIGHTBOX_REQUEST_PASSAGE,
      source: SOURCE,
      payload: { requestId: request.requestId, boardId: request.boardId, contentHash: request.contentHash, item },
      timestamp: Date.now()
    });
  }, [board, item, key, vscode]);

  React.useEffect(() => {
    requestPassageForPin();
  }, [requestPassageForPin]);

  const handlePassage = React.useCallback((message: LightboxPassageMessage) => {
    const payload = message.payload;
    const waiting = pending.current;
    if (
      !payload || !waiting || !payload.passage ||
      payload.requestId !== waiting.requestId ||
      payload.boardId !== waiting.boardId ||
      payload.contentHash !== waiting.contentHash
    ) {
      return;
    }
    pending.current = null;
    answered.current = waiting.key;
    setAnswer({
      key: waiting.key,
      itemKey: waiting.itemKey,
      boardId: payload.boardId,
      contentHash: payload.contentHash,
      passage: payload.passage
    });
  }, []);

  const well = React.useMemo(
    () => (board && selected ? buildLightboxPassageWellView(board, selected, answer) : null),
    [answer, board, selected]
  );

  return { well, handlePassage, persistedState: NO_PERSISTENCE };
}
