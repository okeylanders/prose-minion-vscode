/**
 * ShowVsTellVariantCard — one variant in the grouped workup (Sprint 05;
 * design Spread 04).
 *
 * Controlled presentation only: it renders contract state and raises semantic
 * callbacks. Gains and costs are plain text with UI-supplied bold labels —
 * React escapes them, and nothing here parses Markdown or HTML. Model-declared
 * invariant flags render passively in Creative Variations' warning treatment;
 * they never block keeping or committing. The word count is deterministic.
 */

import * as React from 'react';
import type {
  WorkshopShowVsTellCarryMode,
  WorkshopShowVsTellInvariantFlag,
  WorkshopShowVsTellVariant
} from '@messages';
import { Icon } from '@components/shared/Icon';
import {
  SHOW_VS_TELL_CHANNELS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellWordCount
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

export interface ShowVsTellVariantCardProps {
  variant: WorkshopShowVsTellVariant;
  /** One-based position across the whole workup, used only for names. */
  ordinal: number;
  kept: boolean;
  /** Meaningful only while kept; a newly kept variant carries its direction. */
  carryMode: WorkshopShowVsTellCarryMode;
  interactionLocked: boolean;
  onToggleKeep: (variantId: string) => void;
  onCarryModeChange: (variantId: string, mode: WorkshopShowVsTellCarryMode) => void;
}

const invariantFieldLabel = (flag: WorkshopShowVsTellInvariantFlag): string =>
  flag.invariantField === 'must-survive' ? 'Must survive' : 'Must not change';

const channelLabel = (id: WorkshopShowVsTellVariant['channels'][number]): string =>
  SHOW_VS_TELL_CHANNELS.find((descriptor) => descriptor.id === id)?.label ?? id;

export const ShowVsTellVariantCard: React.FC<ShowVsTellVariantCardProps> = ({
  variant,
  ordinal,
  kept,
  carryMode,
  interactionLocked,
  onToggleKeep,
  onCarryModeChange
}) => {
  const hardConflict = variant.invariantFlags.some((flag) => flag.kind === 'hard-conflict');
  const headingId = `pm-ws-svt-variant-${ordinal}`;
  const conflictNoteId = `pm-ws-svt-variant-${ordinal}-conflict`;

  return (
    <article
      className={[
        'pm-ws-svt-card',
        kept ? 'pm-ws-svt-card-selected' : '',
        hardConflict ? 'pm-ws-svt-card-conflict' : ''
      ].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <div className="pm-ws-svt-card-head">
        <button
          type="button"
          role="checkbox"
          aria-checked={kept}
          className="pm-ws-svt-card-select"
          aria-label={`Keep variant ${ordinal}`}
          aria-describedby={hardConflict ? conflictNoteId : undefined}
          disabled={interactionLocked}
          onClick={() => onToggleKeep(variant.id)}
        >
          <span className="pm-ws-svt-card-bx" aria-hidden="true">
            <Icon name="check" size={10} />
          </span>
        </button>
        <h4 id={headingId}>
          <span className="pm-ws-svt-card-pos">Variant {ordinal}</span>
        </h4>
        <span className="pm-ws-svt-card-words">{showVsTellWordCount(variant.prose)} w</span>
      </div>

      <blockquote className="pm-ws-svt-card-prose">{variant.prose}</blockquote>
      <p className="pm-ws-svt-card-channels">
        {variant.channels.map(channelLabel).join(' + ')}
      </p>

      <p className="pm-ws-svt-card-direction">
        <b>Direction</b>
        <span>{variant.direction}</span>
      </p>

      <p className="pm-ws-svt-card-tradeoff">
        <span><b>Gains</b> {variant.gains}</span>
        <span><b>Costs</b> {variant.costs}</span>
      </p>

      {hardConflict && (
        <p className="pm-ws-svt-card-conflict-note" id={conflictNoteId}>
          <Icon name="alert" size={12} />
          Strong warning — the model declared a hard conflict with “Must not change”.
          You remain the authority: this variant can still be kept and committed.
        </p>
      )}

      {variant.invariantFlags.length > 0 && (
        <ul className="pm-ws-svt-card-flags">
          {variant.invariantFlags.map((flag) => (
            <li key={flag.id}>
              <span
                className={`pm-ws-svt-flag ${
                  flag.kind === 'hard-conflict' ? 'pm-ws-svt-flag-conflict' : 'pm-ws-svt-flag-risk'
                }`}
              >
                <Icon name={flag.kind === 'hard-conflict' ? 'x' : 'alert'} size={9} />
                {flag.kind === 'hard-conflict' ? 'Hard conflict with' : 'Advisory for'}{' '}
                {invariantFieldLabel(flag)}: {flag.note}
              </span>
            </li>
          ))}
        </ul>
      )}

      {kept && (
        <div className="pm-ws-svt-card-foot">
          <div
            className="pm-ws-svt-carry"
            role="group"
            aria-label={`Carry mode for variant ${ordinal}`}
          >
            <span className="pm-ws-svt-carry-cap">commit as</span>
            <button
              type="button"
              aria-pressed={carryMode === 'prose'}
              disabled={interactionLocked}
              onClick={() => onCarryModeChange(variant.id, 'prose')}
            >
              prose variant
            </button>
            <button
              type="button"
              aria-pressed={carryMode === 'direction'}
              disabled={interactionLocked}
              onClick={() => onCarryModeChange(variant.id, 'direction')}
            >
              direction only
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
