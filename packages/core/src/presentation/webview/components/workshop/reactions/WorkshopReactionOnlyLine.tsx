/**
 * A persona reply that held only a reaction (ADR 2026-11-07 R1), drawn as a
 * slim line in the thread: "Jill reacted ❤️". The chip itself lands on the
 * writer's bubble; this line keeps the reply addressable, so Rewind, Branch
 * and bookmarks still reach it. The writer cannot react to it (Q10), so it
 * offers no palette.
 */

import * as React from 'react';
import type { WorkshopTurn } from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopReaction, type WorkshopReactionId } from '@shared/constants/workshopReactions';

export interface WorkshopReactionOnlyLineProps {
  turn: WorkshopTurn;
  reaction: WorkshopReactionId;
  /** The bubble's turn-identity attribute, so a jump to this turn finds it. */
  identity: Readonly<Record<string, string>>;
  /** The reply's bookmark, Rewind and Branch actions, as its bubble would show them. */
  actions: React.ReactNode;
}

/** "Jill" for a persona reply, by its deterministic label. */
const authorOf = (turn: WorkshopTurn): string =>
  turn.personaLabel ?? (turn.personaId ? workshopPersonaLabel(turn.personaId) : 'A persona');

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopReactionOnlyLine: React.FC<WorkshopReactionOnlyLineProps> = ({ turn, reaction, identity, actions }) => {
  const definition = workshopReaction(reaction);
  return (
    <div className="pm-ws-reaction-only" {...identity} tabIndex={-1}>
      <span className="pm-ws-reaction-only-line">
        {authorOf(turn)} reacted{' '}
        <span role="img" aria-label={definition.label}>{definition.glyph}</span>
      </span>
      {actions && <span className="pm-ws-turn-actions pm-ws-reaction-only-actions">{actions}</span>}
    </div>
  );
};
