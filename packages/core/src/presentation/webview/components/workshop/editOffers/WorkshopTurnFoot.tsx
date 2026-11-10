/**
 * A reply's footer (ADR 2026-11-10 U1; epic Slice 3): one row under the
 * action row. At the left, what the persona offers to do next: a quiet lead
 * "As edits" and the edit-offer chips (fixes, then rewrites), then the
 * persona's widget recommendation chip, which lives here now. At the right,
 * the reaction corner, composed as it is.
 *
 * - **No bubble gains a row.** The row wraps: in a narrow column the offers
 *   take the first line and the corner sits under them at the right.
 * - **Drawn from the host's view only** (U5): an offer the host did not send
 *   is not drawn, and there is no lead without one.
 * - **An empty footer takes no row:** with no offer, no widget chip and an
 *   empty corner (a tool report nobody reacted to), the row is hidden. The
 *   corner stays mounted inside it, as its own focus rules need.
 * - **One group** (U6) named for the persona holds the edit chips. Tab order
 *   is the DOM's: the action row above, these offers, then the reactions.
 */

import * as React from 'react';
import type { WorkshopTurn } from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopEditOfferGroupLabel } from '@hooks/domain/workshop/editOffers/workshopEditOfferChipView';
import { isWorkshopReactableTurn } from '@shared/constants/workshopReactions';
import { type WorkshopReactionControls, WorkshopTurnReactionCorner } from '../reactions/WorkshopTurnReactions';
import { WorkshopEditOfferChip, type WorkshopEditOfferControls } from './WorkshopEditOfferChip';

const WRITER = { kind: 'writer' } as const;

export interface WorkshopTurnFootProps {
  turn: WorkshopTurn;
  /** Absent reads as no offers drawn. */
  offers?: WorkshopEditOfferControls;
  /** The persona's widget recommendation chip, when the reply carries one. */
  widgetChip?: React.ReactNode;
  /** The reaction corner's controls; the corner is composed unchanged. */
  reactions?: WorkshopReactionControls;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopTurnFoot: React.FC<WorkshopTurnFootProps> = ({ turn, offers, widgetChip, reactions }) => {
  const editOffers = offers && turn.personaLabel ? turn.editOffers ?? [] : [];
  const personaLabel = turn.personaLabel ?? '';
  const hasOffers = editOffers.length > 0 || !!widgetChip;
  const cornerDrawn = !!reactions && (isWorkshopReactableTurn(turn, WRITER) || reactions.reactionsOf(turn.id).length > 0);
  return (
    <div className={`pm-ws-turn-foot${hasOffers || cornerDrawn ? '' : ' pm-ws-turn-foot-bare'}`}>
      {hasOffers && (
        <div className="pm-ws-turn-offers">
          {editOffers.length > 0 && offers && (
            <div className="pm-ws-offer-group" role="group" aria-label={workshopEditOfferGroupLabel(personaLabel)}>
              <span className="pm-ws-offer-lead" aria-hidden="true">
                <Icon name="pen" size={12} /> As edits
              </span>
              {editOffers.map((offer) => (
                <WorkshopEditOfferChip
                  key={offer.kind}
                  turnId={turn.id}
                  personaLabel={personaLabel}
                  offer={offer}
                  controls={offers}
                />
              ))}
            </div>
          )}
          {widgetChip}
        </div>
      )}
      {reactions && <WorkshopTurnReactionCorner turn={turn} controls={reactions} />}
    </div>
  );
};
