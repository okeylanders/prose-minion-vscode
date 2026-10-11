/**
 * The five-step segmented continuum (Sprint 05; design Spread 04).
 *
 * Telling → showing is an order, not a ranking: every step is a tool, the
 * selected step's tradeoff line is generic copy that reads true for any beat,
 * and nothing here scores, colours, or recommends a position. Controlled
 * presentation only — the authoring controller owns the position.
 */

import * as React from 'react';
import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';
import {
  SHOW_VS_TELL_CONTINUUM_END_LABELS,
  SHOW_VS_TELL_POSITIONS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import { ShowVsTellRadioGroup } from './ShowVsTellRadioGroup';
import { ShowVsTellReadout } from './ShowVsTellReadout';

export interface ShowVsTellContinuumControlProps {
  position: NarrativeHandlingPosition;
  onPositionChange: (position: NarrativeHandlingPosition) => void;
  /** Locked only while a commit is pending; the position stays editable during generation. */
  disabled?: boolean;
}

export const ShowVsTellContinuumControl: React.FC<ShowVsTellContinuumControlProps> = ({
  position,
  onPositionChange,
  disabled = false
}) => {
  const selected = SHOW_VS_TELL_POSITIONS.find((candidate) => candidate.id === position);
  return (
    <fieldset className="pm-ws-svt-continuum">
      <legend className="pm-ws-svt-flabel">Position on the continuum</legend>
      <div className="pm-ws-svt-ends" aria-hidden="true">
        <span>{SHOW_VS_TELL_CONTINUUM_END_LABELS.tell}</span>
        <span>{SHOW_VS_TELL_CONTINUUM_END_LABELS.show}</span>
      </div>
      <ShowVsTellRadioGroup
        className="pm-ws-svt-steps"
        ariaLabel="Position on the continuum"
        value={position}
        onChange={onPositionChange}
        disabled={disabled}
        optionClassName={(selected) => `pm-ws-svt-step${selected ? ' pm-ws-svt-step-on' : ''}`}
        options={SHOW_VS_TELL_POSITIONS.map((step) => ({
          id: step.id,
          content: (
            <>
              <span className="pm-ws-svt-step-n">{step.name}</span>
              <span className="pm-ws-svt-step-s">{step.subtitle}</span>
            </>
          )
        }))}
      />
      <p className="pm-ws-svt-continuum-line" aria-live="polite">
        {selected?.tradeoff}
      </p>
      <ShowVsTellReadout position={position} />
    </fieldset>
  );
};
