/**
 * CreativeVariationCard — one structured take in the Creative Variations
 * workup (Sprint 03; design Spread 07).
 *
 * Controlled presentation only: the card renders contract state and raises
 * semantic callbacks. Selection, carry, and risk-acceptance truth live in the
 * authoring controller; commit rules live in the host.
 *
 * A card carrying a model-declared hard conflict against "Must not change"
 * stays fully visible — and comparable — but its select affordance is
 * disabled with a written reason, mirroring the persisted-integrity rule that
 * a selection may never reference a hard-conflict card.
 */

import * as React from 'react';
import {
  WorkshopCreativeVariationCard as CreativeVariationCardData,
  WorkshopCreativeVariationsCarryMode,
  WorkshopCreativeVariationsInvariantFlag
} from '@messages';
import { Icon } from '@components/shared/Icon';

export interface CreativeVariationCardProps {
  card: CreativeVariationCardData;
  selected: boolean;
  /** Meaningful only while selected; the contract default is `direction`. */
  carryMode: WorkshopCreativeVariationsCarryMode;
  acceptedAdvisoryRiskIds: readonly string[];
  /** Ephemeral compare mark — presentation chrome, never persisted. */
  comparing: boolean;
  interactionLocked: boolean;
  onToggleSelection: (position: number) => void;
  onCarryModeChange: (position: number, mode: WorkshopCreativeVariationsCarryMode) => void;
  onToggleAdvisoryRisk: (position: number, riskId: string) => void;
  onToggleCompare: (position: number) => void;
  onCopyProse: (position: number) => void;
}

const invariantFieldLabel = (
  flag: WorkshopCreativeVariationsInvariantFlag
): string => (flag.invariantField === 'must-survive' ? 'Must survive' : 'Must not change');

const wordCount = (text: string): number => {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
};

export const CreativeVariationCard: React.FC<CreativeVariationCardProps> = ({
  card,
  selected,
  carryMode,
  acceptedAdvisoryRiskIds,
  comparing,
  interactionLocked,
  onToggleSelection,
  onCarryModeChange,
  onToggleAdvisoryRisk,
  onToggleCompare,
  onCopyProse
}) => {
  const hardConflict = card.invariantFlags.some((flag) => flag.kind === 'hard-conflict');
  const advisoryFlags = card.invariantFlags.filter((flag) => flag.kind === 'advisory-risk');
  const conflictFlags = card.invariantFlags.filter((flag) => flag.kind === 'hard-conflict');
  const headingId = `pm-ws-cvx-card-${card.position}-approach`;
  const conflictNoteId = `pm-ws-cvx-card-${card.position}-conflict`;

  return (
    <article
      className={[
        'pm-ws-cvx-card',
        selected ? 'pm-ws-cvx-card-selected' : '',
        hardConflict ? 'pm-ws-cvx-card-conflict' : ''
      ].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <div className="pm-ws-cvx-card-head">
        <button
          type="button"
          className="pm-ws-cvx-card-select"
          aria-pressed={selected}
          aria-label={`Select Take ${card.position} — ${card.approach}`}
          aria-describedby={hardConflict ? conflictNoteId : undefined}
          disabled={interactionLocked || hardConflict}
          onClick={() => onToggleSelection(card.position)}
        >
          <span className="pm-ws-cvx-card-bx" aria-hidden="true">
            <Icon name="check" size={10} />
          </span>
        </button>
        <h4 id={headingId}>
          <span className="pm-ws-cvx-card-pos">Take {card.position}</span>
          {card.approach}
        </h4>
        <span className="pm-ws-cvx-card-words">{wordCount(card.prose)} w</span>
      </div>

      <blockquote className="pm-ws-cvx-card-prose">{card.prose}</blockquote>

      <p className="pm-ws-cvx-card-direction">
        <b>Portable direction</b>
        <span>{card.direction}</span>
      </p>

      <p className="pm-ws-cvx-card-tradeoff">
        <span><b>Gains</b> {card.tradeoff.gain}</span>
        <span><b>Costs</b> {card.tradeoff.cost}</span>
      </p>

      {hardConflict && (
        <p className="pm-ws-cvx-card-conflict-note" id={conflictNoteId}>
          <Icon name="alert" size={12} />
          Cannot commit — the model declared a hard conflict with “Must not change”.
          The take stays visible for comparison.
        </p>
      )}

      {(advisoryFlags.length > 0 || conflictFlags.length > 0) && (
        <ul className="pm-ws-cvx-card-flags">
          {conflictFlags.map((flag) => (
            <li key={flag.id}>
              <span className="pm-ws-cvx-flag pm-ws-cvx-flag-conflict">
                <Icon name="x" size={9} />
                Hard conflict with {invariantFieldLabel(flag)}: {flag.note}
              </span>
            </li>
          ))}
          {advisoryFlags.map((flag) => {
            const accepted = acceptedAdvisoryRiskIds.includes(flag.id);
            return (
              <li key={flag.id}>
                {selected ? (
                  <button
                    type="button"
                    className={`pm-ws-cvx-flag pm-ws-cvx-flag-risk${accepted ? ' pm-ws-cvx-flag-accepted' : ''}`}
                    aria-pressed={accepted}
                    aria-label={
                      `${accepted ? 'Withdraw acceptance of' : 'Accept'} advisory risk on Take ${card.position}: ${flag.note}`
                    }
                    disabled={interactionLocked}
                    onClick={() => onToggleAdvisoryRisk(card.position, flag.id)}
                  >
                    <Icon name={accepted ? 'check' : 'alert'} size={9} />
                    {accepted
                      ? `Accepted — rides with this take · ${flag.note}`
                      : `Accept risk to ${invariantFieldLabel(flag)}: ${flag.note}`}
                  </button>
                ) : (
                  <span className="pm-ws-cvx-flag pm-ws-cvx-flag-risk">
                    <Icon name="alert" size={9} />
                    Risk to {invariantFieldLabel(flag)}: {flag.note}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="pm-ws-cvx-card-foot">
        {selected && (
          <div
            className="pm-ws-cvx-carry"
            role="group"
            aria-label={`Carry mode for Take ${card.position}`}
          >
            <span className="pm-ws-cvx-carry-cap">carries</span>
            <button
              type="button"
              aria-pressed={carryMode === 'direction'}
              disabled={interactionLocked}
              onClick={() => onCarryModeChange(card.position, 'direction')}
            >
              direction · default
            </button>
            <button
              type="button"
              aria-pressed={carryMode === 'full-prose'}
              disabled={interactionLocked}
              onClick={() => onCarryModeChange(card.position, 'full-prose')}
            >
              full prose
            </button>
          </div>
        )}
        <div className="pm-ws-cvx-card-actions">
          <button
            type="button"
            className="pm-ws-cvx-card-action"
            aria-label={`Copy Take ${card.position} prose`}
            onClick={() => onCopyProse(card.position)}
          >
            <Icon name="copy" size={11} /> Copy
          </button>
          <button
            type="button"
            className={`pm-ws-cvx-card-action${comparing ? ' pm-ws-cvx-card-action-on' : ''}`}
            aria-pressed={comparing}
            aria-label={`Compare Take ${card.position} side by side`}
            onClick={() => onToggleCompare(card.position)}
          >
            <Icon name="scale" size={11} /> Compare
          </button>
        </div>
      </div>
    </article>
  );
};
