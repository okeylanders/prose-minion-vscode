/**
 * Full Workshop session browser from the approved design.
 *
 * The shell header, toolbar, and footer remain fixed. Only the session list
 * scrolls, so Open and New Session cannot fall below an oversized combined
 * modal. Full session content remains host-side; rows receive summaries only.
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
import { WorkshopModalShell } from './WorkshopModalShell';
import { relativeSessionTime } from '@utils/relativeSessionTime';

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

type SessionGroupBy = 'date' | 'excerpt';

interface SessionGroup {
  key: string;
  label: string;
  sessions: WorkshopSessionSummary[];
}

const localDateTime = (timestamp: number): string =>
  Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Unknown date';

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const dateBucket = (timestamp: number): { key: string; label: string; order: number } => {
  if (!Number.isFinite(timestamp)) {
    return { key: 'unknown', label: 'Unknown date', order: 3 };
  }
  const now = new Date();
  const ageDays = Math.floor(
    (startOfDay(now) - startOfDay(new Date(timestamp))) / 86_400_000
  );
  if (ageDays <= 0) {
    return { key: 'today', label: 'Today', order: 0 };
  }
  if (ageDays <= 7) {
    return { key: 'week', label: 'This week', order: 1 };
  }
  return { key: 'earlier', label: 'Earlier', order: 2 };
};

const groupSessions = (
  sessions: WorkshopSessionSummary[],
  groupBy: SessionGroupBy
): SessionGroup[] => {
  const groups = new Map<string, SessionGroup & { order: number }>();
  sessions.forEach((session, index) => {
    const grouping = groupBy === 'excerpt'
      ? {
          key: `excerpt:${session.excerptIdentity || session.excerptLabel || 'none'}`,
          label: session.excerptLabel || 'No excerpt',
          order: index
        }
      : dateBucket(session.updatedAt);
    const group = groups.get(grouping.key) ?? {
      key: grouping.key,
      label: grouping.label,
      order: grouping.order,
      sessions: []
    };
    group.sessions.push(session);
    groups.set(grouping.key, group);
  });
  return [...groups.values()]
    .sort((left, right) => left.order - right.order)
    .map(({ key, label, sessions: grouped }) => ({ key, label, sessions: grouped }));
};

const unavailableCopy = (
  reason: WorkshopSessionBrowserModalProps['unavailableReason']
): string => reason === 'multi-root'
  ? 'Sessions are unavailable in a multi-root workspace. Open the manuscript as one workspace folder before browsing Workshop sessions.'
  : 'Open a workspace folder to browse Workshop sessions.';

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
  const [groupBy, setGroupBy] = React.useState<SessionGroupBy>('date');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const cancelingRenameRef = React.useRef(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    setGroupBy('date');
    setEditingId(null);
    setRenameDraft('');
    setConfirmDeleteId(null);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const groupedSessions = React.useMemo(
    () => groupSessions(sessions, groupBy),
    [groupBy, sessions]
  );
  const stateChangingDisabled =
    mutationsDisabled || actionPending !== undefined || available !== true;

  const beginRename = React.useCallback((session: WorkshopSessionSummary) => {
    cancelingRenameRef.current = false;
    setConfirmDeleteId(null);
    setEditingId(session.sessionId);
    setRenameDraft(session.title);
  }, []);

  const cancelRename = React.useCallback(() => {
    cancelingRenameRef.current = true;
    setEditingId(null);
    setRenameDraft('');
  }, []);

  const commitRename = React.useCallback(() => {
    if (cancelingRenameRef.current) {
      cancelingRenameRef.current = false;
      return;
    }
    if (editingId) {
      const title = renameDraft.trim();
      if (title) {
        onRename(editingId, title);
      }
    }
    setEditingId(null);
  }, [editingId, onRename, renameDraft]);

  const handleNestedEscape = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (editingId) {
      event.preventDefault();
      event.stopPropagation();
      cancelRename();
      return;
    }
    if (confirmDeleteId) {
      event.preventDefault();
      event.stopPropagation();
      setConfirmDeleteId(null);
    }
  }, [cancelRename, confirmDeleteId, editingId]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="workshop-session-browser-title"
      closeLabel="Close session browser"
      className="pm-ws-session-browser-modal"
      onClose={onClose}
    >
      <div className="pm-ws-session-browser-layout" onKeyDown={handleNestedEscape}>
        <div className="pm-ws-session-sheet-head pm-ws-session-browser-head">
          <div>
            <div className="pm-ws-eyebrow">Workshop · Sessions</div>
            <h2 id="workshop-session-browser-title">Open a prior session</h2>
            <p>
              Reopening restores the complete room and continuable conversation memory.
              If one persona history cannot be recovered, only that participant starts fresh.
            </p>
          </div>
          <WorkshopModalShell.CloseButton />
        </div>

        <div className="pm-ws-session-browser-toolbar">
          <label className="pm-ws-sessions-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Search session names and content</span>
            <input
              ref={searchRef}
              type="search"
              aria-label="Search session names and content"
              value={query}
              disabled={available !== true}
              placeholder="Search names and session content…"
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <span className="pm-ws-session-search-scope">greps content</span>
          </label>
          <div className="pm-ws-sessions-group-control" aria-label="Group sessions">
            <span>Group by</span>
            <div>
              <button
                type="button"
                className={groupBy === 'date' ? 'pm-ws-session-group-active' : ''}
                onClick={() => setGroupBy('date')}
              >
                Date
              </button>
              <button
                type="button"
                className={groupBy === 'excerpt' ? 'pm-ws-session-group-active' : ''}
                onClick={() => setGroupBy('excerpt')}
              >
                Excerpt
              </button>
            </div>
          </div>
        </div>

        <div className="pm-ws-session-browser-status">
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
        </div>

        <div className="pm-ws-session-browser-scroll">
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
                editing={false}
                renameDraft=""
                confirmDelete={false}
                onOpen={onOpen}
                onBeginRename={() => undefined}
                onRenameDraftChange={() => undefined}
                onCommitRename={() => undefined}
                onCancelRename={() => undefined}
                onDuplicate={() => undefined}
                onReveal={onReveal}
                onBeginDelete={() => undefined}
                onConfirmDelete={() => undefined}
                onCancelDelete={() => undefined}
              />
            ) : (
              <div className="pm-ws-sessions-empty">No autosaved Workshop room yet.</div>
            )}
          </section>

          <section className="pm-ws-session-browser-section" aria-labelledby="named-sessions-heading">
            <div className="pm-ws-sessions-section-title" id="named-sessions-heading">
              Named sessions <span>newest first</span>
            </div>
            {sessions.length > 0 ? groupedSessions.map((group) => (
              <div className="pm-ws-session-browser-group" key={group.key}>
                <div className="pm-ws-sessions-group-label">
                  {group.label} <span>{group.sessions.length}</span>
                </div>
                {group.sessions.map((session) => (
                  <SessionBrowserRow
                    key={session.sessionId}
                    session={session}
                    current={false}
                    active={session.sessionId === activeSessionId}
                    disabled={stateChangingDisabled}
                    actionPending={actionPending}
                    editing={editingId === session.sessionId}
                    renameDraft={renameDraft}
                    confirmDelete={confirmDeleteId === session.sessionId}
                    onOpen={onOpen}
                    onBeginRename={beginRename}
                    onRenameDraftChange={setRenameDraft}
                    onCommitRename={commitRename}
                    onCancelRename={cancelRename}
                    onDuplicate={(next) => onDuplicate(next.sessionId)}
                    onReveal={onReveal}
                    onBeginDelete={(next) => {
                      setEditingId(null);
                      setConfirmDeleteId(next.sessionId);
                    }}
                    onConfirmDelete={(next) => {
                      setConfirmDeleteId(null);
                      onDelete(next.sessionId);
                    }}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                  />
                ))}
              </div>
            )) : (
              <div className="pm-ws-sessions-empty">No named sessions match this view.</div>
            )}
          </section>
        </div>

        <footer className="pm-ws-session-sheet-foot pm-ws-session-browser-foot">
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
        </footer>
      </div>
    </WorkshopModalShell>
  );
};

interface SessionBrowserRowProps {
  session: WorkshopSessionSummary;
  current: boolean;
  /** True when this named checkpoint is the live Workshop room. */
  active?: boolean;
  disabled: boolean;
  actionPending?: WorkshopSessionAction;
  editing: boolean;
  renameDraft: string;
  confirmDelete: boolean;
  onOpen: (session: WorkshopSessionSummary) => void;
  onBeginRename: (session: WorkshopSessionSummary) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (session: WorkshopSessionSummary) => void;
  onReveal: (sessionId: string) => void;
  onBeginDelete: (session: WorkshopSessionSummary) => void;
  onConfirmDelete: (session: WorkshopSessionSummary) => void;
  onCancelDelete: () => void;
}

const SessionBrowserRow: React.FC<SessionBrowserRowProps> = ({
  session,
  current,
  active = false,
  disabled,
  actionPending,
  editing,
  renameDraft,
  confirmDelete,
  onOpen,
  onBeginRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onReveal,
  onBeginDelete,
  onConfirmDelete,
  onCancelDelete
}) => {
  const persona = getWorkshopPersona(session.hostPersonaId);
  const focusIcon = WORKSHOP_PERSONA_FOCUS_ICONS[session.hostPersonaId];
  const openFromRow = (event: React.MouseEvent<HTMLElement>) => {
    if (
      current ||
      disabled ||
      (event.target instanceof Element && event.target.closest('button, input'))
    ) {
      return;
    }
    onOpen(session);
  };

  return (
    <article
      className={[
        'pm-ws-session-browser-row',
        current ? 'pm-ws-session-current' : '',
        active ? 'pm-ws-session-active' : ''
      ].filter(Boolean).join(' ')}
      onClick={openFromRow}
    >
      <div
        className="pm-ws-session-host-glyph"
        data-persona-id={session.hostPersonaId}
        data-focus-icon={focusIcon}
        aria-hidden="true"
      >
        <Icon name="person" size={22} />
        <Icon name={focusIcon} size={11} />
      </div>
      <div className="pm-ws-session-row-main">
        <div className="pm-ws-session-row-title">
          {editing ? (
            <input
              aria-label="Rename session"
              value={renameDraft}
              autoFocus
              onChange={(event) => onRenameDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  onCancelRename();
                }
              }}
              onBlur={onCommitRename}
            />
          ) : (
            <strong title={session.title}>{session.title}</strong>
          )}
          {current && <span className="pm-ws-session-badge">Current · autosaved</span>}
          {active && <span className="pm-ws-session-badge">Open in Workshop</span>}
        </div>
        <div className="pm-ws-session-row-meta" title={[
          workshopPersonaLabel(session.hostPersonaId),
          `${session.turnCount} turns`,
          `${session.excerptWordCount.toLocaleString()} words`,
          localDateTime(session.updatedAt),
          session.excerptLabel ?? 'No excerpt'
        ].join(' · ')}>
          <span className="pm-ws-session-host-name">
            {persona?.label ?? workshopPersonaLabel(session.hostPersonaId)}
          </span>
          <span>·</span>
          <span>{session.turnCount} turns</span>
          <span>·</span>
          <span>{session.excerptWordCount.toLocaleString()} words</span>
          <span>·</span>
          <span>{relativeSessionTime(session.updatedAt)}</span>
          <span>·</span>
          <span>{session.excerptLabel ?? 'No excerpt'}</span>
        </div>
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
      </div>
      {!current && (
        <div
          className={`pm-ws-session-utility-actions${
            confirmDelete || editing ? ' pm-ws-session-utility-actions-live' : ''
          }`}
        >
          {confirmDelete ? (
            <>
              <button
                className="pm-ws-session-icon pm-ws-session-delete-confirm"
                type="button"
                disabled={disabled}
                aria-label={`Confirm delete ${session.title}`}
                onClick={() => onConfirmDelete(session)}
              >
                <Icon name="check" size={14} />
              </button>
              <button
                className="pm-ws-session-icon"
                type="button"
                aria-label={`Keep ${session.title}`}
                onClick={onCancelDelete}
              >
                <Icon name="x" size={13} />
              </button>
            </>
          ) : (
            <>
              <button
                className="pm-ws-session-icon"
                type="button"
                disabled={disabled}
                aria-label={`Rename ${session.title}`}
                onClick={() => onBeginRename(session)}
              >
                <Icon name="pen" size={13} />
              </button>
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
              <button
                className="pm-ws-session-icon pm-ws-session-delete"
                type="button"
                disabled={disabled}
                aria-label={`Delete ${session.title}`}
                onClick={() => onBeginDelete(session)}
              >
                <Icon name="trash" size={14} />
              </button>
            </>
          )}
        </div>
      )}
      <div className="pm-ws-session-row-actions">
        {current ? (
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
      </div>
    </article>
  );
};
