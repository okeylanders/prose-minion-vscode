/**
 * WorkshopModalShell — the ONE browser-modal chrome (Sprint 12; resolves
 * tech-debt 2026-07-10-workshop-browser-modal-shell).
 *
 * Owns everything the persona/tools/context modals were duplicating —
 * backdrop with outside-click close, Escape handling, and the a11y contract
 * the persona modal had that the tools modal lacked: capture the opener,
 * focus the close button on open, return focus on close. Content stays with
 * the callers; the shell renders chrome only.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { useOverlayDismiss } from '@hooks/useOverlayDismiss';

interface WorkshopModalShellProps {
  open: boolean;
  /** Ids the dialog is labelled by (the caller's <h2 id=…>). */
  titleId: string;
  /** aria-label for the close affordance ("Close tools"). */
  closeLabel: string;
  /** Extra class(es) on the dialog box beside pm-ws-tools-modal. */
  className?: string;
  /**
   * `sheet` (Sprint 13C) is the split-sheet layout from the approved comps:
   * fixed header, scrolling body, docked footer. The dialog box stops
   * scrolling itself; the caller's `.pm-ws-sheet-body` owns the scroll.
   */
  variant?: 'panel' | 'sheet';
  onClose: () => void;
  children: React.ReactNode;
}

export const WorkshopModalShell: React.FC<WorkshopModalShellProps> & {
  CloseButton: typeof WorkshopModalCloseButton;
} = ({ open, titleId, closeLabel, className, variant = 'panel', onClose, children }) => {
  /* Escape + focus capture/return live in the shared hook, so this shell and
     the full-surface guide cannot drift apart — or fight over focus when one
     hands off to the other (PR #94 review). */
  const closeButtonRef = useOverlayDismiss({ open, onClose });

  const handleBackdropClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="pm-ws-modal-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <div
        className={`pm-ws-tools-modal${variant === 'sheet' ? ' pm-ws-modal-sheet' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <WorkshopModalShellContext.Provider value={{ closeButtonRef, closeLabel, onClose }}>
          {children}
        </WorkshopModalShellContext.Provider>
      </div>
    </div>
  );
};

interface ShellContextValue {
  closeButtonRef: React.RefObject<HTMLButtonElement>;
  closeLabel: string;
  onClose: () => void;
}

const WorkshopModalShellContext = React.createContext<ShellContextValue | null>(null);

/** The shell-managed close button — place it in the caller's header row. */
const WorkshopModalCloseButton: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const shell = React.useContext(WorkshopModalShellContext);
  if (!shell) {
    return null;
  }
  return (
    <button
      ref={shell.closeButtonRef}
      className="pm-ws-modal-close"
      type="button"
      disabled={disabled}
      onClick={shell.onClose}
      aria-label={shell.closeLabel}
    >
      <Icon name="x" size={16} />
    </button>
  );
};

WorkshopModalShell.CloseButton = WorkshopModalCloseButton;
