/**
 * The writer's own message and its reactions as a tapback (ADR 2026-11-07 D8;
 * Slice 3c): the reaction cluster sits on the bubble's bottom-right corner,
 * half on its edge and half below, so it reads as being on the message.
 *
 * The cluster follows the text in the DOM, so screen readers and the tab
 * order reach it after the words and before the action row; its place is
 * CSS alone (`reactions.css`). The frame is a one-column grid holding the
 * bubble and the corner, so a cluster wider than a short message widens the
 * bubble instead of spilling past its left edge, and the action row below
 * clears the overhang because the corner is in flow. Only a bubble with
 * reactions is marked `data-pm-reaction-tapback`, and only it reserves room
 * for the overlap: a writer's message with none keeps 3b's spacing.
 *
 * Every behavior is the corner's own (`WorkshopTurnReactionCorner`): remove
 * or hide, the double-activation guard, locked-room `aria-disabled`, and
 * focus after a removal (next, previous, then the turn).
 */

import * as React from 'react';
import type { WorkshopTurn } from '@messages';
import { type WorkshopReactionControls, WorkshopTurnReactionCorner } from './WorkshopTurnReactions';

export interface WorkshopWriterMessageProps {
  turn: WorkshopTurn;
  reactions?: WorkshopReactionControls;
}

export const WorkshopWriterMessage: React.FC<WorkshopWriterMessageProps> = ({ turn, reactions }) => {
  const tapback = reactions !== undefined && reactions.reactionsOf(turn.id).length > 0;
  return (
    <div
      className={`pm-ws-turn-message-frame${tapback ? ' pm-ws-turn-message-frame-tapback' : ''}`}
      data-pm-reaction-tapback={tapback ? '' : undefined}
    >
      <div className="pm-ws-turn-message">{turn.content}</div>
      {reactions && <WorkshopTurnReactionCorner turn={turn} controls={reactions} />}
    </div>
  );
};
