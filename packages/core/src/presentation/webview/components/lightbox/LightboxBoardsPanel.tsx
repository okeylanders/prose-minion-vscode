/**
 * LightboxBoardsPanel — the rail's saved boards (Slice 5A; epic decision 31).
 *
 * Props-only. The boards saved from the source on screen, newest first: when
 * each was saved, the lenses it holds, any stale, its approximate cost, and
 * which is the board on screen. Open replaces the board on screen with one,
 * exactly as saved; Delete asks first, in the row, and the writer confirms
 * or keeps it. For a board opened from a file, the panel says whether the
 * file still holds its text and, when it does not, offers "Read the current
 * text". Where boards are kept, and why they are kept for the session only,
 * is said here too. The newest page of boards shows first; when there are
 * more, the panel says how many and offers "Show older" (PR #163 F-04),
 * which shows a page more than are shown, even when the page was widened
 * to reach the board on screen (PR #163 N-03).
 * The board's id keys the panel in the app, so a new board starts at one
 * page.
 *
 * Keyboard: every action is a button. Delete moves focus to the confirm
 * step's "Keep", the safe answer; Escape there keeps the board and returns
 * focus to its Delete.
 */
import * as React from 'react';
import type { LightboxBoardShelf } from '@messages';
import { Icon } from '@components/shared/Icon';
import { LIGHTBOX_BOARDS_PAGE, buildLightboxBoardsView } from '@hooks/domain/lightbox/lightboxBoardsView';

export interface LightboxBoardsPanelProps {
  shelf: LightboxBoardShelf | null;
  hasBoard: boolean;
  /** The file being opened, until the host answers. */
  opening: string | null;
  rereading: boolean;
  onOpen: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  /** "Read the current text": re-read the file the board was saved from. */
  onReadCurrentText: () => void;
  /** Pins the zone dates are shown in (tests and evidence); the webview's own by default. */
  timeZone?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardsPanel: React.FC<LightboxBoardsPanelProps> = ({
  shelf,
  hasBoard,
  opening,
  rereading,
  onOpen,
  onDelete,
  onReadCurrentText,
  timeZone
}) => {
  const [shown, setShown] = React.useState(LIGHTBOX_BOARDS_PAGE);
  const view = React.useMemo(() => buildLightboxBoardsView(shelf, hasBoard, { timeZone, shown }), [hasBoard, shelf, shown, timeZone]);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const deleteButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const keepButton = React.useRef<HTMLButtonElement | null>(null);
  // The row whose Delete takes focus back once its confirm step has gone.
  const returnFocusTo = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (confirming) {
      keepButton.current?.focus();
      return;
    }
    if (returnFocusTo.current) {
      deleteButtons.current.get(returnFocusTo.current)?.focus();
      returnFocusTo.current = null;
    }
  }, [confirming]);
  // A row that is gone has nothing to confirm.
  React.useEffect(() => {
    if (confirming && !view.rows.some((row) => row.fileId === confirming)) {
      setConfirming(null);
    }
  }, [confirming, view.rows]);

  const keep = (fileId: string) => {
    returnFocusTo.current = fileId;
    setConfirming(null);
  };

  return (
    <section className="pm-ws-block pm-lb-boards" aria-label="Saved boards">
      <div className="pm-ws-block-head">
        <p className="pm-ws-eyebrow">Boards</p>
        <span className="pm-lb-meta">{view.status}</span>
      </div>
      {view.snapshot && (
        <div className={`pm-lb-snapshot is-${view.snapshot.tone}`} role="status">
          <Icon name={view.snapshot.tone === 'warn' ? 'alert' : 'history'} size={13} />
          <div className="pm-lb-snapshot-body">
            <p>{view.snapshot.opened}</p>
            <p>{view.snapshot.file}</p>
            {view.snapshot.dropped && <p>{view.snapshot.dropped}</p>}
            {view.snapshot.readCurrentText && (
              <button type="button" className="pm-lb-button" onClick={onReadCurrentText} disabled={rereading}>
                <Icon name="refresh" size={13} />
                {rereading ? 'Reading…' : 'Read the current text'}
              </button>
            )}
          </div>
        </div>
      )}
      {view.availability && <p className="pm-lb-boards-note">{view.availability}</p>}
      {view.notice && <p className="pm-lb-boards-notice" role="alert">{view.notice}</p>}
      {view.rows.length > 0 && (
        <ol className="pm-lb-boards-list" aria-label="Saved boards, newest first">
          {view.rows.map((row) => (
            <li key={row.fileId} className={`pm-lb-saved-board${row.onScreen ? ' is-on-screen' : ''}`} aria-current={row.onScreen ? 'true' : undefined}>
              <div className="pm-lb-saved-board-text">
                <time className="pm-lb-saved-board-when" dateTime={row.dateTime}>{row.when}</time>
                <span className="pm-lb-saved-board-meta">
                  {[row.lenses, row.stale, row.cost].filter(Boolean).join(' · ')}
                </span>
              </div>
              {confirming === row.fileId ? (
                <div
                  className="pm-lb-saved-board-confirm"
                  role="group"
                  aria-label={`Delete the board saved ${row.when}?`}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      keep(row.fileId);
                    }
                  }}
                >
                  <span>Delete this file?</span>
                  <button type="button" className="pm-lb-button is-danger" onClick={() => { setConfirming(null); onDelete(row.fileId); }}>
                    Delete
                  </button>
                  <button type="button" className="pm-lb-button" ref={keepButton} onClick={() => keep(row.fileId)}>
                    Keep
                  </button>
                </div>
              ) : (
                <div className="pm-lb-saved-board-actions">
                  {row.onScreen ? (
                    <span className="pm-lb-stat-chip">On screen</span>
                  ) : (
                    <button
                      type="button"
                      className="pm-lb-button"
                      aria-label={`Open the board saved ${row.when}`}
                      disabled={opening !== null}
                      onClick={() => onOpen(row.fileId)}
                    >
                      {opening === row.fileId ? 'Opening…' : 'Open'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="pm-lb-icon-button"
                    aria-label={`Delete the board saved ${row.when}`}
                    ref={(element) => {
                      if (element) {
                        deleteButtons.current.set(row.fileId, element);
                      } else {
                        deleteButtons.current.delete(row.fileId);
                      }
                    }}
                    onClick={() => setConfirming(row.fileId)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {view.page && (
        <div className="pm-lb-boards-page">
          <p className="pm-lb-boards-note" role="status">{view.page.note}</p>
          <button type="button" className="pm-lb-button" onClick={() => setShown(view.page?.next ?? LIGHTBOX_BOARDS_PAGE)}>
            {view.page.more}
          </button>
        </div>
      )}
      {view.empty && <p className="pm-lb-boards-empty">{view.empty}</p>}
      {view.unreadable && <p className="pm-lb-boards-note">{view.unreadable}</p>}
      {view.caption && <p className="pm-lb-caption">{view.caption}</p>}
    </section>
  );
};
