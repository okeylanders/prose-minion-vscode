/** Persona browser for the permanent Workshop host (ADR 2026-07-09). */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { WorkshopPersonaId } from '@messages';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';
import { WORKSHOP_PERSONA_FOCUS_ICONS } from './workshopPersonaIcons';

interface WorkshopPersonaBrowserModalProps {
  open: boolean;
  activePersonaId: WorkshopPersonaId;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (personaId: WorkshopPersonaId) => void;
}

export const WorkshopPersonaBrowserModal: React.FC<WorkshopPersonaBrowserModalProps> = ({
  open,
  activePersonaId,
  disabled = false,
  onClose,
  onSelect
}) => {
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  const handleBackdropClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="pm-ws-modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <div className="pm-ws-tools-modal pm-ws-persona-modal" role="dialog" aria-modal="true" aria-labelledby="pm-ws-persona-title">
        <div className="pm-ws-tools-modal-head">
          <div>
            <div className="pm-ws-eyebrow">Workshop host</div>
            <h2 id="pm-ws-persona-title">Choose your writing partner</h2>
            <p>Choose a lens before the conversation begins. Start a new session to change hosts later.</p>
          </div>
          <button ref={closeButtonRef} className="pm-ws-modal-close" type="button" onClick={onClose} aria-label="Close personas">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="pm-ws-tools-modal-grid pm-ws-persona-grid">
          {WORKSHOP_PERSONA_CATALOG.map((persona) => (
            <button
              key={persona.id}
              className={`pm-ws-tools-card pm-ws-persona-card ${activePersonaId === persona.id ? 'pm-ws-tools-card-active' : ''}`}
              type="button"
              disabled={disabled}
              aria-pressed={activePersonaId === persona.id}
              onClick={() => onSelect(persona.id)}
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
      </div>
    </div>
  );
};
