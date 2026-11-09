/**
 * A bubble's reaction corner (ADR 2026-11-07 D8; Slice 3b): one small cluster
 * of its reactions in the bubble's bottom-right corner, left to right, and the
 * "Add reaction" button after it, offered only on turns the host would accept
 * (the shared `isWorkshopReactableTurn` rule, for the writer). The button is
 * always shown; a writer's own message has reactions only from personas, and
 * no button.
 *
 * - The writer's reactions come first, then personas'. Each is one button
 *   whose press removes it: "You reacted: mind-blown. Remove" unsets the
 *   writer's own; "Jill reacted: heart. Remove" hides a persona's (Q6: Hide
 *   is removal). A persona writes its reaction with a reply's trailer (D5).
 *
 * A removed reaction takes focus with it only when it held focus: the next
 * reaction in the cluster takes it, else the previous one, else the bubble's
 * "Add reaction" button, else the bubble itself (PR #245 L2, PR #247 F-01),
 * never the page. While the room is locked every button stays focusable
 * (`aria-disabled`) and does nothing.
 *
 * Once a removal is asked, the corner's reactions ignore presses until the
 * host's next snapshot of this bubble's reactions (PR #248 M1): the cluster
 * is right-aligned, so a double click would otherwise land on the reaction
 * that slid under the pointer. A snapshot that keeps the asked-for reaction
 * (the host refused) disarms the focus hand-off (L4).
 *
 * A new persona reaction is announced once by the reactions hook's live
 * region (D8), never here.
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

/** A turn with no reactions: one list, so its identity moves only with a snapshot. */
export const NO_TURN_REACTIONS: readonly WorkshopTurnReactionSummary[] = Object.freeze([]);

export interface WorkshopTurnReactionCornerProps {
  turn: WorkshopTurn;
  controls: WorkshopReactionControls;
}

const reactionKey = (summary: WorkshopTurnReactionSummary): string => {
  const author = summary.author;
  return `${author.kind === 'personaGuest' ? author.personaId : author.kind}-${summary.reaction}`;
};

/** The writer's first, then personas', each side in the host's order. */
export function workshopReactionClusterOrder(
  summaries: readonly WorkshopTurnReactionSummary[]
): WorkshopTurnReactionSummary[] {
  return [
    ...summaries.filter((summary) => summary.author.kind === 'writer'),
    ...summaries.filter((summary) => summary.author.kind !== 'writer')
  ];
}

/** Marks each reaction's button, so a removal can hand focus on. */
const FOCUS_TARGET = 'data-pm-reaction-focus';
const LOCKED_TITLE = 'Wait for the room to finish before reacting';

export const WorkshopTurnReactionCorner: React.FC<WorkshopTurnReactionCornerProps> = ({ turn, controls }) => {
  // A new snapshot gives every turn with reactions a new list, so its identity marks the host's answer.
  const snapshot = controls.reactionsOf(turn.id);
  const summaries = workshopReactionClusterOrder(snapshot);
  const reactable = isWorkshopReactableTurn(turn, WRITER);
  const cornerRef = React.useRef<HTMLDivElement>(null);
  // The reaction whose removal was asked for, and where it stood.
  const pendingFocus = React.useRef<{ key: string; index: number } | null>(null);
  // The snapshot a removal was asked against: presses wait for the next one (M1).
  const removingFrom = React.useRef<readonly WorkshopTurnReactionSummary[] | null>(null);

  React.useEffect(() => {
    removingFrom.current = null;
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    // A snapshot that keeps the reaction is a refusal: nothing to hand on (L4).
    if (!pending || snapshot.some((summary) => reactionKey(summary) === pending.key)) {
      return;
    }
    // Focus went with the reaction only if nothing else has taken it since.
    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }
    const corner = cornerRef.current;
    const targets = corner?.querySelectorAll<HTMLElement>(`[${FOCUS_TARGET}]`);
    // The next one now stands at the removed one's index; past the end, the previous one.
    const next = targets && targets.length > 0 ? targets[Math.min(pending.index, targets.length - 1)] : undefined;
    const fallback = next
      ?? document.getElementById(workshopReactionAddButtonId(turn.id))
      ?? corner?.closest<HTMLElement>('[tabindex="-1"]');
    fallback?.focus();
  }, [snapshot, turn.id]);

  const remove = (summary: WorkshopTurnReactionSummary, index: number, action: () => void) => {
    if (controls.disabled || removingFrom.current === snapshot) {
      return;
    }
    removingFrom.current = snapshot;
    pendingFocus.current = { key: reactionKey(summary), index };
    action();
  };

  const given = new Set(summaries
    .filter((summary) => summary.author.kind === 'writer')
    .map((summary) => summary.reaction));

  // The corner stays mounted, empty, so a removal's focus can still find its bubble.
  return (
    <div className="pm-ws-reaction-corner" ref={cornerRef}>
      {summaries.length > 0 && (
        <div className="pm-ws-reaction-cluster" role="group" aria-label="Reactions">
          {summaries.map((summary, index) => {
            const reaction = workshopReaction(summary.reaction);
            const author = summary.author;
            const writer = author.kind === 'writer';
            const name = `${writer ? 'You' : summary.label} reacted: ${reaction.label}. Remove`;
            return (
              <button
                key={reactionKey(summary)}
                type="button"
                className={`pm-ws-reaction-item pm-ws-reaction-item-${writer ? 'writer' : 'persona'}`}
                aria-label={name}
                title={controls.disabled ? LOCKED_TITLE : name}
                aria-disabled={controls.disabled || undefined}
                {...{ [FOCUS_TARGET]: '' }}
                onClick={() => remove(summary, index, () => {
                  if (author.kind === 'writer') {
                    controls.onSet(turn.id, summary.reaction, false);
                  } else {
                    controls.onHide(turn.id, summary.reaction, author);
                  }
                })}
              >
                <span className="pm-ws-reaction-item-glyph" aria-hidden="true">{reaction.glyph}</span>
                {!writer && <span className="pm-ws-reaction-item-name" aria-hidden="true">{summary.label}</span>}
              </button>
            );
          })}
        </div>
      )}
      {reactable && (
        <WorkshopReactionPalette
          turnId={turn.id}
          given={given}
          disabled={controls.disabled}
          onPick={controls.onSet}
        />
      )}
    </div>
  );
};
