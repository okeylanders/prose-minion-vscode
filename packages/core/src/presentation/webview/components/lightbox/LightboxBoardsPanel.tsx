/**
 * LightboxBoardsPanel — the rail's saved boards (Slice 5A; epic decision 31;
 * Slice 5A.1, decision 33).
 *
 * Props-only. The boards saved from the source on screen, newest first: when
 * each was saved, the lenses it holds, any stale, its approximate cost, the
 * models that read it, and which is the board on screen. A named board shows
 * its name first and its date and time under it. Open replaces the board on
 * screen with one, exactly as saved; Rename names a row's file in place;
 * Delete asks first, in the row, and the writer confirms or keeps it. The
 * section's head names the board on screen, or says it is unnamed, with
 * Name or Rename. For a board opened from a file, the panel says whether the
 * file still holds its text and, when it does not, offers "Read the current
 * text" (the board above shows the same notice: `lightboxChangedFileNotice`).
 * Where boards are kept, and why they are kept for the session only, is said
 * here too. The newest page of boards shows first; when there are more, the
 * panel says how many and offers "Show older" (PR #163 F-04), which shows a
 * page more than are shown, even when the page was widened to reach the
 * board on screen (PR #163 N-03). The board's id keys the panel in the app,
 * so a new board starts at one page.
 *
 * Keyboard: every action is a button. Rename and Name open a field in place
 * (`LightboxBoardNameField`): Enter saves, Escape cancels, and either returns
 * focus to the action that opened it. Delete moves focus to the confirm
 * step's "Keep", the safe answer; Escape there keeps the board and returns
 * focus to its Delete. A confirmed delete keeps focus on the row's Delete
 * until the row goes, then moves it to the next row's Delete, or to the
 * head's Name or Rename when none is left below.
 */
import * as React from 'react';
import type { LightboxBoardShelf } from '@messages';
import { Icon } from '@components/shared/Icon';
import { LightboxBoardNameField, type LightboxBoardNameClose } from '@components/lightbox/LightboxBoardNameField';
import {
  LIGHTBOX_BOARDS_PAGE,
  buildLightboxBoardsView,
  type LightboxSavedBoardRow
} from '@hooks/domain/lightbox/lightboxBoardsView';

export interface LightboxBoardsPanelProps {
  shelf: LightboxBoardShelf | null;
  hasBoard: boolean;
  /** The file being opened, until the host answers. */
  opening: string | null;
  rereading: boolean;
  onOpen: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  /** Name a saved file, or (`null`) the board on screen; empty unnames it (Slice 5A.1). */
  onRename: (fileId: string | null, name: string) => void;
  /** "Read the current text": re-read the file the board was saved from. */
  onReadCurrentText: () => void;
  /** Pins the zone dates are shown in (tests and evidence); the webview's own by default. */
  timeZone?: string;
}

/** The head's field, as against a row's: a row is named by its file id, which always holds a slash. */
const HEAD = 'head';

/** Where focus goes once a field or a confirm step closes. */
type FocusTarget = { kind: 'head' } | { kind: 'rename' | 'delete'; fileId: string };

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardsPanel: React.FC<LightboxBoardsPanelProps> = ({
  shelf,
  hasBoard,
  opening,
  rereading,
  onOpen,
  onDelete,
  onRename,
  onReadCurrentText,
  timeZone
}) => {
  const [shown, setShown] = React.useState(LIGHTBOX_BOARDS_PAGE);
  const view = React.useMemo(() => buildLightboxBoardsView(shelf, hasBoard, { timeZone, shown }), [hasBoard, shelf, shown, timeZone]);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  // The head's field (`HEAD`) or a row's (its file id), while one is open.
  const [editing, setEditing] = React.useState<string | null>(null);
  const deleteButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const renameButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const headButton = React.useRef<HTMLButtonElement | null>(null);
  const keepButton = React.useRef<HTMLButtonElement | null>(null);
  // Where focus goes once the confirm step or the field has gone.
  const returnFocusTo = React.useRef<FocusTarget | null>(null);
  // A confirmed delete: focus moves on from its row once the row has gone.
  const deleted = React.useRef<{ fileId: string; next: string | null } | null>(null);

  React.useEffect(() => {
    if (confirming) {
      keepButton.current?.focus();
      return;
    }
    const target = returnFocusTo.current;
    if (target && !editing) {
      returnFocusTo.current = null;
      (target.kind === 'head' ? headButton.current
        : (target.kind === 'delete' ? deleteButtons : renameButtons).current.get(target.fileId))?.focus();
    }
  }, [confirming, editing]);
  // A row that is gone has nothing to confirm or name; a deleted row's focus moves on.
  React.useEffect(() => {
    if (confirming && !view.rows.some((row) => row.fileId === confirming)) {
      setConfirming(null);
    }
    if (editing && editing !== HEAD && !view.rows.some((row) => row.fileId === editing)) {
      setEditing(null);
    }
    const gone = deleted.current;
    if (gone && !view.rows.some((row) => row.fileId === gone.fileId)) {
      deleted.current = null;
      ((gone.next ? deleteButtons.current.get(gone.next) : undefined) ?? headButton.current)?.focus();
    }
  }, [confirming, editing, view.rows]);

  const keep = (fileId: string) => {
    returnFocusTo.current = { kind: 'delete', fileId };
    setConfirming(null);
  };
  const confirmDelete = (fileId: string) => {
    const index = view.rows.findIndex((row) => row.fileId === fileId);
    deleted.current = { fileId, next: view.rows[index + 1]?.fileId ?? null };
    returnFocusTo.current = { kind: 'delete', fileId };
    setConfirming(null);
    onDelete(fileId);
  };
  const beginRename = (target: string) => {
    deleted.current = null;
    setConfirming(null);
    setEditing(target);
  };
  const closeField = (target: FocusTarget) => (how: LightboxBoardNameClose) => {
    // Enter and Escape give focus back to the action; leaving the field leaves it where the writer put it.
    returnFocusTo.current = how === 'left' ? null : target;
    setEditing(null);
  };

  const rowText = (row: LightboxSavedBoardRow) => (
    <div className="pm-lb-saved-board-text">
      {editing === row.fileId ? (
        <LightboxBoardNameField
          label={`Name for the board saved ${row.when}`}
          initial={row.name ?? ''}
          onSave={(name) => onRename(row.fileId, name)}
          onClose={closeField({ kind: 'rename', fileId: row.fileId })}
        />
      ) : row.name !== undefined && (
        <strong className="pm-lb-saved-board-name">{row.name}</strong>
      )}
      <time className={`pm-lb-saved-board-when${row.name !== undefined || editing === row.fileId ? ' is-under-name' : ''}`} dateTime={row.dateTime}>
        {row.when}
      </time>
      <span className="pm-lb-saved-board-meta">
        {[row.lenses, row.stale, row.cost].filter(Boolean).join(' · ')}
      </span>
      {row.models && <span className="pm-lb-saved-board-models" title={row.modelIds}>{row.models}</span>}
    </div>
  );

  return (
    <section className="pm-ws-block pm-lb-boards" aria-label="Saved boards">
      <div className="pm-ws-block-head">
        <p className="pm-ws-eyebrow">Boards</p>
        <span className="pm-lb-meta">{view.status}</span>
      </div>
      {view.board && (
        <div className="pm-lb-board-name">
          {editing === HEAD ? (
            <LightboxBoardNameField
              label="Name for the board on screen"
              initial={view.board.name}
              onSave={(name) => onRename(null, name)}
              onClose={closeField({ kind: 'head' })}
            />
          ) : (
            <>
              <p className={`pm-lb-board-name-label${view.board.named ? '' : ' is-unnamed'}`}>{view.board.label}</p>
              <button
                type="button"
                className="pm-lb-button"
                ref={headButton}
                aria-label={`${view.board.action} the board on screen`}
                onClick={() => beginRename(HEAD)}
              >
                <Icon name="pen" size={13} />
                {view.board.action}
              </button>
            </>
          )}
          {view.board.note && <p className="pm-lb-board-name-note">{view.board.note}</p>}
        </div>
      )}
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
              {rowText(row)}
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
                  <button type="button" className="pm-lb-button is-danger" onClick={() => confirmDelete(row.fileId)}>
                    Delete
                  </button>
                  <button type="button" className="pm-lb-button" ref={keepButton} onClick={() => keep(row.fileId)}>
                    Keep
                  </button>
                </div>
              ) : editing !== row.fileId && (
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
                    aria-label={`Rename the board saved ${row.when}`}
                    title="Rename"
                    ref={(element) => keepRef(renameButtons.current, row.fileId, element)}
                    onClick={() => beginRename(row.fileId)}
                  >
                    <Icon name="pen" size={13} />
                  </button>
                  <button
                    type="button"
                    className="pm-lb-icon-button"
                    aria-label={`Delete the board saved ${row.when}`}
                    ref={(element) => keepRef(deleteButtons.current, row.fileId, element)}
                    onClick={() => {
                      deleted.current = null;
                      setConfirming(row.fileId);
                    }}
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

function keepRef(buttons: Map<string, HTMLButtonElement>, fileId: string, element: HTMLButtonElement | null): void {
  if (element) {
    buttons.set(fileId, element);
  } else {
    buttons.delete(fileId);
  }
}
