/**
 * WorkshopBookmarkBrowserModal — the Bookmarks screen (ADR 2026-11-05 D8): a
 * read-only browser of every bookmark, this conversation's and every saved
 * session's. It composes the full tabs' `SavedItemBrowserModal` and
 * `SavedItemRow` with their `readOnly` opt-in, so it speaks the session
 * browser's markup with no Rename or Delete.
 *
 * - **This conversation** fills `leading`, from the host's full-ledger rows.
 * - **Saved sessions** are the list, page by page: a coverage line says how
 *   many sessions the loaded pages read, and "Load more" reads the next.
 * - **Search** covers labels and message text; over saved sessions it covers
 *   only what has loaded, and says so.
 * - **Group by** Date (the bookmark's own) or Session.
 * - **Each row:** the label, the speaker in its identity color, the
 *   session, the date, and the message's first lines. Preview opens it
 *   read-only; a saved row also offers Open session and Open at bookmark,
 *   and a row of this conversation Show in thread.
 *
 * Presentational: rows come from the host through `useWorkshopBookmarkBrowser`,
 * and every action is a callback. Labels and messages are writer text.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { SavedItemBrowserModal, type SavedItemGrouping } from '@components/fulltab/SavedItemBrowserModal';
import { SavedItemRow, type SavedItemRowControls } from '@components/fulltab/SavedItemRow';
import type {
  WorkshopBookmarkBrowserLive,
  WorkshopBookmarkBrowserSaved
} from '@hooks/domain/workshop/useWorkshopBookmarkBrowser';
import {
  bookmarkCoverageLine,
  bookmarkFirstLines,
  bookmarkSessionLabel,
  duplicateCheckNote,
  filterBookmarks,
  groupBookmarksByDate,
  groupBookmarksBySession,
  liveBookmarkItems,
  savedBookmarkItems,
  searchCoverageNote,
  type WorkshopBookmarkBrowserItem
} from '@hooks/domain/workshop/bookmarks/workshopBookmarkBrowserView';
import { participantIdentityColorIndex } from '@utils/contextBudget';
import { relativeSessionTime } from '@utils/relativeSessionTime';

export interface WorkshopBookmarkBrowserActions {
  onPreview: (item: WorkshopBookmarkBrowserItem) => void;
  onOpenSession: (item: WorkshopBookmarkBrowserItem) => void;
  onOpenAtBookmark: (item: WorkshopBookmarkBrowserItem) => void;
  onShowInThread: (item: WorkshopBookmarkBrowserItem) => void;
}

export interface WorkshopBookmarkBrowserModalProps extends WorkshopBookmarkBrowserActions {
  open: boolean;
  live: WorkshopBookmarkBrowserLive;
  saved: WorkshopBookmarkBrowserSaved;
  query: string;
  /** Room-changing actions are off (a run, a pending action, or no saving). */
  openDisabled: boolean;
  /** The clock the date groups read; now by default. */
  now?: Date;
  onQueryChange: (query: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
}

/** Why a row whose session id another file claims doesn't open (PR #216 F-01). */
const AMBIGUOUS_ROW = 'Another saved session file uses this session’s id, so it can’t be opened from here. Keep one of the files in prose-minion/sessions.';

/** A read-only row has nothing to rename or delete. */
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

const identityStyle = (identity: string): React.CSSProperties => ({
  ['--pm-ws-bookmark-identity' as string]: `var(--pm-identity-${participantIdentityColorIndex(identity)})`
});

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopBookmarkBrowserModal: React.FC<WorkshopBookmarkBrowserModalProps> = ({
  open,
  live,
  saved,
  query,
  openDisabled,
  now,
  onQueryChange,
  onLoadMore,
  onClose,
  ...actions
}) => {
  const liveItems = React.useMemo(() => filterBookmarks(liveBookmarkItems(live.rows), query), [live.rows, query]);
  const savedItems = React.useMemo(
    () => filterBookmarks(savedBookmarkItems(saved.sessions, saved.ambiguousSessionIds), query),
    [saved.ambiguousSessionIds, saved.sessions, query]
  );
  const duplicateNote = duplicateCheckNote(saved.coverage);
  const groupings = React.useMemo<ReadonlyArray<SavedItemGrouping<WorkshopBookmarkBrowserItem>>>(() => [
    { key: 'date', label: 'Date', group: (items) => groupBookmarksByDate(items, now) },
    { key: 'session', label: 'Session', group: (items) => groupBookmarksBySession(items) }
  ], [now]);
  const coverage = bookmarkCoverageLine(saved.coverage);
  const searchNote = searchCoverageNote(query, saved.coverage);
  const canLoadMore = saved.next !== undefined && !saved.loading;
  const renderRow = (item: WorkshopBookmarkBrowserItem) => (
    <BookmarkBrowserRow key={item.key} item={item} openDisabled={openDisabled} {...actions} />
  );

  return (
    <SavedItemBrowserModal<WorkshopBookmarkBrowserItem>
      open={open}
      titleId="pm-ws-bookmark-browser-title"
      closeLabel="Close bookmarks"
      className="pm-ws-session-browser-modal pm-ws-bookmark-browser-modal"
      eyebrow="Workshop · Bookmarks"
      title="Bookmarks"
      description="Every message you bookmarked, in this conversation and in your saved sessions. Preview one, open its session, or open the session at the bookmark."
      search={{
        label: 'Search bookmarks',
        placeholder: 'Search bookmark names and messages…',
        scope: 'searches messages',
        query,
        disabled: false,
        onChange: onQueryChange
      }}
      groupLabel="Group bookmarks by"
      groupings={groupings}
      status={
        <>
          {coverage && <div className="pm-ws-bookmark-browser-coverage" role="status">{coverage}</div>}
          {saved.loading && <div className="pm-ws-sessions-pending" role="status">Reading saved sessions…</div>}
          {saved.error && (
            <div className="pm-ws-sessions-unavailable" role="alert">
              <Icon name="x" size={14} /> {saved.error}
            </div>
          )}
          {duplicateNote && <div className="pm-ws-sessions-truncated" role="status">{duplicateNote}</div>}
          {saved.unreadableSessions.length > 0 && (
            <div className="pm-ws-sessions-truncated" role="status">
              Couldn’t read: {saved.unreadableSessions.map((session) => session.title).join(', ')}.
            </div>
          )}
          {searchNote && (
            <div className="pm-ws-sessions-truncated" role="status">
              {searchNote}{' '}
              <button className="pm-ws-session-quiet" type="button" disabled={!canLoadMore} onClick={onLoadMore}>
                Load more
              </button>
            </div>
          )}
        </>
      }
      leading={
        <section className="pm-ws-session-browser-section" aria-labelledby="pm-ws-bookmark-live-heading">
          <div className="pm-ws-sessions-section-title" id="pm-ws-bookmark-live-heading">
            {'This conversation '}<span>thread order</span>
          </div>
          {live.status === 'loading' && <div className="pm-ws-sessions-pending" role="status">Reading this conversation’s bookmarks…</div>}
          {live.status === 'error' && (
            <div className="pm-ws-sessions-unavailable" role="alert"><Icon name="x" size={14} /> {live.error}</div>
          )}
          {live.status === 'ready' && liveItems.length === 0 && (
            <div className="pm-ws-sessions-empty">
              {query.trim() ? 'No bookmarks in this conversation match this search.' : 'No bookmarks in this conversation yet.'}
            </div>
          )}
          {liveItems.map(renderRow)}
        </section>
      }
      section={{ id: 'pm-ws-bookmark-saved-heading', title: 'Saved sessions', note: 'newest first' }}
      emptyText={saved.coverage.started
        ? (query.trim() ? 'No saved bookmarks loaded so far match this search.' : 'No bookmarks in the saved sessions loaded so far.')
        : 'Reading saved sessions…'}
      items={savedItems}
      itemKey={(item) => item.key}
      itemTitle={(item) => item.row.label}
      renderRow={(item) => renderRow(item)}
      footer={
        <>
          <span>Saved sessions are read a page at a time; open one to change its bookmarks.</span>
          <button className="pm-ws-session-secondary" type="button" disabled={!canLoadMore} onClick={onLoadMore}>
            {saved.loading ? 'Loading…' : 'Load more'}
          </button>
        </>
      }
      onClose={onClose}
      readOnly
    />
  );
};

interface BookmarkBrowserRowProps extends WorkshopBookmarkBrowserActions {
  item: WorkshopBookmarkBrowserItem;
  openDisabled: boolean;
}

/** One bookmark: its label, who said it, where and when, its first lines, and its actions. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const BookmarkBrowserRow: React.FC<BookmarkBrowserRowProps> = ({
  item,
  openDisabled,
  onPreview,
  onOpenSession,
  onOpenAtBookmark,
  onShowInThread
}) => {
  const { row } = item;
  const firstLines = bookmarkFirstLines(row.message?.content);
  const sessionLabel = bookmarkSessionLabel(item);
  return (
    <SavedItemRow
      title={row.label}
      disabled={false}
      readOnly
      glyph={
        <span
          className={`pm-ws-bookmark-icon pm-ws-bookmark-browser-glyph${row.identity ? '' : ' pm-ws-bookmark-icon-writer'}`}
          style={row.identity ? identityStyle(row.identity) : undefined}
          aria-hidden="true"
        >
          <Icon name="bookmark" size={16} />
        </span>
      }
      badges={item.ambiguous ? <span className="pm-ws-session-badge" title={AMBIGUOUS_ROW}>Shared session id</span> : undefined}
      metaTitle={[row.speaker, sessionLabel, new Date(row.createdAt).toLocaleString()].join(' · ')}
      meta={
        <>
          <span className="pm-ws-session-host-name">{row.speaker}</span>
          <span>·</span>
          <span>{sessionLabel}</span>
          <span>·</span>
          <span>{relativeSessionTime(row.createdAt)}</span>
        </>
      }
      extra={firstLines ? <div className="pm-ws-session-row-preview" title={firstLines}>{firstLines}</div> : undefined}
      renameLabel="Rename bookmark"
      primary={
        <div className="pm-ws-bookmark-browser-actions">
          <button
            className="pm-ws-session-secondary"
            type="button"
            aria-label={`Preview ${row.label}`}
            disabled={item.source.kind === 'live' && !row.message}
            onClick={() => onPreview(item)}
          >
            Preview
          </button>
          {item.source.kind === 'saved' ? (
            <>
              <button
                className="pm-ws-session-secondary"
                type="button"
                aria-label={`Open session ${item.source.sessionTitle}`}
                disabled={openDisabled || item.ambiguous === true}
                title={item.ambiguous ? AMBIGUOUS_ROW : undefined}
                onClick={() => onOpenSession(item)}
              >
                Open session
              </button>
              <button
                className="pm-ws-session-primary"
                type="button"
                aria-label={`Open at bookmark ${row.label}`}
                disabled={openDisabled || item.ambiguous === true}
                title={item.ambiguous ? AMBIGUOUS_ROW : undefined}
                onClick={() => onOpenAtBookmark(item)}
              >
                Open at bookmark
              </button>
            </>
          ) : (
            <button
              className="pm-ws-session-primary"
              type="button"
              aria-label={`Show ${row.label} in the thread`}
              onClick={() => onShowInThread(item)}
            >
              Show in thread
            </button>
          )}
        </div>
      }
      controls={NO_CONTROLS}
      onOpen={() => onPreview(item)}
    />
  );
};
