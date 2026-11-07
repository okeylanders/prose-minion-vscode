/**
 * The Workshop reactions' transport (ADR 2026-11-07 D2, D8): the snapshot's
 * reaction summaries, grouped by turn, and the add, remove and Hide requests.
 *
 * Reactions are host-owned: the summaries arrive with each session snapshot
 * for the turns it holds, and this hook keeps only the latest. A change posts
 * ids only (a turn id and a reaction id, and for Hide the persona's author)
 * and waits for the next snapshot; nothing is applied optimistically.
 *
 * A persona's new reaction (Slice 3) is announced once, politely (D8):
 * only a reaction whose carrying reply arrived live in this mount (a
 * `WORKSHOP_TURN`), in the same room (`roomRevision`), and was not already
 * in the previous snapshot, on the first snapshot after it. Hydration,
 * reload and a re-render deliver no live reply, and a room replacement
 * (Open, New, Rewind, Branch) clears what was waiting (PR #247 M2), so they
 * announce nothing.
 *
 * Nothing here is persisted: the session file owns reactions, so they
 * survive save, open and reload with the room.
 */

import * as React from 'react';
import {
  MessageType,
  WorkshopHideTurnReactionPayload,
  WorkshopSessionStateMessage,
  WorkshopTurnMessage,
  WorkshopSetTurnReactionPayload,
  WorkshopTurnReactionSummary
} from '@messages';
import { workshopReaction, type WorkshopReactionId } from '@shared/constants/workshopReactions';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopReactionsState {
  /** Each turn's reactions as the snapshot gave them, the writer's first. */
  reactionsByTurn: ReadonlyMap<string, readonly WorkshopTurnReactionSummary[]>;
  /** The polite live region's text: the latest persona reactions that arrived live, or empty. */
  announcement: string;
  /** Moves with every announcement, so the same words said twice are read twice (a keyed node). */
  announcementSerial: number;
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
  /** A turn that arrived live: a persona reply's reaction may be announced on the next snapshot. */
  noteLiveTurn: (message: WorkshopTurnMessage) => void;
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

/**
 * "Jill reacted heart to your message": one announcement for the reactions
 * whose reply arrived live and is new since the previous snapshot.
 */
export function workshopPersonaReactionAnnouncement(
  summaries: readonly WorkshopTurnReactionSummary[] | undefined,
  liveReplies: ReadonlySet<string>,
  previousTurnIds: ReadonlySet<string> = new Set()
): string {
  return (summaries ?? [])
    .filter((summary) => summary.author.kind !== 'writer' && summary.viaTurnId !== undefined
      && liveReplies.has(summary.viaTurnId) && !previousTurnIds.has(summary.viaTurnId))
    .map((summary) => `${summary.label} reacted ${workshopReaction(summary.reaction).label} to your message`)
    .join('. ');
}

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
  const [announced, setAnnounced] = React.useState({ text: '', serial: 0 });
  // Persona replies that arrived live since the last snapshot, and the room they arrived in: each has one
  // snapshot of that room to show its reaction. The previous snapshot's turns are never announced again.
  const liveRepliesRef = React.useRef(new Set<string>());
  const roomRef = React.useRef<{ revision?: number; turnIds: ReadonlySet<string> }>({ turnIds: new Set() });
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
    const { reactions: summaries, roomRevision, turns } = message.payload.session;
    setReactionsByTurn(groupWorkshopReactionsByTurn(summaries));
    const live = liveRepliesRef.current;
    const previous = roomRef.current;
    const sameRoom = previous.revision === roomRevision;
    roomRef.current = { revision: roomRevision, turnIds: new Set(turns.map((turn) => turn.id)) };
    if (live.size > 0) {
      const text = sameRoom ? workshopPersonaReactionAnnouncement(summaries, live, previous.turnIds) : '';
      live.clear();
      if (text) {
        setAnnounced((current) => ({ text, serial: current.serial + 1 }));
      }
    }
  }, []);

  const noteLiveTurn = React.useCallback((message: WorkshopTurnMessage) => {
    const { turn } = message.payload;
    if (turn.role === 'assistant' && (turn.participant === 'host' || turn.participant === 'guest')) {
      liveRepliesRef.current.add(turn.id);
    }
  }, []);

  return {
    reactionsByTurn,
    announcement: announced.text,
    announcementSerial: announced.serial,
    setTurnReaction,
    hideTurnReaction,
    handleSessionState,
    noteLiveTurn,
    persistedState: NO_PERSISTENCE
  };
}
