/**
 * useLightboxHandoff — the Lightbox's handoffs to the Workshop, as its webview
 * asks for them (ADR 2026-10-19 D11), mirroring the host's `LightboxHandler`
 * handoff route (`LightboxHandoffRoute`).
 *
 * The webview only names an item on the board on screen; the host resolves
 * it, checks it again against the chapter and carries it into the Workshop's
 * own message path, then answers with `LIGHTBOX_HAND_OFF_RESULT`. One handoff
 * is in flight at a time, as the host takes them, and an answer counts only
 * for the request it answers (kind, board and item). Nothing here is
 * persisted: the answer is transient, and what the Workshop holds is the
 * Workshop's.
 *
 * - **Build as a lens (Slice 3):** a pinned borrowed field.
 * - **Bring to Workshop (Slice 4):** a reading tile, staged above the
 *   Workshop composer.
 * - **The tray (Slice 4):** the tiles the Workshop holds now, as its host
 *   posts them (`LIGHTBOX_WORKSHOP_TRAY`): confirmed stages only, never a
 *   request still on its way. "Open Workshop →" asks the host to reveal it.
 */

import * as React from 'react';
import {
  LightboxHandOffPayload,
  LightboxOpinionViewId,
  LightboxHandOffResultMessage,
  LightboxWorkshopTrayMessage,
  LightboxWorkshopTrayTile,
  MessageType
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  LightboxHandOffState,
  lightboxBuildLensRequest,
  lightboxHandOffAnswers
} from '@hooks/domain/lightbox/lightboxHandoff';
import { lightboxBringRequest } from '@hooks/domain/lightbox/lightboxBring';

export interface LightboxHandoffState {
  /** The latest handoff this webview asked for, and the host's answer. */
  handoff: LightboxHandOffState | null;
  /** The Lightbox tiles waiting above the Workshop composer, as the Workshop holds them. */
  tray: LightboxWorkshopTrayTile[];
}

export interface LightboxHandoffActions {
  handleHandOffResult: (message: LightboxHandOffResultMessage) => void;
  handleWorkshopTray: (message: LightboxWorkshopTrayMessage) => void;
  /** Ask the host to build a pinned borrowed field as a lens in the Workshop. */
  buildLens: (fieldId: string) => void;
  /** Ask the host to stage a reading tile above the Workshop composer; for the Opinion, the view on show. */
  bringTile: (tileId: string, view?: LightboxOpinionViewId) => void;
  /** The tray's "Open Workshop →". */
  openWorkshop: () => void;
}

/** Nothing: the answer is transient, and the Workshop owns what it holds. */
export type LightboxHandoffPersistence = Record<string, never>;

export type UseLightboxHandoffReturn = LightboxHandoffState & LightboxHandoffActions & {
  persistedState: LightboxHandoffPersistence;
};

export interface UseLightboxHandoffOptions {
  /** The board on screen; a handoff names it. */
  boardId?: string;
}

const SOURCE = 'webview.lightbox';
const NO_PERSISTENCE: LightboxHandoffPersistence = {};

export function useLightboxHandoff({ boardId }: UseLightboxHandoffOptions): UseLightboxHandoffReturn {
  const vscode = useVSCodeApi();
  const [handoff, setHandoff] = React.useState<LightboxHandOffState | null>(null);
  const [tray, setTray] = React.useState<LightboxWorkshopTrayTile[]>([]);

  const handleHandOffResult = React.useCallback((message: LightboxHandOffResultMessage) => {
    const result = message.payload;
    if (!result) {
      return;
    }
    setHandoff((current) => (lightboxHandOffAnswers(current, result) ? { status: 'answered', result } : current));
  }, []);

  const handleWorkshopTray = React.useCallback((message: LightboxWorkshopTrayMessage) => {
    const tiles = message.payload?.tiles;
    setTray(Array.isArray(tiles) ? tiles : []);
  }, []);

  const send = React.useCallback((request: LightboxHandOffPayload) => {
    if (handoff?.status === 'sending') {
      return;
    }
    setHandoff({ status: 'sending', request });
    vscode.postMessage({
      type: MessageType.LIGHTBOX_HAND_OFF,
      source: SOURCE,
      payload: request,
      timestamp: Date.now()
    });
  }, [handoff, vscode]);

  const buildLens = React.useCallback((fieldId: string) => {
    if (boardId) {
      send(lightboxBuildLensRequest(boardId, fieldId));
    }
  }, [boardId, send]);

  const bringTile = React.useCallback((tileId: string, view?: LightboxOpinionViewId) => {
    if (boardId) {
      send(lightboxBringRequest(boardId, tileId, view));
    }
  }, [boardId, send]);

  const openWorkshop = React.useCallback(() => {
    vscode.postMessage({ type: MessageType.LIGHTBOX_OPEN_WORKSHOP, source: SOURCE, payload: {}, timestamp: Date.now() });
  }, [vscode]);

  return {
    handoff,
    tray,
    handleHandOffResult,
    handleWorkshopTray,
    buildLens,
    bringTile,
    openWorkshop,
    persistedState: NO_PERSISTENCE
  };
}
