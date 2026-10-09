/**
 * Channels to emphasize and the length budget (Sprint 05; design Spread 04).
 *
 * POV is a constraint, not a channel: the interiority chip names the POV
 * limit, and the hint says the generation is told so. At least one channel
 * stays selected. Controlled presentation only.
 */

import * as React from 'react';
import type {
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellLengthBudget,
  WorkshopShowVsTellPov
} from '@messages';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_LENGTH_BUDGETS,
  SHOW_VS_TELL_POV_MODES
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import { ShowVsTellRadioGroup } from './ShowVsTellRadioGroup';

export interface ShowVsTellChannelsBudgetProps {
  channels: readonly WorkshopShowVsTellChannel[];
  lengthBudget: WorkshopShowVsTellLengthBudget;
  pov: WorkshopShowVsTellPov;
  disabled: boolean;
  onToggleChannel: (channel: WorkshopShowVsTellChannel) => void;
  onLengthBudgetChange: (budget: WorkshopShowVsTellLengthBudget) => void;
}

/** What the interiority chip says interiority may be, given the declared POV. */
export function showVsTellInteriorityLimit(pov: WorkshopShowVsTellPov): string {
  const focal = pov.focalCharacter.trim();
  return pov.mode !== 'unspecified' && focal.length > 0
    ? `${focal}’s inference only`
    : 'POV character’s inference only';
}

export const ShowVsTellChannelsBudget: React.FC<ShowVsTellChannelsBudgetProps> = ({
  channels,
  lengthBudget,
  pov,
  disabled,
  onToggleChannel,
  onLengthBudgetChange
}) => {
  const povLabel = SHOW_VS_TELL_POV_MODES.find((mode) => mode.id === pov.mode)?.label;
  return (
    <>
      <div className="pm-ws-svt-field">
        <span className="pm-ws-svt-flabel" id="pm-ws-svt-channels-label">
          Channels to emphasize
        </span>
        <div className="pm-ws-svt-chs" role="group" aria-labelledby="pm-ws-svt-channels-label">
          {SHOW_VS_TELL_CHANNELS.map((channel) => {
            const selected = channels.includes(channel.id);
            const lastSelected = selected && channels.length === 1;
            return (
              <button
                key={channel.id}
                type="button"
                className="pm-ws-svt-ch"
                aria-pressed={selected}
                aria-disabled={lastSelected || undefined}
                title={lastSelected ? 'At least one channel stays selected.' : undefined}
                disabled={disabled}
                onClick={() => onToggleChannel(channel.id)}
              >
                {channel.label}
                {channel.id === 'interiority' && (
                  <span className="pm-ws-svt-ch-q">{showVsTellInteriorityLimit(pov)}</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="pm-ws-svt-hint">
          <b>POV constraint:</b> point of view is {povLabel}
          {pov.mode !== 'unspecified' && pov.focalCharacter.trim().length > 0
            ? ` on ${pov.focalCharacter.trim()}`
            : ''}
          , so <i>interiority</i> can only be the POV character’s own perception and inference —
          never another character’s mind. The generation is told this.
        </p>
      </div>
      <div className="pm-ws-svt-field">
        <span className="pm-ws-svt-flabel" id="pm-ws-svt-budget-label">Length budget</span>
        <ShowVsTellRadioGroup
          className="pm-ws-svt-chs"
          ariaLabelledBy="pm-ws-svt-budget-label"
          value={lengthBudget}
          onChange={onLengthBudgetChange}
          disabled={disabled}
          optionClassName={() => 'pm-ws-svt-ch'}
          options={SHOW_VS_TELL_LENGTH_BUDGETS.map((budget) => ({
            id: budget.id,
            content: budget.label
          }))}
        />
      </div>
    </>
  );
};
