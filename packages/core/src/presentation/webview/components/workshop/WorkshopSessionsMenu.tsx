/**
 * The compact session command surface from the approved Workshop design.
 *
 * This is deliberately a menu, not a shortcut to the full browser: New and
 * Save stay one click away, recent named checkpoints stay glanceable, and the
 * larger search/grouping surface opens only when the writer asks for it.
 */

import * as React from 'react';
import { WorkshopSessionSummary } from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

interface WorkshopSessionsMenuProps {
  open: boolean;
  activeSessionTitle?: string;
  saveStatus?: 'saving' | 'saved' | 'error';
  sessions: WorkshopSessionSummary[];
  disabled: boolean;
  newSessionDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onNewSession: () => void;
  onSaveSession: () => void;
  onBrowseSessions: () => void;
  onOpenSession: (session: WorkshopSessionSummary) => void;
}

const relativeSessionTime = (timestamp: number): string => {
  if (!Number.isFinite(timestamp)) {
    return 'Unknown time';
  }
  const elapsed = Date.now() - timestamp;
  if (elapsed >= 0 && elapsed < 60_000) {
    return 'just now';
  }
  if (elapsed >= 0 && elapsed < 3_600_000) {
    return `${Math.max(1, Math.floor(elapsed / 60_000))}m ago`;
  }
  if (elapsed >= 0 && elapsed < 86_400_000) {
    return `${Math.max(1, Math.floor(elapsed / 3_600_000))}h ago`;
  }
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })}`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const WorkshopSessionsMenu: React.FC<WorkshopSessionsMenuProps> = ({
  open,
  activeSessionTitle,
  saveStatus,
  sessions,
  disabled,
  newSessionDisabled,
  onOpenChange,
  onNewSession,
  onSaveSession,
  onBrowseSessions,
  onOpenSession
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const firstItemRef = React.useRef<HTMLButtonElement>(null);
  const recent = sessions.slice(0, 3);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const focusTimer = window.setTimeout(() => firstItemRef.current?.focus(), 0);
    const closeOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        onOpenChange(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [onOpenChange, open]);

  const invoke = React.useCallback((action: () => void) => {
    onOpenChange(false);
    action();
  }, [onOpenChange]);

  return (
    <div className="pm-ws-sessions-menu-wrap" ref={rootRef}>
      <button
        ref={triggerRef}
        className="pm-ws-reset pm-ws-sessions-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="pm-ws-sessions-menu"
        onClick={() => onOpenChange(!open)}
        title="Session commands and recent Workshop rooms"
      >
        <Icon name="cards" size={14} />
        <span className="pm-ws-sessions-trigger-label">
          {activeSessionTitle ?? 'Sessions'}
        </span>
        <Icon name="chevDown" size={13} />
      </button>
      {activeSessionTitle && (
        <span
          className={`pm-ws-named-save-state pm-ws-named-save-state-${saveStatus ?? 'saved'}`}
          role="status"
          aria-live="polite"
        >
          <span />
          {saveStatus === 'saving'
            ? 'Saving…'
            : saveStatus === 'error'
              ? 'Save failed'
              : 'Saved'}
        </span>
      )}
      {open && (
        <div
          id="pm-ws-sessions-menu"
          className="pm-ws-sessions-menu"
          role="menu"
          aria-label="Workshop session commands"
        >
          <div className="pm-ws-sessions-menu-heading">Session</div>
          <button
            ref={firstItemRef}
            className="pm-ws-sessions-menu-item"
            type="button"
            role="menuitem"
            disabled={newSessionDisabled}
            onClick={() => invoke(onNewSession)}
          >
            <Icon name="refresh" size={15} />
            <span>New session</span>
            <kbd>⌘⇧N</kbd>
          </button>
          <button
            className="pm-ws-sessions-menu-item"
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => invoke(onSaveSession)}
          >
            <Icon name="save" size={15} />
            <span>Save session…</span>
            <kbd>⌘S</kbd>
          </button>
          <div className="pm-ws-sessions-menu-rule" />
          <button
            className="pm-ws-sessions-menu-item"
            type="button"
            role="menuitem"
            onClick={() => invoke(onBrowseSessions)}
          >
            <Icon name="cards" size={15} />
            <span>Open prior session…</span>
          </button>

          <div className="pm-ws-sessions-menu-heading pm-ws-sessions-menu-recent-heading">
            Recent
          </div>
          {recent.length > 0 ? recent.map((session) => (
            <button
              key={session.sessionId}
              className="pm-ws-sessions-menu-recent"
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => invoke(() => onOpenSession(session))}
            >
              <strong>{session.title}</strong>
              <span>
                {workshopPersonaLabel(session.hostPersonaId)} ·{' '}
                {relativeSessionTime(session.updatedAt)}
              </span>
            </button>
          )) : (
            <div className="pm-ws-sessions-menu-empty">No named sessions yet.</div>
          )}

          <div className="pm-ws-sessions-menu-rule" />
          <button
            className="pm-ws-sessions-menu-item"
            type="button"
            role="menuitem"
            onClick={() => invoke(onBrowseSessions)}
          >
            <Icon name="search" size={15} />
            <span>Browse all sessions…</span>
          </button>
        </div>
      )}
    </div>
  );
};
