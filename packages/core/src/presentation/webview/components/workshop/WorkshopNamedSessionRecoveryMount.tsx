/**
 * Recover…'s notice and confirm (ADR 2026-11-19 D6e). The notice appears
 * after a save or open was refused because the session was left mid-save,
 * and carries the host's answer once recovery ran; the confirm asks the
 * writer to close other windows first. The session browser's row opens the
 * same confirm.
 */

import * as React from 'react';
import type { UseWorkshopNamedSessionRecoveryReturn } from '@hooks/domain/workshop/useWorkshopNamedSessionRecovery';
import { WorkshopConfirmDialog } from './WorkshopConfirmDialog';

/** The confirm's words (D6e, worded per PR #286's approval note: a superseded pre-image is dropped, not kept). */
export const WORKSHOP_SESSION_RECOVERY_CONFIRM_BODY =
  'Close any other Prose Minion window on this workspace first. Recovery puts the saved session back and keeps any unsaved work as a "(local recovery)" session.';

export const WorkshopNamedSessionRecoveryMount: React.FC<{ recovery: UseWorkshopNamedSessionRecoveryReturn }> = ({ recovery }) => {
  const { offer, confirming, recovering, outcome } = recovery;
  const showNotice = offer !== undefined || recovering || outcome !== undefined;
  return (
    <>
      {showNotice && (
        <div className="pm-ws-recovery-notice" role={outcome && !outcome.ok ? 'alert' : 'status'}>
          <span>
            {recovering
              ? 'Recovering the saved session…'
              : outcome?.message ?? 'This saved session was left mid-save, probably by a window that closed.'}
          </span>
          {offer && !recovering && (
            <button className="pm-ws-session-primary" type="button" onClick={() => recovery.ask(offer.sessionId)}>
              Recover…
            </button>
          )}
          {!recovering && (
            <button className="pm-ws-session-quiet" type="button" onClick={recovery.dismiss}>
              Dismiss
            </button>
          )}
        </div>
      )}
      <WorkshopConfirmDialog
        open={confirming !== undefined}
        title={confirming?.title ? `Recover “${confirming.title}”?` : 'Recover this saved session?'}
        body={WORKSHOP_SESSION_RECOVERY_CONFIRM_BODY}
        confirmLabel="Recover"
        onConfirm={recovery.confirm}
        onCancel={recovery.cancel}
      />
    </>
  );
};
