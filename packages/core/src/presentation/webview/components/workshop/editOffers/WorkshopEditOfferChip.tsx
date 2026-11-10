/**
 * One edit-offer chip (ADR 2026-11-10 U2, U5, U6; epic Slice 3): a single
 * button that never unmounts or moves, so focus stays on it from the press
 * to the answer.
 *
 * - **A press** asks the reply's author (open, ask again), goes to the
 *   answer (answered), or does nothing (asked; the room's Stop ends the run).
 * - **Waiting** (U5): a chip that cannot be pressed right now stays
 *   focusable (`aria-disabled`), with the reason as its description.
 * - **Words, not color:** every face reads differently, and the description
 *   carries the host's words for a press that left no answer.
 *
 * The outcome is announced by the edit-offers hook's live region, never here.
 */

import * as React from 'react';
import type { WorkshopEditOffer, WorkshopEditOfferKind } from '@messages';
import { Icon } from '@components/shared/Icon';
import {
  workshopEditOfferChipView,
  workshopEditOfferKey,
  type WorkshopEditOfferChipFacts
} from '@hooks/domain/workshop/editOffers/workshopEditOfferChipView';

/** What the thread can ask of a reply's offers; WorkshopApp wires the hook in. */
export interface WorkshopEditOfferControls {
  /** A reply is running in the room. */
  running: boolean;
  /** The room's mutation lock is held. */
  locked: boolean;
  askingOffers: ReadonlySet<string>;
  offerFeedback: ReadonlyMap<string, string>;
  /** `option` names one version of an offer with options, by its index. */
  onAsk: (turnId: string, kind: WorkshopEditOfferKind, option?: number) => void;
  /** Move focus to a turn's bubble: an answer from its chip, a source reply from a link. */
  onGoToTurn: (turnId: string) => void;
}

export interface WorkshopEditOfferChipProps {
  turnId: string;
  personaLabel: string;
  offer: WorkshopEditOffer;
  /** One version of an offer with options: its index. Absent for an offer's one chip. */
  option?: number;
  controls: WorkshopEditOfferControls;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopEditOfferChip: React.FC<WorkshopEditOfferChipProps> = ({ turnId, personaLabel, offer, option, controls }) => {
  const key = workshopEditOfferKey(turnId, offer.kind, option);
  const feedback = controls.offerFeedback.get(key);
  const facts: WorkshopEditOfferChipFacts = {
    personaLabel,
    asking: controls.askingOffers.has(key),
    running: controls.running,
    locked: controls.locked,
    ...(feedback ? { feedback } : {})
  };
  const view = workshopEditOfferChipView(offer, facts, option);
  const descriptionId = React.useId();
  const description = view.waiting ?? view.feedback;
  const inert = view.press.kind === 'none' || view.waiting !== undefined;

  const press = () => {
    if (view.waiting !== undefined) {
      return;
    }
    if (view.press.kind === 'ask') {
      if (option === undefined) {
        controls.onAsk(turnId, offer.kind);
      } else {
        controls.onAsk(turnId, offer.kind, option);
      }
    } else if (view.press.kind === 'go') {
      controls.onGoToTurn(view.press.answerTurnId);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`pm-ws-offer pm-ws-offer-${view.face}`}
        data-pm-offer={offer.kind}
        data-pm-offer-option={option}
        aria-label={view.name}
        aria-busy={view.face === 'asked' || undefined}
        aria-disabled={inert || undefined}
        aria-describedby={description ? descriptionId : undefined}
        title={description ?? view.name}
        onClick={press}
      >
        {view.face === 'asked' && <span className="pm-ws-offer-dot" aria-hidden="true" />}
        {view.face === 'answered' && <Icon name="check" size={12} className="pm-ws-offer-ok" />}
        <span aria-hidden="true">
          {view.face !== 'asked' && view.face !== 'answered' && view.count !== undefined
            ? <><b>{view.count}</b> {view.words}</>
            : view.label}
        </span>
        {view.face === 'answered' && <Icon name="chevDown" size={12} />}
      </button>
      {description && (
        <span id={descriptionId} className="pm-ws-visually-hidden">{description}</span>
      )}
    </>
  );
};
