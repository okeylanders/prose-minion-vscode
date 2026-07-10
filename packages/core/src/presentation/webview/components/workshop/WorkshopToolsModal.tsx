/**
 * WorkshopToolsModal — the full 14-tool palette. Renders from the shared
 * catalog so the modal cannot invent tools or drift from handler routing.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopToolId } from '@messages';
import {
  WORKSHOP_TOOL_CATALOG,
  WorkshopToolDescriptor,
  WorkshopToolGroup
} from '@shared/constants/workshopTools';
import { WORKSHOP_TOOL_ICONS } from './workshopToolIcons';

const TOOL_GROUPS: readonly WorkshopToolGroup[] = ['Primary', 'Craft & Voice', 'Technical'];

interface WorkshopToolsModalProps {
  open: boolean;
  activeToolId: WorkshopToolId | null;
  disabled?: boolean;
  unavailableMessage?: string;
  onClose: () => void;
  onSelect: (toolId: WorkshopToolId) => void;
}

const groupedTools = (group: WorkshopToolGroup): readonly WorkshopToolDescriptor[] =>
  WORKSHOP_TOOL_CATALOG.filter((tool) => tool.group === group);

export const WorkshopToolsModal: React.FC<WorkshopToolsModalProps> = ({
  open,
  activeToolId,
  disabled = false,
  unavailableMessage,
  onClose,
  onSelect
}) => {
  const handleBackdropClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="pm-ws-modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <div className="pm-ws-tools-modal" role="dialog" aria-modal="true" aria-labelledby="pm-ws-tools-title">
        <div className="pm-ws-tools-modal-head">
          <div>
            <div className="pm-ws-eyebrow">Prose Excerpt Assistant</div>
            <h2 id="pm-ws-tools-title">Writing Tools</h2>
            <p>Pick an analysis. Each runs on your pinned excerpt with the context brief attached.</p>
            {unavailableMessage && <p className="pm-ws-tools-modal-notice" role="status">{unavailableMessage}</p>}
          </div>
          <button className="pm-ws-modal-close" type="button" onClick={onClose} aria-label="Close tools">
            <Icon name="x" size={16} />
          </button>
        </div>

        {TOOL_GROUPS.map((group) => (
          <section key={group} className="pm-ws-tools-modal-section">
            <div className="pm-ws-tools-modal-rule">
              <span className="pm-ws-eyebrow">{group}</span>
              <hr />
            </div>
            <div className="pm-ws-tools-modal-grid">
              {groupedTools(group).map((tool) => (
                <button
                  key={tool.id}
                  className={`pm-ws-tools-card ${
                    activeToolId === tool.id ? 'pm-ws-tools-card-active' : ''
                  }`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(tool.id)}
                >
                  <span className="pm-ws-tools-card-icon">
                    <Icon name={WORKSHOP_TOOL_ICONS[tool.id]} size={20} />
                  </span>
                  <span className="pm-ws-tools-card-name">{tool.label}</span>
                  <span className="pm-ws-tools-card-desc">{tool.description}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
