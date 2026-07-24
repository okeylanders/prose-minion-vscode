/**
 * WorkshopSessionsModal — durable session browser and named-checkpoint save.
 *
 * The modal owns draft fields and confirmation affordances only. The host owns
 * every session file, search result, and state replacement; rows are the
 * display-safe summaries from WORKSHOP_SESSIONS_DATA.
 */

import * as React from 'react';
import { WorkshopSessionSummary } from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { WorkshopModalShell } from './WorkshopModalShell';

interface WorkshopSessionsModalProps {
  open: boolean;
  available: boolean | null;
  unavailableReason?: 'no-workspace' | 'multi-root';
  current?: WorkshopSessionSummary;
  sessions: WorkshopSessionSummary[];
  truncated: boolean;
  searchTruncated: boolean;
  pending: boolean;
  error?: string;
  query: string;
  mutationsDisabled: boolean;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onSave: (title: string) => void;
  onOpen: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onDuplicate: (sessionId: string) => void;
  onReveal: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

const localDate = (timestamp: number): string =>
  Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Unknown date';

const suggestedTitle = (current?: WorkshopSessionSummary): string => {
  if (!current) {
    return 'Untitled Workshop session';
  }
  const excerpt = current.excerptLabel?.trim() || 'Untitled session';
  return `${excerpt} — ${current.hostPersonaId} — ${new Date().toLocaleDateString()}`;
};

const unavailableCopy = (reason: WorkshopSessionsModalProps['unavailableReason']): string =>
  reason === 'multi-root'
    ? 'Sessions are unavailable in a multi-root workspace. Open the manuscript as one workspace folder before saving or browsing Workshop sessions.'
    : 'Open a workspace folder to save and browse Workshop sessions.';

type SessionGroupBy = 'date' | 'excerpt';

const groupKey = (session: WorkshopSessionSummary, groupBy: SessionGroupBy): string =>
  groupBy === 'excerpt'
    ? `excerpt:${session.excerptIdentity || session.excerptLabel || 'none'}`
    : `date:${Number.isFinite(session.updatedAt)
      ? new Date(session.updatedAt).toLocaleDateString()
      : 'unknown'}`;

const groupLabel = (session: WorkshopSessionSummary, groupBy: SessionGroupBy): string =>
  groupBy === 'excerpt'
    ? session.excerptLabel || 'No excerpt'
    : Number.isFinite(session.updatedAt)
      ? new Date(session.updatedAt).toLocaleDateString(undefined, {
          weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
        })
      : 'Unknown date';

export const WorkshopSessionsModal: React.FC<WorkshopSessionsModalProps> = ({
  open,
  available,
  unavailableReason,
  current,
  sessions,
  truncated,
  searchTruncated,
  pending,
  error,
  query,
  mutationsDisabled,
  onClose,
  onQueryChange,
  onRefresh,
  onSave,
  onOpen,
  onRename,
  onDuplicate,
  onReveal,
  onDelete
}) => {
  const [saveTitle, setSaveTitle] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const [groupBy, setGroupBy] = React.useState<SessionGroupBy>('date');

  React.useEffect(() => {
    if (open) {
      setSaveTitle(suggestedTitle(current));
      setEditingId(null);
      setRenameDraft('');
      setGroupBy('date');
    }
  }, [current, open]);

  const beginRename = React.useCallback((session: WorkshopSessionSummary) => {
    setEditingId(session.sessionId);
    setRenameDraft(session.title);
  }, []);

  const commitRename = React.useCallback(() => {
    if (!editingId) {
      return;
    }
    const title = renameDraft.trim();
    if (title) {
      onRename(editingId, title);
    }
    setEditingId(null);
  }, [editingId, onRename, renameDraft]);

  const openSession = React.useCallback((session: WorkshopSessionSummary) => {
    if (window.confirm(`Open “${session.title}”? Your current Workshop room will be replaced.`)) {
      onOpen(session.sessionId);
    }
  }, [onOpen]);

  const deleteSession = React.useCallback((session: WorkshopSessionSummary) => {
    if (window.confirm(`Delete “${session.title}”? This named checkpoint cannot be recovered.`)) {
      onDelete(session.sessionId);
    }
  }, [onDelete]);

  const persistenceActionsDisabled = mutationsDisabled || available !== true;

  const submitSave = React.useCallback(() => {
    if (persistenceActionsDisabled) {
      return;
    }
    const title = saveTitle.trim();
    if (title) {
      onSave(title);
    }
  }, [onSave, persistenceActionsDisabled, saveTitle]);

  const namedGroups = React.useMemo(() => {
    const groups = new Map<string, { label: string; sessions: WorkshopSessionSummary[] }>();
    for (const session of sessions) {
      const key = groupKey(session, groupBy);
      const group = groups.get(key) ?? {
        label: groupLabel(session, groupBy),
        sessions: []
      };
      group.sessions.push(session);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [groupBy, sessions]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="workshop-sessions-title"
      closeLabel="Close Workshop sessions"
      className="pm-ws-sessions-modal"
      onClose={onClose}
    >
      <div className="pm-ws-tools-modal-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Sessions</div>
          <h2 id="workshop-sessions-title">Save and reopen sessions</h2>
          <p>Named snapshots preserve this Workshop room; the working room rolls into <code>current.json</code>.</p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      {available === false ? (
        <div className="pm-ws-sessions-unavailable" role="status">
          <Icon name="doc" size={16} /> {unavailableCopy(unavailableReason)}
        </div>
      ) : (
        <>
          <section className="pm-ws-session-save" aria-labelledby="workshop-session-save-title">
            <div className="pm-ws-session-save-head">
              <div>
                <h3 id="workshop-session-save-title">Save a named checkpoint</h3>
                <p>Its title can change later; the timestamped storage identity stays put.</p>
              </div>
              <button
                className="pm-ws-session-primary"
                type="button"
                disabled={persistenceActionsDisabled || !saveTitle.trim()}
                onClick={submitSave}
              >
                <Icon name="save" size={14} /> Save session
              </button>
            </div>
            <label className="pm-ws-session-label">
              Session name
              <input
                value={saveTitle}
                disabled={persistenceActionsDisabled}
                onChange={(event) => setSaveTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitSave();
                  }
                }}
              />
            </label>
            <div className="pm-ws-session-manifest" aria-label="Included in this snapshot">
              <span>Included</span>
              <span>Excerpt{current ? ` · ${current.excerptWordCount.toLocaleString()} words` : ''}</span>
              <span>Transcript{current ? ` · ${current.turnCount} turns` : ''}</span>
              <span>Participants</span>
              <span>Context, todos, and room state</span>
            </div>
          </section>

          <div className="pm-ws-sessions-toolbar">
            <label className="pm-ws-sessions-search">
              <Icon name="search" size={14} />
              <span className="sr-only">Search session names and content</span>
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search names and session content…"
              />
            </label>
            <button className="pm-ws-session-quiet" type="button" onClick={onRefresh}>
              <Icon name="refresh" size={13} /> Refresh
            </button>
          </div>

          {pending && <div className="pm-ws-sessions-pending" role="status">Loading session summaries…</div>}
          {error && (
            <div className="pm-ws-sessions-unavailable" role="alert">
              <Icon name="x" size={14} /> Could not load sessions: {error}
            </div>
          )}
          {truncated && (
            <div className="pm-ws-sessions-truncated" role="status">
              The session browser reached its safety limit; refine your search to narrow the results.
            </div>
          )}
          {searchTruncated && (
            <div className="pm-ws-sessions-truncated" role="status">
              Content search is bounded for very large sessions. Name, participant, and excerpt
              metadata were searched completely, but matches deep in a long transcript may be omitted.
            </div>
          )}

          <section className="pm-ws-sessions-list" aria-label="Workshop sessions">
            <div className="pm-ws-sessions-section-title">Current session · autosaved</div>
            {current ? (
              <SessionRow
                session={current}
                current
                mutationsDisabled={mutationsDisabled}
                editing={false}
                renameDraft=""
                onRenameDraftChange={() => undefined}
                onBeginRename={() => undefined}
                onCommitRename={() => undefined}
                onCancelRename={() => undefined}
                onOpen={() => undefined}
                onDuplicate={() => undefined}
                onReveal={onReveal}
                onDelete={() => undefined}
              />
            ) : (
              <div className="pm-ws-sessions-empty">No autosaved Workshop room yet.</div>
            )}

            <div className="pm-ws-sessions-group-head">
              <div className="pm-ws-sessions-section-title">Named sessions · newest first</div>
              <div className="pm-ws-sessions-group-control" aria-label="Group named sessions">
                <span>Group by</span>
                <button type="button" className={groupBy === 'date' ? 'pm-ws-session-group-active' : ''} onClick={() => setGroupBy('date')}>Date</button>
                <button type="button" className={groupBy === 'excerpt' ? 'pm-ws-session-group-active' : ''} onClick={() => setGroupBy('excerpt')}>Excerpt</button>
              </div>
            </div>
            {sessions.length > 0 ? namedGroups.map(([key, group]) => (
              <React.Fragment key={key}>
                <div className="pm-ws-sessions-group-label">{group.label} <span>{group.sessions.length}</span></div>
                {group.sessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    session={session}
                    current={false}
                    mutationsDisabled={persistenceActionsDisabled}
                    editing={editingId === session.sessionId}
                    renameDraft={renameDraft}
                    onRenameDraftChange={setRenameDraft}
                    onBeginRename={beginRename}
                    onCommitRename={commitRename}
                    onCancelRename={() => {
                      setRenameDraft('');
                      setEditingId(null);
                    }}
                    onOpen={openSession}
                    onDuplicate={(next) => onDuplicate(next.sessionId)}
                    onReveal={onReveal}
                    onDelete={deleteSession}
                  />
                ))}
              </React.Fragment>
            )) : (
              <div className="pm-ws-sessions-empty">No named sessions match this view.</div>
            )}
          </section>
        </>
      )}
    </WorkshopModalShell>
  );
};

interface SessionRowProps {
  session: WorkshopSessionSummary;
  current: boolean;
  mutationsDisabled: boolean;
  editing: boolean;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onBeginRename: (session: WorkshopSessionSummary) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpen: (session: WorkshopSessionSummary) => void;
  onDuplicate: (session: WorkshopSessionSummary) => void;
  onReveal: (sessionId: string) => void;
  onDelete: (session: WorkshopSessionSummary) => void;
}

const SessionRow: React.FC<SessionRowProps> = ({
  session,
  current,
  mutationsDisabled,
  editing,
  renameDraft,
  onRenameDraftChange,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onOpen,
  onDuplicate,
  onReveal,
  onDelete
}) => (
  <article className={`pm-ws-session-row${current ? ' pm-ws-session-current' : ''}`}>
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
              }
              if (event.key === 'Escape') {
                onCancelRename();
              }
            }}
            onBlur={onCommitRename}
          />
        ) : (
          <strong>{session.title}</strong>
        )}
        {current && <span className="pm-ws-session-badge">Current</span>}
        {current && session.degradedConversationKeys && session.degradedConversationKeys.length > 0 && (
          <span className="pm-ws-session-degraded" title={session.degradedConversationKeys.join(', ')}>
            Some persona memory restarted
          </span>
        )}
      </div>
      <div className="pm-ws-session-row-meta">
        {workshopPersonaLabel(session.hostPersonaId)} · {session.turnCount} turns · {session.excerptWordCount.toLocaleString()} words · {localDate(session.updatedAt)}
      </div>
      {session.preview && <div className="pm-ws-session-row-preview">{session.preview}</div>}
    </div>
    <div className="pm-ws-session-row-actions">
      {current ? (
        <button className="pm-ws-session-quiet" type="button" onClick={() => onReveal('current')}>
          <Icon name="doc" size={13} /> Reveal
        </button>
      ) : (
        <>
          <button className="pm-ws-session-quiet" type="button" disabled={mutationsDisabled} onClick={() => onOpen(session)}>
            Open
          </button>
          <button className="pm-ws-session-icon" type="button" disabled={mutationsDisabled} onClick={() => onBeginRename(session)} aria-label={`Rename ${session.title}`}>
            <Icon name="pen" size={13} />
          </button>
          <button className="pm-ws-session-icon" type="button" disabled={mutationsDisabled} onClick={() => onDuplicate(session)} aria-label={`Duplicate ${session.title}`}>
            <Icon name="copy" size={13} />
          </button>
          <button className="pm-ws-session-icon" type="button" onClick={() => onReveal(session.sessionId)} aria-label={`Reveal ${session.title} file`}>
            <Icon name="doc" size={13} />
          </button>
          <button className="pm-ws-session-icon pm-ws-session-delete" type="button" disabled={mutationsDisabled} onClick={() => onDelete(session)} aria-label={`Delete ${session.title}`}>
            <Icon name="x" size={13} />
          </button>
        </>
      )}
    </div>
  </article>
);
