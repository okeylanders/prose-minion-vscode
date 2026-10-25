/**
 * Full Workshop session browser from the approved design.
 *
 * The shell header, toolbar, and footer remain fixed. Only the session list
 * scrolls, so Open and New Session cannot fall below an oversized combined
 * modal. Full session content remains host-side; rows receive summaries only.
 *
 * The browser itself, its search, grouping, rows, inline rename and delete
 * confirm, is the full tabs' shared `SavedItemBrowserModal` (Lightbox Slice
 * 5A.2), which the Lightbox's saved-board browser uses too. What is the
 * Workshop's own stays here: its words, the current room above the list,
 * grouping by excerpt, each row's host persona, scope and preview, and its
 * Duplicate and Reveal actions.
 */

import * as React from 'react';
import {
  WorkshopSessionAction,
  WorkshopSessionSummary
} from '@messages';
import { Icon } from '@components/shared/Icon';
import {
  getWorkshopPersona,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { WORKSHOP_PERSONA_FOCUS_ICONS } from './workshopPersonaIcons';
import { SavedItemBrowserModal, type SavedItemGrouping } from '@components/fulltab/SavedItemBrowserModal';
import { SavedItemRow, type SavedItemRowControls } from '@components/fulltab/SavedItemRow';
import { relativeSessionTime } from '@utils/relativeSessionTime';
import { groupSavedItems, groupSavedItemsByDate } from '@utils/savedItemGroups';

interface WorkshopSessionBrowserModalProps {
  open: boolean;
  available: boolean | null;
  unavailableReason?: 'no-workspace' | 'multi-root';
  current?: WorkshopSessionSummary;
  /** Named session currently associated with the live room, if any. */
  activeSessionId?: string;
  sessions: WorkshopSessionSummary[];
  truncated: boolean;
  searchTruncated: boolean;
  pending: boolean;
  error?: string;
  query: string;
  mutationsDisabled: boolean;
  actionPending?: WorkshopSessionAction;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onNewSession: () => void;
  onOpen: (session: WorkshopSessionSummary) => void;
  onRename: (sessionId: string, title: string) => void;
  onDuplicate: (sessionId: string) => void;
  onReveal: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

/**
 * How the browser names a session's scope (Sprint 13A §11). Rows written before
 * scope existed say so rather than guessing: "no excerpt" and "open
 * conversation" are different facts, and only one of them was chosen.
 */
const sessionScopeLabel = (scope: WorkshopSessionSummary['scope']): string => {
  switch (scope) {
    case 'excerpt': return 'Passage session';
    case 'open': return 'Open conversation';
    case null: return 'No path chosen';
    default: return 'Scope unknown';
  }
};

const localDateTime = (timestamp: number): string =>
  Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Unknown date';

/** Date (the shared buckets) or excerpt, the excerpt's groups in the order of their newest session. */
const SESSION_GROUPINGS: ReadonlyArray<SavedItemGrouping<WorkshopSessionSummary>> = [
  { key: 'date', label: 'Date', group: (sessions) => groupSavedItemsByDate(sessions, (session) => session.updatedAt) },
  {
    key: 'excerpt',
    label: 'Excerpt',
    group: (sessions) => groupSavedItems(sessions, (session, index) => ({
      key: `excerpt:${session.excerptIdentity || session.excerptLabel || 'none'}`,
      label: session.excerptLabel || 'No excerpt',
      order: index
    }))
  }
];

const unavailableCopy = (
  reason: WorkshopSessionBrowserModalProps['unavailableReason']
): string => reason === 'multi-root'
  ? 'Sessions are unavailable in a multi-root workspace. Open the manuscript as one workspace folder before browsing Workshop sessions.'
  : 'Open a workspace folder to browse Workshop sessions.';

/** A current room's row has no rename or delete: its controls do nothing. */
const NO_CONTROLS: SavedItemRowControls = {
  editing: false,
  renameDraft: '',
  confirmingDelete: false,
  beginRename: () => undefined,
  changeRenameDraft: () => undefined,
  commitRename: () => true,
  cancelRename: () => undefined,
  beginDelete: () => undefined,
  acceptDelete: () => undefined,
  cancelDelete: () => undefined,
  renameButton: () => undefined,
  deleteButton: () => undefined,
  keepButton: () => undefined
};

export const WorkshopSessionBrowserModal: React.FC<WorkshopSessionBrowserModalProps> = ({
  open,
  available,
  unavailableReason,
  current,
  activeSessionId,
  sessions,
  truncated,
  searchTruncated,
  pending,
  error,
  query,
  mutationsDisabled,
  actionPending,
  onClose,
  onQueryChange,
  onRefresh,
  onNewSession,
  onOpen,
  onRename,
  onDuplicate,
  onReveal,
  onDelete
}) => {
  const stateChangingDisabled =
    mutationsDisabled || actionPending !== undefined || available !== true;

  return (
    <SavedItemBrowserModal<WorkshopSessionSummary>
      open={open}
      titleId="workshop-session-browser-title"
      closeLabel="Close session browser"
      className="pm-ws-session-browser-modal"
      eyebrow="Workshop · Sessions"
      title="Open a prior session"
      description={
        <>
          Reopening restores the complete room and continuable conversation memory.
          If one persona history cannot be recovered, only that participant starts fresh.
        </>
      }
      search={{
        label: 'Search session names and content',
        placeholder: 'Search names and session content…',
        scope: 'greps content',
        query,
        disabled: available !== true,
        onChange: onQueryChange
      }}
      groupLabel="Group sessions"
      groupings={SESSION_GROUPINGS}
      status={
        <>
          {available === false && (
            <div className="pm-ws-sessions-unavailable" role="status">
              <Icon name="doc" size={16} /> {unavailableCopy(unavailableReason)}
            </div>
          )}
          {pending && (
            <div className="pm-ws-sessions-pending" role="status">
              Loading session summaries…
            </div>
          )}
          {error && (
            <div className="pm-ws-sessions-unavailable" role="alert">
              <Icon name="x" size={14} /> Could not load sessions: {error}
              <button className="pm-ws-session-quiet" type="button" onClick={onRefresh}>
                Retry
              </button>
            </div>
          )}
          {truncated && (
            <div className="pm-ws-sessions-truncated" role="status">
              The browser reached its file safety limit; refine the search to narrow results.
            </div>
          )}
          {searchTruncated && (
            <div className="pm-ws-sessions-truncated" role="status">
              Content search is bounded for very large sessions. Metadata was searched
              completely, but a match deep in a long transcript may be omitted.
            </div>
          )}
        </>
      }
      leading={
        <section className="pm-ws-session-browser-section" aria-labelledby="current-session-heading">
          <div className="pm-ws-sessions-section-title" id="current-session-heading">
            Current session <span>restores automatically</span>
          </div>
          {current ? (
            <SessionBrowserRow
              session={current}
              current
              disabled={stateChangingDisabled}
              actionPending={actionPending}
              controls={NO_CONTROLS}
              onOpen={onOpen}
              onDuplicate={() => undefined}
              onReveal={onReveal}
            />
          ) : (
            <div className="pm-ws-sessions-empty">No autosaved Workshop room yet.</div>
          )}
        </section>
      }
      section={{ id: 'named-sessions-heading', title: 'Named sessions', note: 'newest first' }}
      emptyText="No named sessions match this view."
      items={sessions}
      itemKey={(session) => session.sessionId}
      itemTitle={(session) => session.title}
      renderRow={(session, controls) => (
        <SessionBrowserRow
          session={session}
          current={false}
          active={session.sessionId === activeSessionId}
          disabled={stateChangingDisabled}
          actionPending={actionPending}
          controls={controls}
          onOpen={onOpen}
          onDuplicate={(next) => onDuplicate(next.sessionId)}
          onReveal={onReveal}
        />
      )}
      footer={
        <>
          <span>
            Your working room autosaves to <strong>current.json</strong> and restores
            automatically when you reopen Workshop.
          </span>
          <button
            className="pm-ws-session-secondary"
            type="button"
            disabled={mutationsDisabled || actionPending !== undefined}
            onClick={onNewSession}
          >
            New session
          </button>
        </>
      }
      onRename={onRename}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
};

interface SessionBrowserRowProps {
  session: WorkshopSessionSummary;
  current: boolean;
  /** True when this named checkpoint is the live Workshop room. */
  active?: boolean;
  disabled: boolean;
  actionPending?: WorkshopSessionAction;
  controls: SavedItemRowControls;
  onOpen: (session: WorkshopSessionSummary) => void;
  onDuplicate: (session: WorkshopSessionSummary) => void;
  onReveal: (sessionId: string) => void;
}

/** A session's row: its host persona's glyph, scope, turns, words, time and excerpt, its preview, and Duplicate and Reveal. */
const SessionBrowserRow: React.FC<SessionBrowserRowProps> = ({
  session,
  current,
  active = false,
  disabled,
  actionPending,
  controls,
  onOpen,
  onDuplicate,
  onReveal
}) => {
  const persona = getWorkshopPersona(session.hostPersonaId);
  const focusIcon = WORKSHOP_PERSONA_FOCUS_ICONS[session.hostPersonaId];

  return (
    <SavedItemRow
      title={session.title}
      current={current}
      active={active}
      disabled={disabled}
      glyph={
        <div
          className="pm-ws-session-host-glyph"
          data-persona-id={session.hostPersonaId}
          data-focus-icon={focusIcon}
          aria-hidden="true"
        >
          <Icon name="person" size={22} />
          <Icon name={focusIcon} size={11} />
        </div>
      }
      badges={
        <>
          {current && <span className="pm-ws-session-badge">Current · autosaved</span>}
          {active && <span className="pm-ws-session-badge">Open in Workshop</span>}
        </>
      }
      metaTitle={[
        workshopPersonaLabel(session.hostPersonaId),
        sessionScopeLabel(session.scope),
        `${session.turnCount} turns`,
        `${session.excerptWordCount.toLocaleString()} words`,
        localDateTime(session.updatedAt),
        session.excerptLabel ?? 'No excerpt'
      ].join(' · ')}
      meta={
        <>
          <span className="pm-ws-session-host-name">
            {persona?.label ?? workshopPersonaLabel(session.hostPersonaId)}
          </span>
          <span>·</span>
          {/* Sprint 13A §11: the row says what KIND of session this is, so an
              open conversation never reads as a passage session that lost its
              passage. */}
          <span>{sessionScopeLabel(session.scope)}</span>
          <span>·</span>
          <span>{session.turnCount} turns</span>
          <span>·</span>
          <span>{session.excerptWordCount.toLocaleString()} words</span>
          <span>·</span>
          <span>{relativeSessionTime(session.updatedAt)}</span>
          <span>·</span>
          <span>{session.excerptLabel ?? 'No excerpt'}</span>
        </>
      }
      extra={
        <>
          {session.preview && (
            <div className="pm-ws-session-row-preview" title={session.preview}>
              {session.preview}
            </div>
          )}
          {current && session.degradedConversationKeys &&
            session.degradedConversationKeys.length > 0 && (
            <div className="pm-ws-session-degraded">
              <Icon name="bot" size={12} />
              Some restored persona memory restarted; the room and transcript are intact.
            </div>
          )}
        </>
      }
      renameLabel="Rename session"
      utilities={
        <>
          <button
            className="pm-ws-session-icon"
            type="button"
            disabled={disabled}
            aria-label={`Duplicate ${session.title}`}
            onClick={() => onDuplicate(session)}
          >
            <Icon name="copy" size={13} />
          </button>
          <button
            className="pm-ws-session-icon"
            type="button"
            aria-label={`Reveal ${session.title} file`}
            onClick={() => onReveal(session.sessionId)}
          >
            <Icon name="doc" size={13} />
          </button>
        </>
      }
      primary={current ? (
        <button
          className="pm-ws-session-secondary"
          type="button"
          onClick={() => onReveal('current')}
        >
          <Icon name="doc" size={13} /> Reveal
        </button>
      ) : (
        <button
          className="pm-ws-session-primary pm-ws-session-open"
          type="button"
          disabled={disabled}
          onClick={() => onOpen(session)}
        >
          {actionPending === 'open' ? 'Opening…' : 'Open'}
        </button>
      )}
      controls={controls}
      onOpen={() => onOpen(session)}
    />
  );
};
