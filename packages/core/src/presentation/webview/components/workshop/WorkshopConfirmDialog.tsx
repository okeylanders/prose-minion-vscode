/**
 * WorkshopConfirmDialog — in-webview replacement for `window.confirm`, which
 * VS Code's sandboxed webview iframe silently rejects (native dialogs return
 * false without ever rendering). State-replacing session actions (New
 * Session, Open prior session) confirm here instead.
 */

import * as React from 'react';
import { WorkshopModalShell } from './WorkshopModalShell';

interface WorkshopConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const WorkshopConfirmDialog: React.FC<WorkshopConfirmDialogProps> = ({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}) => (
  <WorkshopModalShell
    open={open}
    titleId="workshop-confirm-title"
    closeLabel="Dismiss confirmation"
    className="pm-ws-confirm-modal"
    onClose={onCancel}
  >
    <div className="pm-ws-session-sheet-head pm-ws-confirm-head">
      <div>
        <div className="pm-ws-eyebrow">Workshop</div>
        <h2 id="workshop-confirm-title">{title}</h2>
        <p>{body}</p>
      </div>
      <WorkshopModalShell.CloseButton />
    </div>
    <footer className="pm-ws-session-sheet-foot pm-ws-confirm-foot">
      <button className="pm-ws-session-secondary" type="button" onClick={onCancel}>
        Cancel
      </button>
      <button
        className="pm-ws-session-primary pm-ws-session-primary-large"
        type="button"
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </footer>
  </WorkshopModalShell>
);
