/**
 * CreativeVariationCard — one structured take in the Creative Variations
 * workup (Sprint 03; design Spread 07).
 *
 * Controlled presentation only: the card renders contract state and raises
 * semantic callbacks. Selection and carry truth live in the authoring
 * controller; commit rules live in the host.
 *
 * Model-declared invariant flags are visible evidence, never writer-authority
 * gates. Every returned card remains selectable and committable.
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
  /** Ephemeral compare mark — presentation chrome, never persisted. */
  comparing: boolean;
  interactionLocked: boolean;
  onToggleSelection: (position: number) => void;
  onCarryModeChange: (position: number, mode: WorkshopCreativeVariationsCarryMode) => void;
  onToggleCompare: (position: number) => void;
  onCopyProse: (prose: string) => void;
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
  comparing,
  interactionLocked,
  onToggleSelection,
  onCarryModeChange,
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
          disabled={interactionLocked}
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
          Strong warning — the model declared a hard conflict with “Must not change”.
          You remain the authority: this take can still be selected and committed.
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
          {advisoryFlags.map((flag) => (
            <li key={flag.id}>
              <span className="pm-ws-cvx-flag pm-ws-cvx-flag-risk">
                <Icon name="alert" size={9} />
                Advisory for {invariantFieldLabel(flag)}: {flag.note}
              </span>
            </li>
          ))}
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
            onClick={() => onCopyProse(card.prose)}
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
