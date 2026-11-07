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
  /**
   * New session: full reset, empty context (ADR 2026-11-04 D2): clears the
   * working set and leaves pinned context out. Shown only while anything is
   * pinned; with nothing pinned, the full reset is already empty.
   */
  onEmptyResetSession: () => void;
  /** How many files are pinned. At 0 the menu and its copy are today's. */
  pinnedFileCount: number;
  /** True when there is actually an excerpt or attachment to clear. */
  hasWorkingSet: boolean;
  onSaveSession: () => void;
  /** Export reads the room; it needs only a conversation, not persistence. */
  exportDisabled: boolean;
  onExportSession: () => void;
  onBrowseSessions: () => void;
  /** Opens the Bookmarks screen (ADR 2026-11-05 D8), beside Browse all sessions. */
  onBrowseBookmarks?: () => void;
  /**
   * Opens the project memory manager straight from the menu, under Bookmarks,
   * so a look at saved memories needs no detour through Conversation settings.
   */
  onBrowseMemory?: () => void;
  onOpenSession: (session: WorkshopSessionSummary) => void;
}

const SAVE_STATUS_TEXT: Readonly<Record<'saving' | 'saved' | 'error', string>> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed'
};

function fullResetTitle(hasWorkingSet: boolean, pinnedFileCount: number): string {
  if (pinnedFileCount > 0) {
    return 'Start over with no excerpt and no context attachments, then attach your ' +
      `${pinnedFileCount} pinned ${pinnedFileCount === 1 ? 'file' : 'files'}`;
  }
  return hasWorkingSet
    ? 'Start over with no excerpt and no context attachments'
    : 'Nothing is attached — this behaves like a new session';
}

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
  onEmptyResetSession,
  pinnedFileCount,
  hasWorkingSet,
  onSaveSession,
  exportDisabled,
  onExportSession,
  onBrowseSessions,
  onBrowseBookmarks,
  onBrowseMemory,
  onOpenSession
}) => {
  const recent = sessions.slice(0, 3);
  const pinned = pinnedFileCount > 0;
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
        title={fullResetTitle(hasWorkingSet, pinnedFileCount)}
        onSelect={onFullResetSession}
      >
        New session: full reset
        <small>{pinned
          ? 'clears the excerpt and context, then attaches pinned context'
          : 'also clears the excerpt and context'}</small>
      </SavedItemsMenu.Item>
      {pinned && (
        <SavedItemsMenu.Item
          icon="x"
          danger
          disabled={newSessionDisabled}
          title="Start over with no excerpt, no context attachments and no pinned context"
          onSelect={onEmptyResetSession}
        >
          New session: full reset, empty context
          <small>clears the excerpt and context, and leaves pinned context out</small>
        </SavedItemsMenu.Item>
      )}
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
      {onBrowseBookmarks && (
        <SavedItemsMenu.Item icon="bookmark" onSelect={onBrowseBookmarks}>
          Bookmarks…
        </SavedItemsMenu.Item>
      )}
      {onBrowseMemory && (
        <SavedItemsMenu.Item icon="book" onSelect={onBrowseMemory}>
          Memory…
        </SavedItemsMenu.Item>
      )}
    </SavedItemsMenu>
  );
};
