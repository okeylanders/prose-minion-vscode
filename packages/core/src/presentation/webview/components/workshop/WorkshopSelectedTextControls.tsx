/**
 * Selected Text beside the Workshop composer (ADR 2026-11-14 D9, D14): the
 * "Include selected text" toggle, and the live pill it draws.
 *
 * Presentational: both draw from props and post nothing. The live pill is
 * the editor's current selection as the host described it (file, lines,
 * words; never the text). It is not a staged attachment, so it has no remove
 * control: the toggle turns it off. When the next message has no room for
 * another attachment it is drawn disabled, with the reason said in words.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { workshopSelectedTextDetail } from '@components/workshop/workshopAttachmentPills';
import {
  WORKSHOP_INCLUDE_SELECTED_TEXT_LABEL,
  WORKSHOP_SELECTED_TEXT_LABEL,
  type WorkshopSelectedTextSummary
} from '@messages';

/** What the composer is given for Selected Text: the toggle, and the live pill when there is one. */
export interface WorkshopComposerSelectedText {
  includeSelectedText: boolean;
  onIncludeSelectedTextChange: (on: boolean) => void;
  livePill: { selection: WorkshopSelectedTextSummary; disabledReason?: string } | null;
}

const TOGGLE_TITLE_ON = 'The editor’s current selection rides with each message, as the Selected Text pill shows it.';
const TOGGLE_TITLE_OFF = 'Send the editor’s current selection with each message, as a Selected Text pill.';

export const WorkshopSelectedTextToggle: React.FC<{
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}> = ({ on, disabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    className={`pm-ws-comp-pill pm-ws-comp-selected-toggle${on ? ' is-on' : ''}`}
    disabled={disabled}
    title={on ? TOGGLE_TITLE_ON : TOGGLE_TITLE_OFF}
    onClick={() => onChange(!on)}
  >
    <span className="pm-ws-comp-selected-toggle-mark" aria-hidden="true" />
    {WORKSHOP_INCLUDE_SELECTED_TEXT_LABEL}
  </button>
);

export const WorkshopLiveSelectedTextPill: React.FC<{
  live: NonNullable<WorkshopComposerSelectedText['livePill']>;
}> = ({ live }) => {
  const detail = workshopSelectedTextDetail({
    path: live.selection.displayName,
    startLine: live.selection.startLine,
    endLine: live.selection.endLine,
    words: live.selection.words,
    truncation: live.selection.truncation
  });
  const disabled = live.disabledReason !== undefined;
  return (
    <span
      className={`pm-ws-comp-attachment pm-ws-comp-attachment-selected pm-ws-comp-attachment-live${disabled ? ' is-disabled' : ''}`}
      title={disabled ? live.disabledReason : `${live.selection.displayName} · ${detail}\n${live.selection.preview}`}
      aria-disabled={disabled || undefined}
      data-snapshot-id={live.selection.snapshotId}
    >
      <Icon name="doc" size={11} />
      <span className="pm-ws-comp-attachment-label">{WORKSHOP_SELECTED_TEXT_LABEL}</span>
      <span className="pm-ws-comp-attachment-size">{detail}</span>
      <span className="pm-ws-comp-attachment-live-note">
        {disabled ? `not included: ${live.disabledReason}` : 'follows the editor’s selection'}
      </span>
    </span>
  );
};
