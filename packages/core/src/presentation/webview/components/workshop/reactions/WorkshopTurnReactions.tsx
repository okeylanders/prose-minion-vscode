/**
 * A bubble's reactions (ADR 2026-11-07 D8): the chips under it and the "Add
 * reaction" palette in its actions, offered only on turns the host would
 * accept (the shared `isWorkshopReactableTurn` rule, for the writer).
 *
 * - The writer's chips come first. Each is a pressed toggle named "You
 *   reacted: mind-blown"; pressing it removes the reaction.
 * - A persona's chip is named "Jill reacted: heart", with a Hide action that
 *   removes it (Q6). Persona reactions are written from Slice 3; they render
 *   from state now.
 *
 * A removed chip takes focus with it only when it held focus: the next chip
 * on the bubble takes it, or the bubble's "Add reaction" button when none
 * is left (PR #245 L2). While the room is locked the chips stay focusable
 * (`aria-disabled`) and do nothing.
 *
 * Nothing here is announced through a live region (Slice 3's).
 */

import * as React from 'react';
import type {
  WorkshopHideTurnReactionPayload,
  WorkshopTurn,
  WorkshopTurnReactionSummary
} from '@messages';
import {
  isWorkshopReactableTurn,
  workshopReaction,
  type WorkshopReactionId
} from '@shared/constants/workshopReactions';
import { WorkshopReactionPalette, workshopReactionAddButtonId } from './WorkshopReactionPalette';

/** What a bubble needs to show and change its reactions; the thread passes one for every bubble. */
export interface WorkshopReactionControls {
  reactionsOf: (turnId: string) => readonly WorkshopTurnReactionSummary[];
  /** True while the room's mutation lock is held. */
  disabled: boolean;
  onSet: (turnId: string, reaction: WorkshopReactionId, reacted: boolean) => void;
  onHide: (turnId: string, reaction: WorkshopReactionId, author: WorkshopHideTurnReactionPayload['author']) => void;
}

const WRITER = { kind: 'writer' } as const;

/** The palette for a bubble's action row, or null where the writer cannot react. */
export function workshopReactionAction(
  turn: WorkshopTurn,
  controls: WorkshopReactionControls | undefined
): React.ReactElement | null {
  if (!controls || !isWorkshopReactableTurn(turn, WRITER)) {
    return null;
  }
  const given = new Set(controls.reactionsOf(turn.id)
    .filter((summary) => summary.author.kind === 'writer')
    .map((summary) => summary.reaction));
  return (
    <WorkshopReactionPalette
      turnId={turn.id}
      given={given}
      disabled={controls.disabled}
      onPick={controls.onSet}
    />
  );
}

export interface WorkshopTurnReactionChipsProps {
  turn: WorkshopTurn;
  controls: WorkshopReactionControls;
}

const chipKey = (summary: WorkshopTurnReactionSummary): string => {
  const author = summary.author;
  return `${author.kind === 'personaGuest' ? author.personaId : author.kind}-${summary.reaction}`;
};

/** Marks each chip's one focusable control, so a removal can hand focus on. */
const FOCUS_TARGET = 'data-pm-reaction-focus';

export const WorkshopTurnReactionChips: React.FC<WorkshopTurnReactionChipsProps> = ({ turn, controls }) => {
  const summaries = controls.reactionsOf(turn.id);
  const chipsRef = React.useRef<HTMLDivElement>(null);
  // The chip whose removal was asked for, and where it stood.
  const pendingFocus = React.useRef<{ key: string; index: number } | null>(null);
  const keys = summaries.map(chipKey).join('|');

  React.useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || keys.split('|').includes(pending.key)) {
      return;
    }
    pendingFocus.current = null;
    // Focus went with the chip only if nothing else has taken it since.
    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }
    const targets = chipsRef.current?.querySelectorAll<HTMLElement>(`[${FOCUS_TARGET}]`);
    const next = targets && targets.length > 0 ? targets[Math.min(pending.index, targets.length - 1)] : undefined;
    (next ?? document.getElementById(workshopReactionAddButtonId(turn.id)))?.focus();
  }, [keys, turn.id]);

  if (summaries.length === 0) {
    return null;
  }
  const remove = (summary: WorkshopTurnReactionSummary, index: number, action: () => void) => {
    if (controls.disabled) {
      return;
    }
    pendingFocus.current = { key: chipKey(summary), index };
    action();
  };
  const lockedTitle = 'Wait for the room to finish before reacting';
  return (
    <div className="pm-ws-reaction-chips" role="group" aria-label="Reactions" ref={chipsRef}>
      {summaries.map((summary, index) => {
        const reaction = workshopReaction(summary.reaction);
        const focusTarget = { [FOCUS_TARGET]: '' };
        if (summary.author.kind === 'writer') {
          return (
            <button
              key={chipKey(summary)}
              type="button"
              className="pm-ws-reaction-chip pm-ws-reaction-chip-writer"
              aria-pressed={true}
              aria-label={`You reacted: ${reaction.label}`}
              title={controls.disabled ? lockedTitle : `Remove your ${reaction.label}`}
              aria-disabled={controls.disabled || undefined}
              {...focusTarget}
              onClick={() => remove(summary, index, () => controls.onSet(turn.id, summary.reaction, false))}
            >
              <span aria-hidden="true">{reaction.glyph}</span>
            </button>
          );
        }
        const author = summary.author;
        const name = `${summary.label} reacted: ${reaction.label}`;
        return (
          <span key={chipKey(summary)} className="pm-ws-reaction-chip pm-ws-reaction-chip-persona" role="group" aria-label={name}>
            <span aria-hidden="true">{reaction.glyph}</span>
            <span className="pm-ws-reaction-chip-name" aria-hidden="true">{summary.label}</span>
            <button
              type="button"
              className="pm-ws-reaction-hide"
              aria-label={`Hide ${summary.label}'s ${reaction.label}`}
              title={controls.disabled ? lockedTitle : `Hide ${summary.label}'s ${reaction.label}`}
              aria-disabled={controls.disabled || undefined}
              {...focusTarget}
              onClick={() => remove(summary, index, () => controls.onHide(turn.id, summary.reaction, author))}
            >
              Hide
            </button>
          </span>
        );
      })}
    </div>
  );
};
