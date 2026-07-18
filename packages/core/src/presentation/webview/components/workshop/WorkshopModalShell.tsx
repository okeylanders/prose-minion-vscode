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

interface WorkshopModalShellProps {
  open: boolean;
  /** Ids the dialog is labelled by (the caller's <h2 id=…>). */
  titleId: string;
  /** aria-label for the close affordance ("Close tools"). */
  closeLabel: string;
  /** Extra class(es) on the dialog box beside pm-ws-tools-modal. */
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const WorkshopModalShell: React.FC<WorkshopModalShellProps> & {
  CloseButton: typeof WorkshopModalCloseButton;
} = ({ open, titleId, closeLabel, className, onClose, children }) => {
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
        className={`pm-ws-tools-modal${className ? ` ${className}` : ''}`}
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
const WorkshopModalCloseButton: React.FC = () => {
  const shell = React.useContext(WorkshopModalShellContext);
  if (!shell) {
    return null;
  }
  return (
    <button
      ref={shell.closeButtonRef}
      className="pm-ws-modal-close"
      type="button"
      onClick={shell.onClose}
      aria-label={shell.closeLabel}
    >
      <Icon name="x" size={16} />
    </button>
  );
};

WorkshopModalShell.CloseButton = WorkshopModalCloseButton;
