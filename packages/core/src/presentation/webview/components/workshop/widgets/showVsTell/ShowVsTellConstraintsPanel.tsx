/**
 * The constraints block (Sprint 05, Slice 7 design edits, D1): the point-of-
 * view constraint and the two invariant fields. Both invariants are optional
 * (D3): a blank field declares no constraint, and the model is told so.
 * Controlled presentation only.
 */

import * as React from 'react';
import type { WorkshopShowVsTellDraft, WorkshopShowVsTellPovMode } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_POV_MODES
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export interface ShowVsTellConstraintsPanelProps {
  draft: WorkshopShowVsTellDraft;
  disabled: boolean;
  onPovModeChange: (mode: WorkshopShowVsTellPovMode) => void;
  onPovFocalCharacterChange: (text: string) => void;
  onMustSurviveChange: (text: string) => void;
  onMustNotChangeChange: (text: string) => void;
}

export const ShowVsTellConstraintsPanel: React.FC<ShowVsTellConstraintsPanelProps> = ({
  draft,
  disabled,
  onPovModeChange,
  onPovFocalCharacterChange,
  onMustSurviveChange,
  onMustNotChangeChange
}) => (
  <>
    <div className="pm-ws-svt-field">
      <span className="pm-ws-svt-flabel" id="pm-ws-svt-pov-label">Point of view</span>
      <div className="pm-ws-svt-pov-row" role="group" aria-labelledby="pm-ws-svt-pov-label">
        <select
          aria-label="POV mode"
          value={draft.pov.mode}
          disabled={disabled}
          onChange={(event) => onPovModeChange(event.target.value as WorkshopShowVsTellPovMode)}
        >
          {SHOW_VS_TELL_POV_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>{mode.label}</option>
          ))}
        </select>
        <input
          type="text"
          aria-label="POV focal character"
          value={draft.pov.focalCharacter}
          maxLength={BUDGET.showVsTellPovFocalCharacterCharacters}
          disabled={disabled || draft.pov.mode === 'unspecified'}
          placeholder={draft.pov.mode === 'unspecified'
            ? 'No focal character while unspecified'
            : 'Focal character (optional)'}
          onChange={(event) => onPovFocalCharacterChange(event.target.value)}
        />
      </div>
    </div>

    <label className="pm-ws-svt-field">
      <span className="pm-ws-svt-flabel">
        Must survive every variation <i>optional</i>
      </span>
      <textarea
        value={draft.invariants.mustSurvive}
        maxLength={BUDGET.showVsTellMustSurviveCharacters}
        disabled={disabled}
        rows={3}
        placeholder="The fact, emotion, or turn every variant has to carry. Blank declares no constraint."
        onChange={(event) => onMustSurviveChange(event.target.value)}
      />
    </label>
    <label className="pm-ws-svt-field">
      <span className="pm-ws-svt-flabel">
        Must <i className="pm-ws-svt-flabel-not">not</i> change <i>optional</i>
      </span>
      <textarea
        value={draft.invariants.mustNotChange}
        maxLength={BUDGET.showVsTellMustNotChangeCharacters}
        disabled={disabled}
        rows={2}
        placeholder="Hard boundaries — e.g. no flashback; stay in the kitchen, stay in tonight."
        onChange={(event) => onMustNotChangeChange(event.target.value)}
      />
    </label>
  </>
);
