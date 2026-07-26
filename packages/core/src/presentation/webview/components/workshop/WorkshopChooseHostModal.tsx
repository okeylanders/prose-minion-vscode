/**
 * WorkshopChooseHostModal — the split-sheet host picker (Sprint 13C;
 * approved comp "Prose Minion — Choose Host", synced 2026-07-24).
 *
 * Matches the Invite Guest sheet: same shell, same card vocabulary,
 * single-select with a check mark, commit in the sticky footer. The current
 * host is pre-selected and tagged `Current`. There is no opening message —
 * the host is not handed a prompt — so the footer carries only the note and a
 * `Choose <Name>` / `Keep <Name>` action. `Esc` closes the sheet, which
 * reverts to the current host because selection is modal-local.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';
import { WorkshopPersonaSheetGrid } from './WorkshopPersonaSheetGrid';
import type { WorkshopPersonaId } from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

interface WorkshopChooseHostModalProps {
  open: boolean;
  /** The current host — pre-selected, tagged `Current`. */
  activePersonaId: WorkshopPersonaId;
  /** Selection lock (session already has a host conversation, or a run). */
  disabled?: boolean;
  onClose: () => void;
  /** Commit the footer choice; the parent closes and posts the selection. */
  onChooseHost: (personaId: WorkshopPersonaId) => void;
  /** Open the persona schematic; the header points at this control. */
  onMoreInfo?: (personaId: WorkshopPersonaId) => void;
}

export const WorkshopChooseHostModal: React.FC<WorkshopChooseHostModalProps> = ({
  open,
  activePersonaId,
  disabled = false,
  onClose,
  onChooseHost,
  onMoreInfo
}) => {
  const [selected, setSelected] = React.useState<WorkshopPersonaId>(activePersonaId);

  // Every open re-anchors on the current host; a dismissed sheet keeps it.
  React.useEffect(() => {
    if (open) {
      setSelected(activePersonaId);
    }
  }, [activePersonaId, open]);

  const keepingCurrent = selected === activePersonaId;
  const selectedLabel = workshopPersonaLabel(selected);

  const commit = () => {
    if (disabled) {
      return;
    }
    if (keepingCurrent) {
      onClose();
      return;
    }
    onChooseHost(selected);
  };

  const handleSheetKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };

  return (
    <WorkshopModalShell
      open={open}
      variant="sheet"
      titleId="pm-ws-choose-host-title"
      closeLabel="Close host selection"
      className="pm-ws-persona-sheet"
      onClose={onClose}
    >
      <div className="pm-ws-sheet" onKeyDown={handleSheetKeyDown}>
        <header className="pm-ws-sheet-head">
          <div className="pm-ws-eyebrow">Workshop · Host</div>
          <h2 id="pm-ws-choose-host-title">Choose your writing partner</h2>
          <p className="pm-ws-sheet-sub">
            Choose a lens before the conversation begins. Your host leads every
            turn — start a new session to change hosts later.
          </p>
          {onMoreInfo && (
            <p className="pm-ws-sheet-morehint">
              <span className="pm-ws-sheet-morehint-tag">
                <Icon name="chevRight" size={11} /> More info
              </span>
              <span>on any partner opens their full persona &amp; interaction details.</span>
            </p>
          )}
          <WorkshopModalShell.CloseButton />
        </header>
        <div className="pm-ws-sheet-body">
          <WorkshopPersonaSheetGrid
            selectedPersonaId={selected}
            currentTag={{ personaId: activePersonaId, label: 'Current' }}
            disabled={disabled}
            onSelect={setSelected}
            onMoreInfo={onMoreInfo}
          />
        </div>
        <footer className="pm-ws-sheet-foot pm-ws-host-foot">
          <p className="pm-ws-host-foot-note">
            <Icon name="info" size={14} />
            <span>
              Your host leads every turn. <b>Start a new session</b> to change hosts later.
            </span>
          </p>
          <div className="pm-ws-sheet-actions pm-ws-host-actions">
            <button className="pm-ws-sheet-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="pm-ws-sheet-commit"
              type="button"
              disabled={disabled}
              onClick={commit}
            >
              <Icon name="check" size={15} />
              <span className="pm-ws-sheet-commit-label">
                {keepingCurrent ? `Keep ${selectedLabel}` : `Choose ${selectedLabel}`}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
