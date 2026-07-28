/**
 * WorkshopPersonaSheetGrid — the shared persona card vocabulary for the two
 * split-sheet pickers (Sprint 13C; approved comps "Invite Guest" and
 * "Choose Host"). Selection is modal-local and makes no provider call: a card
 * click only marks the check; the sticky footer owns the commit.
 *
 * Locked cards STATE WHY they cannot be selected (a visible room tag plus a
 * title), and stay in the accessibility tree via `aria-disabled` rather than
 * `disabled` — a screen reader should hear the reason, not silence. The
 * `disabled` prop is the room-mutation lock and hard-disables everything.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { WorkshopPersonaId } from '@messages';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';
import { WORKSHOP_PERSONA_FOCUS_ICONS } from './workshopPersonaIcons';

/** Why a card cannot be selected, and how the card says so. */
export interface WorkshopPersonaCardLock {
  /** Visible tag text ("Host", "In the room", "Room full"). */
  tag: string;
  /** Tag tone drives the tag color only, never the meaning. */
  tone: 'host' | 'guest' | 'full';
  /** The stated reason (title + accessible description). */
  reason: string;
  /** Host/in-room cards show the locked check; capacity exclusion does not. */
  showCheck: boolean;
}

interface WorkshopPersonaSheetGridProps {
  selectedPersonaId: WorkshopPersonaId | null;
  /** Per-persona lock state; absent means selectable. */
  locks?: Partial<Record<WorkshopPersonaId, WorkshopPersonaCardLock>>;
  /** Tag rendered on a selectable card (Choose Host's `Current`). */
  currentTag?: { personaId: WorkshopPersonaId; label: string };
  /** Room-mutation lock: hard-disables every control in the grid. */
  disabled?: boolean;
  onSelect: (personaId: WorkshopPersonaId) => void;
  /** Open the persona's read-only schematic; never changes selection. */
  onMoreInfo?: (personaId: WorkshopPersonaId) => void;
}

export const WorkshopPersonaSheetGrid: React.FC<WorkshopPersonaSheetGridProps> = ({
  selectedPersonaId,
  locks = {},
  currentTag,
  disabled = false,
  onSelect,
  onMoreInfo
}) => (
  <div className="pm-ws-tools-modal-grid pm-ws-persona-grid">
    {WORKSHOP_PERSONA_CATALOG.map((persona) => {
      const lock = locks[persona.id];
      const selected = !lock && selectedPersonaId === persona.id;
      const showCheck = selected || lock?.showCheck === true;
      const cardClasses = [
        'pm-ws-tools-card',
        'pm-ws-persona-card',
        selected ? 'pm-ws-persona-card-sel' : '',
        lock ? 'pm-ws-persona-card-locked' : ''
      ].filter(Boolean).join(' ');
      return (
        <div className="pm-ws-persona-card-wrap" key={persona.id}>
          <button
            className={cardClasses}
            type="button"
            disabled={disabled}
            aria-disabled={lock ? true : undefined}
            aria-pressed={selected}
            title={lock?.reason}
            onClick={() => {
              if (!lock) {
                onSelect(persona.id);
              }
            }}
          >
            <span
              className={`pm-ws-persona-check${selected ? ' pm-ws-persona-check-sel' : ''}${lock?.showCheck ? ` pm-ws-persona-check-${lock.tone}` : ''}`}
              aria-hidden="true"
            >
              {showCheck && <Icon name="check" size={12} />}
            </span>
            <span className="pm-ws-persona-card-icons" aria-hidden="true">
              <span className="pm-ws-tools-card-icon"><Icon name="person" size={20} /></span>
              <span className="pm-ws-persona-focus"><Icon name={WORKSHOP_PERSONA_FOCUS_ICONS[persona.id]} size={12} /></span>
            </span>
            <span className="pm-ws-tools-card-name">{persona.label}</span>
            <span className="pm-ws-persona-specialty">{persona.specialty}</span>
            <span className="pm-ws-tools-card-desc">{persona.description}</span>
            {lock ? (
              <span className={`pm-ws-roomtag pm-ws-roomtag-${lock.tone}`}>
                <i aria-hidden="true" />
                {lock.tag}
                <span className="pm-ws-visually-hidden">. {lock.reason}</span>
              </span>
            ) : currentTag?.personaId === persona.id ? (
              <span className="pm-ws-roomtag pm-ws-roomtag-host">
                <i aria-hidden="true" />
                {currentTag.label}
              </span>
            ) : null}
          </button>
          {onMoreInfo && (
            <button
              className="pm-ws-persona-more"
              type="button"
              disabled={disabled}
              onClick={() => onMoreInfo(persona.id)}
              aria-label={`More info about ${persona.label}`}
            >
              More info
              <Icon name="chevRight" size={12} />
            </button>
          )}
        </div>
      );
    })}
  </div>
);
