/**
 * CreativeVariationsComparison — the side-by-side reading surface Creative
 * Variations exists for (Sprint 03; design Spread 07 §4).
 *
 * Purely presentational: it renders the compared takes under the pinned
 * declared invariants and raises a dismiss callback. Which takes are compared
 * is ephemeral chrome owned by the modal — comparison never persists, and a
 * hard-conflict take may be compared even though it can never commit.
 */

import * as React from 'react';
import {
  WorkshopCreativeVariationCard,
  WorkshopCreativeVariationsInvariants
} from '@messages';
import { Icon } from '@components/shared/Icon';

export interface CreativeVariationsComparisonProps {
  /** Compared takes in position order. */
  cards: readonly WorkshopCreativeVariationCard[];
  invariants: WorkshopCreativeVariationsInvariants;
  /** Positions currently selected for commit — badged, never ranked. */
  selectedPositions: readonly number[];
  onDismiss: () => void;
}

export const CreativeVariationsComparison: React.FC<CreativeVariationsComparisonProps> = ({
  cards,
  invariants,
  selectedPositions,
  onDismiss
}) => {
  const mustNotChange = invariants.mustNotChange.trim();

  return (
    <section className="pm-ws-cvx-cmp" aria-label="Side-by-side comparison">
      <div className="pm-ws-cvx-cmp-head">
        <p className="pm-ws-cvx-cmp-inv">
          <span><b>Must survive:</b> {invariants.mustSurvive}</span>
          {mustNotChange.length > 0 && (
            <span><b>Must not change:</b> {invariants.mustNotChange}</span>
          )}
        </p>
        <button
          type="button"
          className="pm-ws-cvx-cmp-dismiss"
          aria-label="Dismiss comparison"
          onClick={onDismiss}
        >
          <Icon name="x" size={12} /> Dismiss
        </button>
      </div>
      <div className="pm-ws-cvx-cmp-cols">
        {cards.map((card) => {
          const hardConflict = card.invariantFlags.some(
            (flag) => flag.kind === 'hard-conflict'
          );
          return (
            <article
              key={card.position}
              className="pm-ws-cvx-cmp-col"
              aria-label={`Take ${card.position} — ${card.approach}`}
            >
              <h5>
                <span className="pm-ws-cvx-card-pos">Take {card.position}</span>
                {card.approach}
                {selectedPositions.includes(card.position) && (
                  <span className="pm-ws-cvx-cmp-badge">selected</span>
                )}
                {hardConflict && (
                  <span className="pm-ws-cvx-cmp-badge pm-ws-cvx-cmp-badge-conflict">
                    cannot commit
                  </span>
                )}
              </h5>
              <blockquote className="pm-ws-cvx-cmp-prose">{card.prose}</blockquote>
              <p className="pm-ws-cvx-cmp-tradeoff">
                <span><b>Gains</b> {card.tradeoff.gain}</span>
                <span><b>Costs</b> {card.tradeoff.cost}</span>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};
