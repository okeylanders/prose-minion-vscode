/**
 * The Workshop reactions' transport (ADR 2026-11-07 D2, D8): the snapshot's
 * reaction summaries, grouped by turn, and the add, remove and Hide requests.
 *
 * Reactions are host-owned: the summaries arrive with each session snapshot
 * for the turns it holds, and this hook keeps only the latest. A change posts
 * ids only (a turn id and a reaction id, and for Hide the persona's author)
 * and waits for the next snapshot; nothing is applied optimistically.
 *
 * Nothing here is persisted: the session file owns reactions, so they
 * survive save, open and reload with the room.
 */

import * as React from 'react';
import {
  MessageType,
  WorkshopHideTurnReactionPayload,
  WorkshopSessionStateMessage,
  WorkshopSetTurnReactionPayload,
  WorkshopTurnReactionSummary
} from '@messages';
import type { WorkshopReactionId } from '@shared/constants/workshopReactions';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopReactionsState {
  /** Each turn's reactions as the snapshot gave them, the writer's first. */
  reactionsByTurn: ReadonlyMap<string, readonly WorkshopTurnReactionSummary[]>;
}

export interface WorkshopReactionsActions {
  /** Add (`true`) or remove (`false`) one of the writer's reactions. */
  setTurnReaction: (turnId: string, reaction: WorkshopReactionId, reacted: boolean) => void;
  /** Hide a persona's reaction (Q6): the host removes it. */
  hideTurnReaction: (
    turnId: string,
    reaction: WorkshopReactionId,
    author: WorkshopHideTurnReactionPayload['author']
  ) => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
}

export interface WorkshopReactionsPersistence {
  // The session file owns reactions; nothing is kept in webview state.
}

export type UseWorkshopReactionsReturn = WorkshopReactionsState &
  WorkshopReactionsActions & {
    persistedState: WorkshopReactionsPersistence;
  };

export interface UseWorkshopReactionsOptions {
  /** Runs before a change posts, so a refusal the host reports next is the only error on screen. */
  onBeforeChange?: () => void;
}

const SOURCE = 'webview.workshop.reactions';
const NO_REACTIONS: ReadonlyMap<string, readonly WorkshopTurnReactionSummary[]> = new Map();
const NO_PERSISTENCE: WorkshopReactionsPersistence = {};

/** Group a snapshot's summaries by turn, keeping their order. */
export function groupWorkshopReactionsByTurn(
  summaries: readonly WorkshopTurnReactionSummary[] | undefined
): ReadonlyMap<string, readonly WorkshopTurnReactionSummary[]> {
  if (!summaries || summaries.length === 0) {
    return NO_REACTIONS;
  }
  const byTurn = new Map<string, WorkshopTurnReactionSummary[]>();
  for (const summary of summaries) {
    const list = byTurn.get(summary.turnId) ?? [];
    list.push(summary);
    byTurn.set(summary.turnId, list);
  }
  return byTurn;
}

export function useWorkshopReactions({
  onBeforeChange
}: UseWorkshopReactionsOptions = {}): UseWorkshopReactionsReturn {
  const vscode = useVSCodeApi();
  const [reactionsByTurn, setReactionsByTurn] = React.useState(NO_REACTIONS);
  const beforeChangeRef = React.useRef(onBeforeChange);
  beforeChangeRef.current = onBeforeChange;

  const post = React.useCallback((type: MessageType, payload: object) => {
    beforeChangeRef.current?.();
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const setTurnReaction = React.useCallback(
    (turnId: string, reaction: WorkshopReactionId, reacted: boolean) => {
      const payload: WorkshopSetTurnReactionPayload = { turnId, reaction, reacted };
      post(MessageType.WORKSHOP_SET_TURN_REACTION, payload);
    },
    [post]
  );

  const hideTurnReaction = React.useCallback(
    (turnId: string, reaction: WorkshopReactionId, author: WorkshopHideTurnReactionPayload['author']) => {
      const payload: WorkshopHideTurnReactionPayload = { turnId, reaction, author };
      post(MessageType.WORKSHOP_HIDE_TURN_REACTION, payload);
    },
    [post]
  );

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    setReactionsByTurn(groupWorkshopReactionsByTurn(message.payload.session.reactions));
  }, []);

  return {
    reactionsByTurn,
    setTurnReaction,
    hideTurnReaction,
    handleSessionState,
    persistedState: NO_PERSISTENCE
  };
}
