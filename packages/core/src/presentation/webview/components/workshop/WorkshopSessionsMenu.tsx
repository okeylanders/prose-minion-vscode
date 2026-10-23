/**
 * The compact session command surface from the approved Workshop design.
 *
 * This is deliberately a menu, not a shortcut to the full browser: New and
 * Save stay one click away, recent named checkpoints stay glanceable, and the
 * larger search/grouping surface opens only when the writer asks for it.
 *
 * Its chrome and behaviour are the full tabs' shared `SavedItemsMenu`
 * (Lightbox Slice 5A.2), which the Lightbox's Boards menu uses too; the
 * items here are the Workshop's own.
 */

import * as React from 'react';
import { WorkshopSessionSummary } from '@messages';
import { SavedItemsMenu } from '@components/fulltab/SavedItemsMenu';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { relativeSessionTime } from '@utils/relativeSessionTime';

interface WorkshopSessionsMenuProps {
  open: boolean;
  activeSessionTitle?: string;
  saveStatus?: 'saving' | 'saved' | 'error';
  sessions: WorkshopSessionSummary[];
  disabled: boolean;
  newSessionDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onNewSession: () => void;
  /**
   * New session AND an empty working set — the excerpt, the shelf, and every
   * context attachment go too. Destructive, so it is styled as such and always
   * confirms upstream.
   */
  onFullResetSession: () => void;
  /** True when there is actually an excerpt or attachment to clear. */
  hasWorkingSet: boolean;
  onSaveSession: () => void;
  /** Export reads the room; it needs only a conversation, not persistence. */
  exportDisabled: boolean;
  onExportSession: () => void;
  onBrowseSessions: () => void;
  onOpenSession: (session: WorkshopSessionSummary) => void;
}

const SAVE_STATUS_TEXT: Readonly<Record<'saving' | 'saved' | 'error', string>> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed'
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
  onFullResetSession,
  hasWorkingSet,
  onSaveSession,
  exportDisabled,
  onExportSession,
  onBrowseSessions,
  onOpenSession
}) => {
  const recent = sessions.slice(0, 3);
  const state = saveStatus ?? 'saved';

  return (
    <SavedItemsMenu
      open={open}
      label={activeSessionTitle ?? 'Sessions'}
      status={{ state, text: SAVE_STATUS_TEXT[state] }}
      menuId="pm-ws-sessions-menu"
      menuLabel="Workshop session commands"
      triggerTitle="Session commands and recent Workshop rooms"
      onOpenChange={onOpenChange}
    >
      <SavedItemsMenu.Heading>Session</SavedItemsMenu.Heading>
      <SavedItemsMenu.Item icon="refresh" disabled={newSessionDisabled} kbd="⌘⇧N" onSelect={onNewSession}>
        New session
      </SavedItemsMenu.Item>
      {/* Sits directly under New session, because the difference between
          them is exactly one thing: whether the working set survives. The
          subtitle names that difference rather than making the writer
          discover it. */}
      <SavedItemsMenu.Item
        icon="x"
        danger
        disabled={newSessionDisabled}
        title={hasWorkingSet
          ? 'Start over with no excerpt and no context attachments'
          : 'Nothing is attached — this behaves like a new session'}
        onSelect={onFullResetSession}
      >
        New session: full reset
        <small>also clears the excerpt and context</small>
      </SavedItemsMenu.Item>
      <SavedItemsMenu.Item icon="save" disabled={disabled} kbd="⌘S" onSelect={onSaveSession}>
        Save session…
      </SavedItemsMenu.Item>
      <SavedItemsMenu.Item
        icon="share"
        disabled={exportDisabled}
        title={exportDisabled
          ? 'Nothing to export yet — the transcript starts with your first message'
          : 'Save this conversation as Markdown, JSON, or styled HTML'}
        onSelect={onExportSession}
      >
        Export…
      </SavedItemsMenu.Item>
      <SavedItemsMenu.Rule />
      <SavedItemsMenu.Item icon="cards" onSelect={onBrowseSessions}>
        Open prior session…
      </SavedItemsMenu.Item>

      <SavedItemsMenu.Heading recent>Recent</SavedItemsMenu.Heading>
      {recent.length > 0 ? recent.map((session) => (
        <SavedItemsMenu.Recent
          key={session.sessionId}
          title={session.title}
          meta={<>{workshopPersonaLabel(session.hostPersonaId)} ·{' '}{relativeSessionTime(session.updatedAt)}</>}
          disabled={disabled}
          onSelect={() => onOpenSession(session)}
        />
      )) : (
        <SavedItemsMenu.Empty>No named sessions yet.</SavedItemsMenu.Empty>
      )}

      <SavedItemsMenu.Rule />
      <SavedItemsMenu.Item icon="search" onSelect={onBrowseSessions}>
        Browse all sessions…
      </SavedItemsMenu.Item>
    </SavedItemsMenu>
  );
};
