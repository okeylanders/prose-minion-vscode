/**
 * The left column of the intake: the read-only surrounding passage (beat
 * highlighted, source labelled, with a source choice that writes the
 * reference), the point-of-view constraint, and the two invariant fields.
 *
 * The passage never rides the commit and never crosses to the host from here:
 * choosing a source writes a reference, and the host resolves the text when
 * the writer generates. Controlled presentation only.
 */

import * as React from 'react';
import type {
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellPovMode,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_POV_MODES
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellSourceReferenceKey
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import type { ShowVsTellAvailableSource } from './showVsTellAuthoringTypes';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
const PASSAGE_WINDOW_CHARACTERS = 280;
const NO_SOURCE = 'none';

export interface ShowVsTellSurroundingPanelProps {
  draft: WorkshopShowVsTellDraft;
  availableSources: readonly ShowVsTellAvailableSource[];
  /** Text of the active excerpt, when the room has one; the webview already holds it. */
  excerptText: string | null;
  disabled: boolean;
  onSelectSource: (reference: WorkshopWidgetSourceReference | null) => void;
  onPovModeChange: (mode: WorkshopShowVsTellPovMode) => void;
  onPovFocalCharacterChange: (text: string) => void;
  onMustSurviveChange: (text: string) => void;
  onMustNotChangeChange: (text: string) => void;
}

const collapse = (text: string): string => text.replace(/\s+/gu, ' ').trim();

/** The passage around the beat, with the beat split out so it can be highlighted. */
export function windowAroundBeat(
  passage: string,
  beat: string
): { before: string; match: string; after: string } | null {
  const flat = collapse(passage);
  const needle = collapse(beat);
  const at = needle.length > 0 ? flat.indexOf(needle) : -1;
  if (at < 0) {
    return null;
  }
  const start = Math.max(0, at - PASSAGE_WINDOW_CHARACTERS);
  const end = Math.min(flat.length, at + needle.length + PASSAGE_WINDOW_CHARACTERS);
  return {
    before: `${start > 0 ? '…' : ''}${flat.slice(start, at)}`,
    match: flat.slice(at, at + needle.length),
    after: `${flat.slice(at + needle.length, end)}${end < flat.length ? '…' : ''}`
  };
}

export const ShowVsTellSurroundingPanel: React.FC<ShowVsTellSurroundingPanelProps> = ({
  draft,
  availableSources,
  excerptText,
  disabled,
  onSelectSource,
  onPovModeChange,
  onPovFocalCharacterChange,
  onMustSurviveChange,
  onMustNotChangeChange
}) => {
  const reference = draft.surroundingContext.sourceReferences[0] ?? null;
  const referenceKey = reference ? showVsTellSourceReferenceKey(reference) : NO_SOURCE;
  const selectedSource = availableSources.find((source) =>
    showVsTellSourceReferenceKey(source.reference) === referenceKey);
  const windowed = reference?.kind === 'active-excerpt' && excerptText !== null
    ? windowAroundBeat(excerptText, draft.beat.text)
    : null;

  return (
    <>
      <div className="pm-ws-svt-field">
        <span className="pm-ws-svt-flabel" id="pm-ws-svt-passage-label">
          Surrounding passage
          <em className="pm-ws-svt-src">
            {reference === null
              ? 'none · beat travels alone'
              : selectedSource
                ? `from ${selectedSource.label.toLowerCase()}`
                : 'source unavailable'}
          </em>
        </span>
        <div className="pm-ws-svt-passage" role="region" aria-labelledby="pm-ws-svt-passage-label">
          {reference === null ? (
            <span className="pm-ws-svt-passage-note">
              Pick a source below to ground point of view and meaning. The generation sees only
              the beat and the constraints on this sheet.
            </span>
          ) : windowed ? (
            <>
              {windowed.before}
              <mark>{windowed.match}</mark>
              {windowed.after}
            </>
          ) : reference.kind === 'active-excerpt' && excerptText !== null ? (
            <span className="pm-ws-svt-passage-note">
              The beat is not quoted in the active excerpt, so there is nothing to highlight.
              The host still reads the excerpt when you generate.
            </span>
          ) : (
            <span className="pm-ws-svt-passage-note">
              The host reads this source when you generate. Its text is never stored here and
              never rides the commit.
            </span>
          )}
        </div>
        <div className="pm-ws-svt-sources" role="radiogroup" aria-label="Surrounding passage source">
          <label className="pm-ws-svt-source">
            <input
              type="radio"
              name="pm-ws-svt-source"
              checked={reference === null}
              disabled={disabled}
              onChange={() => onSelectSource(null)}
            />
            <span><b>No surrounding passage</b></span>
          </label>
          {availableSources.map(({ reference: candidate, label, detail }) => {
            const key = showVsTellSourceReferenceKey(candidate);
            return (
              <label className="pm-ws-svt-source" key={key}>
                <input
                  type="radio"
                  name="pm-ws-svt-source"
                  checked={referenceKey === key}
                  disabled={disabled}
                  onChange={() => onSelectSource(candidate)}
                />
                <span>
                  <b>{label}</b>
                  <small>{detail}</small>
                </span>
              </label>
            );
          })}
          {reference !== null && !selectedSource && (
            <label className="pm-ws-svt-source pm-ws-svt-source-unavailable">
              <input
                type="radio"
                name="pm-ws-svt-source"
                checked
                disabled={disabled}
                onChange={() => onSelectSource(null)}
              />
              <span>
                <b>
                  {reference.kind === 'active-excerpt'
                    ? 'Active excerpt — unavailable'
                    : `Context attachment ${reference.attachmentId} — unavailable`}
                </b>
                <small>Choose another source before generating again.</small>
              </span>
            </label>
          )}
        </div>
      </div>

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
          Must survive every variation <i>required</i>
        </span>
        <textarea
          value={draft.invariants.mustSurvive}
          maxLength={BUDGET.showVsTellMustSurviveCharacters}
          disabled={disabled}
          rows={3}
          aria-required="true"
          placeholder="The fact, emotion, or turn every variant has to carry."
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
};
