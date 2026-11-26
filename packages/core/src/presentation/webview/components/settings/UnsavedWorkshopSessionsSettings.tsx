import * as React from 'react';
import type { UnsavedWorkshopSessions } from '../../hooks/domain/useUnsavedWorkshopSessions';
import { UnsavedWorkshopSessionDetails } from '../shared/UnsavedWorkshopSessionDetails';

export const UnsavedWorkshopSessionsSettings = ({ sessions, focusOnOpen }: {
  sessions: UnsavedWorkshopSessions;
  focusOnOpen: boolean;
}) => {
  const heading = React.useRef<HTMLHeadingElement>(null);
  const deleteButtonId = React.useRef<string>();
  const [confirmToken, setConfirmToken] = React.useState<string>();
  const titleId = React.useId();
  const { refresh } = sessions;
  React.useEffect(() => { refresh(); }, [refresh]);
  React.useLayoutEffect(() => {
    if (focusOnOpen) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [focusOnOpen]);
  const cancel = () => {
    setConfirmToken(undefined);
    requestAnimationFrame(() => { if (deleteButtonId.current) { document.getElementById(deleteButtonId.current)?.focus(); } });
  };

  return (
    <section className="settings-section unsaved-sessions-settings" aria-labelledby={titleId}>
      <h3 ref={heading} id={titleId} tabIndex={-1} className="settings-section-title">Unsaved Sessions</h3>
      <p className="settings-description">Reopen a closed Workshop tab to continue where you left off.</p>
      {sessions.error && <>
        <p role="alert" className="unsaved-sessions-message">{sessions.error}</p>
        <button type="button" className="settings-button" onClick={sessions.refresh}>Retry</button>
      </>}
      {sessions.busy && <p role="status" className="unsaved-sessions-message">Updating sessions…</p>}
      {!sessions.busy && !sessions.error && !sessions.rows.length && <p className="unsaved-sessions-message">No unsaved sessions.</p>}
      {!!sessions.rows.length && <ul className="unsaved-sessions-well" aria-label="Unsaved sessions" aria-busy={sessions.busy}>
        {sessions.rows.map((row, index) => (
          <li key={row.token}>
            <UnsavedWorkshopSessionDetails row={row} />
            {confirmToken === row.token && row.canDelete ? (
              <div className="unsaved-session-confirm" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } }}>
                <p>Delete this unsaved session?</p>
                <div className="unsaved-session-actions">
                  <button type="button" className="settings-button" autoFocus onClick={cancel}>Cancel</button>
                  <button type="button" className="settings-button unsaved-session-delete" disabled={sessions.busy} onClick={() => {
                    setConfirmToken(undefined);
                    heading.current?.focus();
                    sessions.remove(row.token);
                  }}>Delete session</button>
                </div>
              </div>
            ) : (
              <div className="unsaved-session-actions">
                <button type="button" className="settings-button" disabled={sessions.busy} aria-label={'Open ' + row.title}
                  onClick={() => sessions.open(row.token)}>Open</button>
                <button type="button" className="settings-button unsaved-session-delete" disabled={sessions.busy || !row.canDelete}
                  title={row.canDelete ? undefined : 'Open the session to finish saving before deleting it.'} id={titleId + '-delete-' + index} aria-label={'Delete ' + row.title}
                  onClick={event => { deleteButtonId.current = event.currentTarget.id; setConfirmToken(row.token); }}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>}
    </section>
  );
};
