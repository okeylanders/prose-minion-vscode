/**
 * The surrounding passage and the context (Sprint 05, Slice 7 design edits,
 * D1 and D2), each full width of the sheet.
 *
 * The passage is writer text: typed, pasted, copied in from the active
 * excerpt, or copied in from the editor selection. It persists in the draft,
 * it is a generation input, and it never rides the commit. The context is a
 * multi-select of the room's sources; the host resolves their text when the
 * writer generates, so source text is never stored here. Both mirror
 * Creative Variations' mechanics. Controlled presentation only.
 */

import * as React from 'react';
import type { WorkshopShowVsTellDraft, WorkshopWidgetSourceReference } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  showVsTellSourceReferenceKey
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import type { ShowVsTellAvailableSource } from './showVsTellAuthoringTypes';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export interface ShowVsTellSurroundingPanelProps {
  draft: WorkshopShowVsTellDraft;
  availableSources: readonly ShowVsTellAvailableSource[];
  /** Whether the room has an active excerpt to copy from. */
  canUsePassageFromExcerpt: boolean;
  /** Honest notice when intake had to shorten the passage to its allowance. */
  passageNotice: string | null;
  disabled: boolean;
  onPassageTextChange: (text: string) => void;
  onUsePassageFromExcerpt: () => void;
  onUsePassageFromSelection: () => void;
  onToggleSourceReference: (reference: WorkshopWidgetSourceReference) => void;
}

export const ShowVsTellSurroundingPanel: React.FC<ShowVsTellSurroundingPanelProps> = ({
  draft,
  availableSources,
  canUsePassageFromExcerpt,
  passageNotice,
  disabled,
  onPassageTextChange,
  onUsePassageFromExcerpt,
  onUsePassageFromSelection,
  onToggleSourceReference
}) => {
  const { writerText, sourceReferences } = draft.surroundingContext;
  const selectedKeys = React.useMemo(
    () => new Set(sourceReferences.map(showVsTellSourceReferenceKey)),
    [sourceReferences]
  );
  const availableKeys = React.useMemo(
    () => new Set(availableSources.map(({ reference }) => showVsTellSourceReferenceKey(reference))),
    [availableSources]
  );
  const unavailableSelected = sourceReferences.filter(
    (reference) => !availableKeys.has(showVsTellSourceReferenceKey(reference))
  );
  const atLimit = sourceReferences.length >= BUDGET.showVsTellSourceReferences;
  const travels = writerText.trim().length > 0 || sourceReferences.length > 0;

  return (
    <>
      <div className="pm-ws-svt-field pm-ws-svt-field-wide">
        <span className="pm-ws-svt-flabel" id="pm-ws-svt-passage-label">
          Surrounding passage <i>optional</i>
          <em className={`pm-ws-svt-src${travels ? '' : ' pm-ws-svt-src-pasted'}`}>
            {travels ? 'grounds generation · never rides the commit' : 'none · beat travels alone'}
          </em>
          <span className="pm-ws-svt-passage-tools">
            <button
              type="button"
              className="pm-ws-svt-use-selection"
              disabled={disabled || !canUsePassageFromExcerpt}
              title={canUsePassageFromExcerpt ? undefined : 'No active excerpt in this room.'}
              onClick={onUsePassageFromExcerpt}
            >
              Use excerpt
            </button>
            <button
              type="button"
              className="pm-ws-svt-use-selection"
              disabled={disabled}
              onClick={onUsePassageFromSelection}
            >
              Use selection
            </button>
          </span>
        </span>
        <textarea
          className="pm-ws-svt-passage"
          aria-labelledby="pm-ws-svt-passage-label"
          value={writerText}
          maxLength={BUDGET.showVsTellContextCharacters}
          disabled={disabled}
          rows={4}
          placeholder="What comes before and after the beat — type or paste it, or copy it in from the excerpt or the editor selection. It grounds point of view and meaning."
          onChange={(event) => onPassageTextChange(event.target.value)}
        />
        <p className="pm-ws-svt-honest pm-ws-svt-passage-count" aria-live="polite">
          <span>
            {writerText.length.toLocaleString()} / {BUDGET.showVsTellContextCharacters.toLocaleString()} chars
          </span>
          {passageNotice && <span role="status"> · {passageNotice}</span>}
        </p>
      </div>

      <fieldset className="pm-ws-svt-sources pm-ws-svt-field-wide">
        <legend className="pm-ws-svt-flabel" id="pm-ws-svt-context-label">
          Context <i>optional</i>
          <em className="pm-ws-svt-src pm-ws-svt-src-pasted">
            read by the host when you generate · never stored here
          </em>
        </legend>
        <div className="pm-ws-svt-source-list">
          {availableSources.map(({ reference, label, detail }) => {
            const key = showVsTellSourceReferenceKey(reference);
            const selected = selectedKeys.has(key);
            return (
              <label className="pm-ws-svt-source" key={key}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled || (!selected && atLimit)}
                  onChange={() => onToggleSourceReference(reference)}
                />
                <span>
                  <b>{label}</b>
                  <small>{detail}</small>
                </span>
              </label>
            );
          })}
          {unavailableSelected.map((reference) => (
            <label
              className="pm-ws-svt-source pm-ws-svt-source-unavailable"
              key={showVsTellSourceReferenceKey(reference)}
            >
              <input
                type="checkbox"
                checked
                disabled={disabled}
                onChange={() => onToggleSourceReference(reference)}
              />
              <span>
                <b>
                  {reference.kind === 'active-excerpt'
                    ? 'Active excerpt — unavailable'
                    : `Context attachment ${reference.attachmentId} — unavailable`}
                </b>
                <small>Untick it before generating again.</small>
              </span>
            </label>
          ))}
          {availableSources.length === 0 && unavailableSelected.length === 0 && (
            <span className="pm-ws-svt-source-empty">
              No active excerpt or standing context is available in this room.
            </span>
          )}
        </div>
        {atLimit && (
          <p className="pm-ws-svt-honest">
            Up to {BUDGET.showVsTellSourceReferences} sources can ride a generation.
          </p>
        )}
      </fieldset>
    </>
  );
};
