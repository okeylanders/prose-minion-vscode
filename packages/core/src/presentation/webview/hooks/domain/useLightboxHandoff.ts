/**
 * useLightboxHandoff — the Lightbox's handoffs to the Workshop, as its webview
 * asks for them (ADR 2026-10-19 D11), mirroring the host's `LightboxHandler`
 * handoff route.
 *
 * The webview only names an item on the board on screen; the host resolves
 * it, checks it again against the chapter and carries it into the Workshop's
 * own message path, then answers with `LIGHTBOX_HAND_OFF_RESULT`. One handoff
 * is in flight at a time, as the host takes them, and an answer counts only
 * for the request it answers. Nothing here is persisted: the answer is
 * transient, and what the Workshop holds is the Workshop's.
 *
 * - **Build as a lens (Slice 3):** a pinned borrowed field.
 */

import * as React from 'react';
import { LightboxHandOffResultMessage, MessageType } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  LightboxHandOffState,
  lightboxBuildLensRequest,
  lightboxHandOffAnswers
} from '@hooks/domain/lightbox/lightboxHandoff';

export interface LightboxHandoffState {
  /** The latest handoff this webview asked for, and the host's answer. */
  handoff: LightboxHandOffState | null;
}

export interface LightboxHandoffActions {
  handleHandOffResult: (message: LightboxHandOffResultMessage) => void;
  /** Ask the host to build a pinned borrowed field as a lens in the Workshop. */
  buildLens: (fieldId: string) => void;
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

  const handleHandOffResult = React.useCallback((message: LightboxHandOffResultMessage) => {
    const result = message.payload;
    if (!result) {
      return;
    }
    setHandoff((current) => (lightboxHandOffAnswers(current, result) ? { status: 'answered', result } : current));
  }, []);

  const buildLens = React.useCallback((fieldId: string) => {
    if (!boardId || handoff?.status === 'sending') {
      return;
    }
    setHandoff({ status: 'sending', boardId, fieldId });
    vscode.postMessage({
      type: MessageType.LIGHTBOX_HAND_OFF,
      source: SOURCE,
      payload: lightboxBuildLensRequest(boardId, fieldId),
      timestamp: Date.now()
    });
  }, [boardId, handoff, vscode]);

  return { handoff, handleHandOffResult, buildLens, persistedState: NO_PERSISTENCE };
}
