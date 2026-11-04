/** Conversation settings · About you: the global writer profile the personas may read. */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WORKSHOP_WRITER_PROFILE_LIMITS, WorkshopWriterProfile } from '@messages';
import { Switch } from './WorkshopConversationSettingsControls';

interface WorkshopAboutYouSettingsPanelProps {
  draft: WorkshopWriterProfile;
  disabled: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<WorkshopWriterProfile>>;
  /**
   * The clear confirmation is the modal's, not the panel's: selecting any
   * tab, the active one included, dismisses it.
   */
  confirmClear: boolean;
  onConfirmClearChange: (confirming: boolean) => void;
}

export const WorkshopAboutYouSettingsPanel: React.FC<WorkshopAboutYouSettingsPanelProps> = ({
  draft,
  disabled,
  onDraftChange,
  confirmClear,
  onConfirmClearChange
}) => {
  const clearProfile = () => {
    onDraftChange({ enabled: false, preferredAddress: '', bio: '' });
    onConfirmClearChange(false);
  };

  return (
    <>
      <div className="pm-ws-profile-share-row">
        <div>
          <div className="pm-ws-behavior-row-name">
            Share this profile with Workshop personas
          </div>
          <div className="pm-ws-behavior-row-desc">
            Jill and invited personas receive it as background context. Analysis tools do not.
          </div>
        </div>
        <Switch
          checked={draft.enabled}
          disabled={disabled}
          label="Share this profile with Workshop personas"
          onClick={() => onDraftChange((current) => ({
            ...current,
            enabled: !current.enabled
          }))}
        />
      </div>

      <label className="pm-ws-profile-field">
        <span>How should the room address you?</span>
        <input
          type="text"
          aria-label="How should the room address you?"
          value={draft.preferredAddress}
          maxLength={WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress}
          disabled={disabled}
          placeholder="Okey, Dr. Landers, Okey is fine…"
          onChange={(event) => onDraftChange((current) => ({
            ...current,
            preferredAddress: event.target.value
          }))}
        />
        <small>
          {draft.preferredAddress.trim().length}
          {' / '}
          {WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress}
        </small>
      </label>

      <label className="pm-ws-profile-field">
        <span>What would you like the room to know about you?</span>
        <textarea
          aria-label="What would you like the room to know about you?"
          value={draft.bio}
          maxLength={WORKSHOP_WRITER_PROFILE_LIMITS.bio}
          rows={8}
          disabled={disabled}
          placeholder="A little enduring context that can help the room work with you…"
          onChange={(event) => onDraftChange((current) => ({
            ...current,
            bio: event.target.value
          }))}
        />
        <small>
          {draft.bio.trim().length}
          {' / '}
          {WORKSHOP_WRITER_PROFILE_LIMITS.bio}
        </small>
      </label>

      <div className="pm-ws-profile-notice">
        <Icon name="person" size={14} />
        <span>
          Stored globally in VS Code settings, not in this project or its session history.
          This is ordinary settings data—not a secret—so don’t include sensitive information.
          Personas use it as background context without reciting it or repeatedly using your
          name.
        </span>
      </div>

      <div className="pm-ws-profile-clear">
        {confirmClear ? (
          <>
            <span role="status">Clear both fields and turn sharing off?</span>
            <button
              type="button"
              className="pm-ws-action-btn"
              disabled={disabled}
              onClick={() => onConfirmClearChange(false)}
            >
              Keep profile
            </button>
            <button
              type="button"
              className="pm-ws-danger-btn"
              disabled={disabled}
              onClick={clearProfile}
            >
              Clear
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pm-ws-action-btn"
            disabled={
              disabled || (!draft.preferredAddress && !draft.bio)
            }
            onClick={() => onConfirmClearChange(true)}
          >
            Clear profile…
          </button>
        )}
      </div>
    </>
  );
};
