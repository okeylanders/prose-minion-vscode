/** Persona browser for the permanent Workshop host (ADR 2026-07-09). */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';
import type { WorkshopPersonaId } from '@messages';
import {
  DEFAULT_WORKSHOP_GUEST_OPENING,
  WORKSHOP_PERSONA_CATALOG
} from '@shared/constants/workshopPersonas';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PERSONA_FOCUS_ICONS } from './workshopPersonaIcons';

interface WorkshopPersonaBrowserModalProps {
  open: boolean;
  activePersonaId: WorkshopPersonaId;
  mode?: 'host' | 'guest';
  invitedPersonaIds?: WorkshopPersonaId[];
  disabled?: boolean;
  onClose: () => void;
  onSelect: (personaId: WorkshopPersonaId) => void;
  onInvite?: (personaId: WorkshopPersonaId, openingMessage: string) => void;
}

export const WorkshopPersonaBrowserModal: React.FC<WorkshopPersonaBrowserModalProps> = ({
  open,
  activePersonaId,
  mode = 'host',
  invitedPersonaIds = [],
  disabled = false,
  onClose,
  onSelect,
  onInvite
}) => {
  const guestMode = mode === 'guest';
  const [openingMessage, setOpeningMessage] = React.useState(DEFAULT_WORKSHOP_GUEST_OPENING);

  React.useEffect(() => {
    if (open && guestMode) {
      setOpeningMessage(DEFAULT_WORKSHOP_GUEST_OPENING);
    }
  }, [guestMode, open]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-persona-title"
      closeLabel="Close personas"
      className="pm-ws-persona-modal"
      onClose={onClose}
    >
        <div className="pm-ws-tools-modal-head">
          <div>
            <div className="pm-ws-eyebrow">{guestMode ? 'Workshop guest' : 'Workshop host'}</div>
            <h2 id="pm-ws-persona-title">{guestMode ? 'Invite another lens' : 'Choose your writing partner'}</h2>
            <p>
              {guestMode
                ? 'Invite one of the packaged personas to read the current room. Guests stay beside the host and never replace it.'
                : 'Choose a lens before the conversation begins. Start a new session to change hosts later.'}
            </p>
          </div>
          <WorkshopModalShell.CloseButton />
        </div>
        {guestMode && (
          <label className="pm-ws-guest-opening">
            <span>Your opening message</span>
            <textarea
              aria-label="Your opening message"
              value={openingMessage}
              maxLength={PROMPT_BUDGETS.guestOpening.characters}
              rows={3}
              onChange={(event) => setOpeningMessage(event.target.value)}
            />
            <small>{openingMessage.length.toLocaleString()} / {PROMPT_BUDGETS.guestOpening.characters.toLocaleString()} characters</small>
          </label>
        )}
        <div className="pm-ws-tools-modal-grid pm-ws-persona-grid">
          {WORKSHOP_PERSONA_CATALOG.map((persona) => (
            <button
              key={persona.id}
              className={`pm-ws-tools-card pm-ws-persona-card ${!guestMode && activePersonaId === persona.id ? 'pm-ws-tools-card-active' : ''}`}
              type="button"
              disabled={
                disabled
                || (guestMode && (
                  !openingMessage.trim()
                  || persona.id === activePersonaId
                  || invitedPersonaIds.includes(persona.id)
                ))
              }
              aria-pressed={!guestMode && activePersonaId === persona.id}
              onClick={() => {
                if (guestMode) {
                  onInvite?.(persona.id, openingMessage.trim());
                } else {
                  onSelect(persona.id);
                }
              }}
            >
              <span className="pm-ws-persona-card-icons" aria-hidden="true">
                <span className="pm-ws-tools-card-icon"><Icon name="person" size={20} /></span>
                <span className="pm-ws-persona-focus"><Icon name={WORKSHOP_PERSONA_FOCUS_ICONS[persona.id]} size={12} /></span>
              </span>
              <span className="pm-ws-tools-card-name">{persona.label}</span>
              <span className="pm-ws-persona-specialty">{persona.specialty}</span>
              <span className="pm-ws-tools-card-desc">{persona.description}</span>
            </button>
          ))}
        </div>
    </WorkshopModalShell>
  );
};
